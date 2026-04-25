const express = require("express");
const { db } = require("../database/database");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Multer setup for signature uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/signature"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});


const uploadSignature = multer({ storage });

router.get("/api/signature", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT full_name, signature_image
       FROM signature_table
       ORDER BY created_at DESC
       LIMIT 1`,
    );

    if (!rows.length) {
      return res.json({ success: false });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post(
  "/api/signature",
  uploadSignature.single("signature"),
  async (req, res) => {
    try {
      const { full_name } = req.body;

      if (!full_name || !req.file) {
        return res.json({ success: false });
      }

      const signaturePath = `signature/${req.file.filename}`;

      await db.query(
        "INSERT INTO signature_table (full_name, signature_image) VALUES (?, ?)",
        [full_name, signaturePath],
      );

      //  IBALIK AGAD SA FRONTEND
      res.json({
        success: true,
        data: {
          full_name,
          signature_image: signaturePath,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  },
);

// ================= GET =================
router.get("/api/signature/:fullName", async (req, res) => {
  try {
    const { fullName } = req.params;

    const [rows] = await db.query(
      `SELECT full_name, signature_image
       FROM signature_table
       WHERE full_name = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [fullName],
    );

    if (!rows.length) {
      return res.json({ success: false });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// GET LATEST SIGNATURE
router.get("/api/signature-latest", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT full_name, signature_image
      FROM signature_table
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!rows.length) {
      return res.json({ success: false });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;