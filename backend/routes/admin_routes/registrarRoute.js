const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { db, db3 } = require('../database/database');
const { CanDelete } = require("../../middleware/pagePermissions");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getAuditActor = (req) => ({
  actorId:
    req.body?.audit_actor_id ||
    req.headers["x-audit-actor-id"] ||
    req.headers["x-employee-id"] ||
    "unknown",
  actorRole:
    req.body?.audit_actor_role ||
    req.headers["x-audit-actor-role"] ||
    "registrar",
});

const getRegistrarLabel = (registrar) => {
  if (!registrar) return "Unknown Registrar";
  const name = [registrar.last_name, registrar.first_name, registrar.middle_name]
    .filter(Boolean)
    .join(", ");
  return registrar.employee_id || name || registrar.email || `id ${registrar.id || "unknown"}`;
};

const insertRegistrarAuditLog = async ({ req, action, message, severity = "INFO" }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    severity,
    message,
  });
};

const parseAccessPages = (rawAccessPage) => {
  if (!rawAccessPage) return [];
  if (Array.isArray(rawAccessPage)) return rawAccessPage;

  try {
    const parsed = JSON.parse(rawAccessPage);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

router.get("/get_employee", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT id, employee_id, first_name, last_name, middle_name, email, role AS position, dprtmnt_id FROM user_accounts WHERE role != 'student';  
    `)

    if (rows.length === 0) {
      res.status(400).json({ message: "Theres no employee found in the record" });
    }

    res.json(rows);
    console.log("Data: ", rows);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", err });
  }
})

// POST CREATION ONLY
router.post("/register_registrar", upload.single("profile_picture"), async (req, res) => {
  try {
    const {
      employee_id,
      last_name,
      middle_name,
      first_name,
      email,
      password,
      status,
      dprtmnt_id,
      access_level
    } = req.body;

    const file = req.file;

    // 🧩 Validate required fields
    if (!employee_id || !last_name || !first_name || !email || !password || !access_level) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 🧩 Check duplicate email
    const [existing] = await db3.query(
      "SELECT id FROM user_accounts WHERE LOWER(email) = ?",
      [normalizedEmail]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // 🔒 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 👤 Create person record
    // const [personInsert] = await db3.query("INSERT INTO person_table () VALUES ()");
    // const person_id = personInsert.insertId;

    // 🖼 IMAGE HANDLING — SAME AS POST & PUT
    let profilePicName = null;

    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      const year = new Date().getFullYear();
      profilePicName = `${employee_id}_1by1_${year}${ext}`;

      const uploadDir = path.join(__dirname, "../../uploads/Admin1by1");
      const finalPath = path.join(uploadDir, profilePicName);

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Clean old images (safety)
      const files = await fs.promises.readdir(uploadDir);
      for (const f of files) {
        if (f.startsWith(`${employee_id}_1by1_`)) {
          await fs.promises.unlink(path.join(uploadDir, f));
        }
      }

      await fs.promises.writeFile(finalPath, file.buffer);
    }

    // 🏷 Department NULL allowed
    const deptValue = dprtmnt_id === "" ? null : dprtmnt_id;

    const [registrar] = await db3.query(
      `SELECT MAX(person_id) AS latest_person_id FROM user_accounts;`
    );

    const personIdForRegistrar = registrar[0].latest_person_id;


    // 💾 Save registrar
    await db3.query(
      `INSERT INTO user_accounts 
       (person_id, employee_id, last_name, middle_name, first_name, role, email, password, status, dprtmnt_id, profile_picture, access_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        personIdForRegistrar + 1,
        employee_id,
        last_name,
        middle_name,
        first_name,
        "registrar",
        normalizedEmail,
        hashedPassword,
        status || 1,
        deptValue,
        profilePicName,
        Number(access_level)
      ]
    );

    // 📄 Page access from access_table
    const [accessRows] = await db3.query(
      "SELECT access_page FROM access_table WHERE access_id = ?",
      [access_level]
    );

    if (!accessRows.length) {
      return res.status(400).json({ message: "Invalid access level selected" });
    }

    const pageIds = parseAccessPages(accessRows[0].access_page);
    if (pageIds.length) {
      const values = pageIds.map(pageId => [1, pageId, employee_id]);

      await db3.query(
        "INSERT INTO page_access (page_privilege, page_id, user_id) VALUES ?",
        [values]
      );
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertRegistrarAuditLog({
      req,
      action: "REGISTRAR_ACCOUNT_CREATE",
      message: `${roleLabel} (${actorId}) created registrar account ${employee_id} - ${last_name}, ${first_name}.`,
    });

    res.status(201).json({ message: "Registrar account created successfully!" });

  } catch (error) {
    console.error("❌ Error creating registrar account:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST CREATION AND UPDATE OF PROFILE PICTURE
router.post("/update_registrar", upload.single("profile_picture"), async (req, res) => {
  const { person_id } = req.body;

  if (!person_id || !req.file) {
    return res.status(400).send("Missing person_id or file.");
  }

  try {
    // ✅ Get student_number from person_id
    const [rows] = await db3.query(
      "SELECT employee_id FROM user_accounts WHERE person_id = ?",
      [person_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "student number not found for person_id " + person_id });
    }

    const employee_id = rows[0].employee_id;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const year = new Date().getFullYear();
    const filename = `${employee_id}_1by1_${year}${ext}`;
    const uploadDir = path.join(__dirname, "../../uploads/Admin1by1");
    const finalPath = path.join(uploadDir, filename);

    const files = await fs.promises.readdir(uploadDir);
    for (const file of files) {
      if (file.startsWith(`${employee_id}_1by1_`)) {
        await fs.promises.unlink(path.join(uploadDir, file));
      }
    }

    await fs.promises.writeFile(finalPath, req.file.buffer);

    await db3.query("UPDATE user_accounts SET profile_picture = ? WHERE person_id = ?", [filename, person_id]);

    res.status(200).json({ message: "Uploaded successfully", filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Failed to upload image.");
  }
});

// PUT UPDATE OF DATA AND PROFILE PICTURE
router.put("/update_registrar/:id", upload.single("profile_picture"), async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const file = req.file;

  try {
    const [existing] = await db3.query(
      "SELECT * FROM user_accounts WHERE id = ?",
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({ message: "Registrar not found" });
    }

    const current = existing[0];
    let finalFilename = current.profile_picture;

    // 🖼 SAME IMAGE HANDLING AS POST
    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      const year = new Date().getFullYear();
      finalFilename = `${current.employee_id}_1by1_${year}${ext}`;

      const uploadDir = path.join(__dirname, "../../uploads/Admin1by1");
      const finalPath = path.join(uploadDir, finalFilename);

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Delete old images for this employee
      const files = await fs.promises.readdir(uploadDir);
      for (const f of files) {
        if (f.startsWith(`${current.employee_id}_1by1_`)) {
          await fs.promises.unlink(path.join(uploadDir, f));
        }
      }

      // Save new image
      await fs.promises.writeFile(finalPath, file.buffer);
    }

    const deptValue = data.dprtmnt_id === "" ? null : data.dprtmnt_id;

    await db3.query(
      `UPDATE user_accounts 
       SET employee_id=?, last_name=?, middle_name=?, first_name=?, role=?, email=?, status=?, dprtmnt_id=?, profile_picture=?, access_level=?
       WHERE id=?`,
      [
        data.employee_id || current.employee_id,
        data.last_name || current.last_name,
        data.middle_name || current.middle_name,
        data.first_name || current.first_name,
        "registrar",
        data.email?.toLowerCase() || current.email,
        data.status ?? current.status,
        deptValue,
        finalFilename,
        data.access_level ? Number(data.access_level) : current.access_level,
        id
      ]
    );

    if (data.access_level) {
      const newEmployeeId = data.employee_id || current.employee_id;
      const [accessRows] = await db3.query(
        "SELECT access_page FROM access_table WHERE access_id = ?",
        [data.access_level]
      );

      if (accessRows.length) {
        const pageIds = parseAccessPages(accessRows[0].access_page);

        await db3.query("DELETE FROM page_access WHERE user_id = ?", [
          newEmployeeId,
        ]);

        if (pageIds.length) {
          const values = pageIds.map((pageId) => [1, pageId, newEmployeeId]);
          await db3.query(
            "INSERT INTO page_access (page_privilege, page_id, user_id) VALUES ?",
            [values]
          );
        }
      }
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertRegistrarAuditLog({
      req,
      action: "REGISTRAR_ACCOUNT_UPDATE",
      message: `${roleLabel} (${actorId}) updated registrar account ${getRegistrarLabel({
        employee_id: data.employee_id || current.employee_id,
        last_name: data.last_name || current.last_name,
        first_name: data.first_name || current.first_name,
        middle_name: data.middle_name || current.middle_name,
        email: data.email || current.email,
        id,
      })}.`,
    });

    res.json({
      success: true,
      message: "Registrar updated successfully"
    });

  } catch (error) {
    console.error("❌ Error updating registrar:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete_registrar/:id", CanDelete, async (req, res) => {
  const { id } = req.params;
  const requestEmployeeId = req.headers["x-employee-id"];
  let conn;

  try {
    conn = await db3.getConnection();
    await conn.beginTransaction();

    const [registrarRows] = await conn.query(
      `SELECT id, employee_id, first_name, middle_name, last_name, email, profile_picture
       FROM user_accounts
       WHERE id = ? AND role IN ('registrar', 'admission', 'enrollment', 'clinic', 'superadmin')
       LIMIT 1`,
      [id],
    );

    if (registrarRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Registrar not found" });
    }

    const registrar = registrarRows[0];
    if (String(registrar.employee_id) === String(requestEmployeeId)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account while logged in.",
      });
    }

    await conn.query("DELETE FROM page_access WHERE user_id = ?", [
      registrar.employee_id,
    ]);
    await conn.query("DELETE FROM user_accounts WHERE id = ?", [id]);

    await conn.commit();

    if (registrar.profile_picture) {
      const imagePath = path.join(
        __dirname,
        "../../uploads/Admin1by1",
        registrar.profile_picture,
      );

      try {
        if (fs.existsSync(imagePath)) {
          await fs.promises.unlink(imagePath);
        }
      } catch (fileErr) {
        console.error("Failed to delete registrar image:", fileErr.message);
      }
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertRegistrarAuditLog({
      req,
      action: "REGISTRAR_ACCOUNT_DELETE",
      severity: "WARN",
      message: `${roleLabel} (${actorId}) deleted registrar account ${getRegistrarLabel(registrar)}.`,
    });

    res.json({ success: true, message: "Registrar deleted successfully" });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("Error deleting registrar:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete registrar",
    });
  } finally {
    if (conn) conn.release();
  }
});

router.put("/api/registrar-status/:person_id", async (req, res) => {
  const { person_id } = req.params;
  const { registrar_status } = req.body;

  const allowed = [0, 1, 2];
  if (!allowed.includes(Number(registrar_status))) {
    return res
      .status(400)
      .json({ error: "registrar_status must be 0, 1, or 2" });
  }

  try {
    if (Number(registrar_status) === 1) {
      await db.query(
        `UPDATE admission.requirement_uploads
         SET registrar_status = 1,
             submitted_documents = 1,
             missing_documents = '[]'
         WHERE person_id = ?`,
        [person_id],
      );
    } else {
      await db.query(
        `UPDATE admission.requirement_uploads
         SET registrar_status = 0,
             submitted_documents = 0,
             missing_documents = NULL
         WHERE person_id = ?`,
        [person_id],
      );
    }

    res.json({
      message: "âœ… Registrar status updated for all docs",
      registrar_status,
    });
  } catch (err) {
    console.error("âŒ Error updating registrar status:", err);
    res.status(500).json({ error: "Failed to update registrar status" });
  }
});

module.exports = router;  
