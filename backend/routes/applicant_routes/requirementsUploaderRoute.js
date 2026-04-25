const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db, db3 } = require('../database/database');
const bcrypt = require("bcrypt");
const router = express.Router();
const QRCode = require("qrcode");

// Ito
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // ✅ 4MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG, PDF allowed"));
    }

    cb(null, true);
  }
});

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File exceeds 4MB limit"
    });
  }

  if (err.message === "Only JPG, JPEG, PNG, PDF allowed") {
    return res.status(400).json({
      error: err.message
    });
  }

  next(err);
});


const getShortLabel = async (desc) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT short_label FROM requirements_table WHERE LOWER(description) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1",
        [desc],
      );

    if (rows.length > 0) {
      return rows[0].short_label; //  return short_label directly from DB
    } else {
      return "Unknown"; // no match found
    }
  } catch (error) {
    console.error("Error fetching short_label:", error);
    return "Unknown";
  }
};

router.post("/upload", upload.single("file"), async (req, res) => {
  const { requirements_id, person_id } = req.body;

  if (!req.file || !person_id || !requirements_id) {
    return res
      .status(400)
      .json({ message: "Missing file, person_id, or requirements_id" });
  }

  try {
    //  Fetch description & short_label in one query
    const [rows] = await db.query(
      "SELECT description, short_label FROM requirements_table WHERE id = ?",
      [requirements_id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Requirement not found" });

    //  Use short_label directly from DB
    const shortLabel = await getShortLabel(rows[0].description);

    const year = new Date().getFullYear();
    const ext = path.extname(req.file.originalname).toLowerCase();

    //  Fetch applicant number
    const [appRows] = await db.query(
      "SELECT applicant_number FROM applicant_numbering_table WHERE person_id = ?",
      [person_id],
    );

    if (!appRows.length) {
      return res.status(404).json({
        message: `Applicant number not found for person_id ${person_id}`,
      });
    }

    const applicant_number = appRows[0].applicant_number;

    //  Construct final filename using short_label from DB
    const filename = `${applicant_number}_${shortLabel}_${year}${ext}`;
    const finalPath = path.join(__dirname, "uploads", filename);

    //  Remove existing file if exists
    const [existingFiles] = await db.query(
      `SELECT upload_id, file_path FROM requirement_uploads
       WHERE person_id = ? AND requirements_id = ? AND file_path LIKE ?`,
      [person_id, requirements_id, `%${shortLabel}_${year}%`],
    );

    for (const file of existingFiles) {
      const fullFilePath = path.join(__dirname, "uploads", file.file_path);
      try {
        await fs.promises.unlink(fullFilePath);
      } catch (err) {
        console.warn("File delete warning:", err.message);
      }
      await db.query("DELETE FROM requirement_uploads WHERE upload_id = ?", [
        file.upload_id,
      ]);
    }

    //  Write file to disk
    await fs.promises.writeFile(finalPath, req.file.buffer);

    const filePath = `${filename}`;
    const originalName = req.file.originalname;

    await db.query(
      "INSERT INTO requirement_uploads (requirements_id, person_id, file_path, original_name) VALUES (?, ?, ?, ?)",
      [requirements_id, person_id, filePath, originalName],
    );

    res.status(201).json({ message: "Upload successful", filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

router.post("/api/upload", upload.single("file"), async (req, res) => {
  const { requirements_id, person_id, remarks } = req.body;

  if (!requirements_id || !person_id || !req.file) {
    return res.status(400).json({ error: "Missing required fields or file" });
  }

  try {
    //  Applicant info
    const [[appInfo]] = await db.query(
      `
      SELECT ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name
      FROM applicant_numbering_table ant
      JOIN person_table pt ON ant.person_id = pt.person_id
      WHERE ant.person_id = ?
    `,
      [person_id],
    );

    const applicant_number = appInfo?.applicant_number || "Unknown";
    const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""} ${appInfo?.middle_name?.charAt(0) || ""}.`;

    //  Requirement description + short label
    const [descRows] = await db.query(
      "SELECT description, short_label FROM requirements_table WHERE id = ?",
      [requirements_id],
    );

    if (!descRows.length)
      return res.status(404).json({ message: "Requirement not found" });

    const { description, short_label } = descRows[0];

    //  Use the short_label directly from DB
    const shortLabel = short_label || "Unknown";

    const year = new Date().getFullYear();
    const ext = path.extname(req.file.originalname).toLowerCase();

    //  Construct filename
    const filename = `${applicant_number}_${shortLabel}_${year}${ext}`;
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "ApplicantOnlineDocuments"
    );

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const finalPath = path.join(uploadDir, filename);

    //  Delete any existing file for the same applicant + requirement
    const [existingFiles] = await db.query(
      `SELECT upload_id, file_path FROM requirement_uploads
       WHERE person_id = ? AND requirements_id = ?`,
      [person_id, requirements_id],
    );

    for (const file of existingFiles) {
      const oldPath = path.join(
        __dirname,
        "uploads",
        "ApplicantOnlineDocuments",
        file.file_path,
      );

      try {
        await fs.promises.unlink(oldPath);
      } catch (err) {
        if (err.code !== "ENOENT")
          console.warn("File delete warning:", err.message);
      }

      await db.query("DELETE FROM requirement_uploads WHERE upload_id = ?", [
        file.upload_id,
      ]);
    }

    //  Save new file
    await fs.promises.writeFile(finalPath, req.file.buffer);

    await db.query(
      `INSERT INTO requirement_uploads
        (requirements_id, person_id, file_path, original_name, status, remarks)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [
        requirements_id,
        person_id,
        filename,
        req.file.originalname,
        remarks || null,
      ],
    );

    res.status(201).json({ message: " Upload successful" });
  } catch (err) {
    console.error("Upload error:", err);
    res
      .status(500)
      .json({ error: "Failed to save upload", details: err.message });
  }
});

router.delete("/uploads/:id", async (req, res) => {
  const person_id = req.headers["x-person-id"];
  const { id } = req.params;

  if (!person_id) {
    return res.status(401).json({ message: "Unauthorized: Missing person ID" });
  }

  try {
    const [results] = await db.query(
      "SELECT file_path FROM requirement_uploads WHERE upload_id = ? AND person_id = ?",
      [id, person_id],
    );

    if (!results.length) {
      return res.status(403).json({ error: "Unauthorized or file not found" });
    }

    // ✅ FIX HERE
    const filePath = results[0].file_path;

    const fullPath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "ApplicantOnlineDocuments",
      filePath
    );

    try {
      await fs.promises.unlink(fullPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("File delete error:", err);
      }
    }

    await db.query(
      "DELETE FROM requirement_uploads WHERE upload_id = ?",
      [id]
    );

    res.json({ message: "Requirement deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete requirement" });
  }
});

module.exports = router;