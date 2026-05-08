const express = require("express");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { db, db3 } = require("../database/database");
const { CanDelete } = require("../../middleware/pagePermissions");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");

require("dotenv").config();

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

const getProfessorLabel = (prof) => {
  if (!prof) return "Unknown Professor";
  const name = [prof.lname, prof.fname, prof.mname].filter(Boolean).join(", ");
  return prof.employee_id || name || prof.email || `prof_id ${prof.prof_id || "unknown"}`;
};

const insertFacultyAuditLog = async ({ req, action, message, severity = "INFO" }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    severity,
    message,
  });
};

router.post("/update_faculty", upload.single("profile_picture"), async (req, res) => {
  const { person_id } = req.body;

  if (!person_id || !req.file) {
    return res.status(400).send("Missing person_id or file.");
  }

  try {
    // ✅ Get student_number from person_id
    const [rows] = await db3.query(
      "SELECT employee_id FROM prof_table WHERE person_id = ?",
      [person_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "employee id not found for person_id " + person_id });
    }

    const employee_id = rows[0].employee_id;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const year = new Date().getFullYear();
    const filename = `${employee_id}_1by1_${year}${ext}`;
    const uploadDir = path.join(__dirname, "../../uploads/Faculty1by1");
    const finalPath = path.join(uploadDir, filename);

    const files = await fs.promises.readdir(uploadDir);
    for (const file of files) {
      if (file.startsWith(`${employee_id}_1by1_`)) {
        await fs.promises.unlink(path.join(uploadDir, file));
      }
    }

    await fs.promises.writeFile(finalPath, req.file.buffer);

    await db3.query("UPDATE prof_table SET profile_image = ? WHERE person_id = ?", [filename, person_id]);

    res.status(200).json({ message: "Uploaded successfully", filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Failed to upload image.");
  }
});

// Fetch all professors
router.get("/professors", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT
        pft.prof_id,
        pft.person_id,
        pft.employee_id,
        pft.fname,
        pft.mname,
        pft.lname,
        pft.email,
        pft.role,
        pft.status,
        pft.profile_image,
        dpt.dprtmnt_id,
        dpt.dprtmnt_name,
        dpt.dprtmnt_code
      FROM prof_table AS pft
      LEFT JOIN (
        SELECT dpft_current.*
        FROM dprtmnt_profs_table AS dpft_current
        INNER JOIN (
          SELECT prof_id, MAX(dprtmnt_profs_id) AS latest_id
          FROM dprtmnt_profs_table
          GROUP BY prof_id
        ) AS latest_dpft
          ON latest_dpft.latest_id = dpft_current.dprtmnt_profs_id
      ) AS dpft
        ON dpft.prof_id = pft.prof_id
      LEFT JOIN dprtmnt_table AS dpt 
        ON dpft.dprtmnt_id = dpt.dprtmnt_id
      ORDER BY pft.prof_id ASC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve professors",
      details: err.message
    });
  }
});

// ADD PROFESSOR ROUTE (Consistent with /api)
router.post(
  "/register_prof",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const {
        person_id,
        employee_id,
        fname,
        mname,
        lname,
        email,
        password,
        dprtmnt_id,
        role,
      } = req.body;

      if (!employee_id || !fname || !lname || !email || !password || !dprtmnt_id) {
        return res.status(400).json({
          success: false,
          error: "Employee ID, first name, last name, email, password, and department are required.",
        });
      }

      const [existingUser] = await db3.query(
        "SELECT * FROM prof_table WHERE email = ? OR employee_id = ?",
        [email, employee_id],
      );

      if (existingUser.length > 0) {
        return res.json({
          success: false,
          error: "Email or Employee ID already exists. Please use different credentials.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let profileImage = "";
      if (req.file) {
        const year = new Date().getFullYear();
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `${employee_id}_ProfessorProfile_${year}${ext}`;
        const filePath = path.join(__dirname, "uploads", filename);
        await fs.promises.writeFile(filePath, req.file.buffer);
        profileImage = filename;
      }

      const sql = `INSERT INTO prof_table (person_id, employee_id, fname, mname, lname, email, password, role, profile_image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        person_id || null,
        employee_id,
        fname,
        mname,
        lname,
        email,
        hashedPassword,
        role,
        profileImage,
      ];

      const [result] = await db3.query(sql, values);
      const prof_id = result.insertId;

      const sql2 = `INSERT INTO dprtmnt_profs_table (dprtmnt_id, prof_id) VALUES (?, ?)`;
      await db3.query(sql2, [dprtmnt_id, prof_id]);

      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      await insertFacultyAuditLog({
        req,
        action: "PROFESSOR_ACCOUNT_CREATE",
        message: `${roleLabel} (${actorId}) created professor account ${employee_id} - ${lname}, ${fname}.`,
      });

      res
        .status(201)
        .json({ success: true, message: "Professor added successfully" });
    } catch (err) {
      console.error("Insert error:", err);
      res.json({ success: false, error: "Failed to add professor" });
    }
  },
);

// Update professor info
router.put(
  "/update_prof/:id",
  upload.single("profileImage"),
  async (req, res) => {
    const id = req.params.id;
    const {
      employee_id,
      fname,
      mname,
      lname,
      email,
      password,
      dprtmnt_id,
      role,
    } = req.body;

    try {
      if (!employee_id || !fname || !lname || !email || !dprtmnt_id) {
        return res.status(400).json({
          success: false,
          error: "Employee ID, first name, last name, email, and department are required.",
        });
      }

      const checkSQL = `SELECT * FROM prof_table WHERE (email = ? OR employee_id = ?) AND prof_id != ?`;
      const [existingRows] = await db3.query(checkSQL, [email, employee_id, id]);

      if (existingRows.length > 0) {
        return res.json({
          success: false,
          error: "Email or Employee ID already exists for another professor.",
        });
      }

      let profileImage = null;

      if (req.file) {
        const year = new Date().getFullYear();
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `${employee_id}_ProfessorProfile_${year}${ext}`;
        const filePath = path.join(__dirname, "uploads", filename);
        await fs.promises.writeFile(filePath, req.file.buffer);
        profileImage = filename;
      }

      let updateSQL;
      let values;

      if (password && profileImage) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateSQL = `
        UPDATE prof_table
        SET employee_id = ?, fname = ?, mname = ?, lname = ?, email = ?, password = ?, role = ?, profile_image = ?
        WHERE prof_id = ?
      `;
        values = [
          employee_id,
          fname,
          mname,
          lname,
          email,
          hashedPassword,
          role,
          profileImage,
          id,
        ];
      } else if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateSQL = `
        UPDATE prof_table
        SET employee_id = ?, fname = ?, mname = ?, lname = ?, email = ?, password = ?, role = ?
        WHERE prof_id = ?
      `;
        values = [
          employee_id,
          fname,
          mname,
          lname,
          email,
          hashedPassword,
          role,
          id,
        ];
      } else if (profileImage) {
        updateSQL = `
        UPDATE prof_table
        SET employee_id = ?, fname = ?, mname = ?, lname = ?, email = ?, role = ?, profile_image = ?
        WHERE prof_id = ?
      `;
        values = [
          employee_id,
          fname,
          mname,
          lname,
          email,
          role,
          profileImage,
          id,
        ];
      } else {
        updateSQL = `
        UPDATE prof_table
        SET employee_id = ?, fname = ?, mname = ?, lname = ?, email = ?, role = ?
        WHERE prof_id = ?
      `;
        values = [employee_id, fname, mname, lname, email, role, id];
      }

      await db3.query(updateSQL, values);

      if (dprtmnt_id) {
        const [existing] = await db3.query(
          `SELECT * FROM dprtmnt_profs_table WHERE prof_id = ?`,
          [id],
        );

        if (existing.length > 0) {
          await db3.query(
            `UPDATE dprtmnt_profs_table SET dprtmnt_id = ? WHERE prof_id = ?`,
            [dprtmnt_id, id],
          );
        } else {
          await db3.query(
            `INSERT INTO dprtmnt_profs_table (dprtmnt_id, prof_id) VALUES (?, ?)`,
            [dprtmnt_id, id],
          );
        }
      }

      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      await insertFacultyAuditLog({
        req,
        action: "PROFESSOR_ACCOUNT_UPDATE",
        message: `${roleLabel} (${actorId}) updated professor account ${employee_id} - ${lname}, ${fname}.`,
      });

      res.json({ success: true, message: "Professor updated successfully." });
    } catch (err) {
      res.json({ success: false, error: "Internal server error." });
    }
  },
);

// Toggle professor status (Active/Inactive)
router.put("/update_prof_status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const [profRows] = await db3.query(
      "SELECT prof_id, employee_id, fname, mname, lname, email FROM prof_table WHERE prof_id = ? LIMIT 1",
      [id],
    );

    const [result] = await db3.query(
      "UPDATE prof_table SET status = ? WHERE prof_id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Professor not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertFacultyAuditLog({
      req,
      action: "PROFESSOR_ACCOUNT_STATUS_UPDATE",
      message: `${roleLabel} (${actorId}) set professor account ${getProfessorLabel(profRows[0])} to ${Number(status) === 1 ? "Active" : "Inactive"}.`,
    });

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Status update error:", err);
    res
      .status(500)
      .json({ error: "Failed to update status", details: err.message });
  }
});

router.delete("/delete_prof/:id", CanDelete, async (req, res) => {
  const { id } = req.params;
  let conn;

  try {
    conn = await db3.getConnection();
    await conn.beginTransaction();

    const [profRows] = await conn.query(
      "SELECT prof_id, employee_id, fname, mname, lname, email, profile_image FROM prof_table WHERE prof_id = ? LIMIT 1",
      [id],
    );

    if (profRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Professor not found" });
    }

    const [scheduleRows] = await conn.query(
      "SELECT id FROM time_table WHERE professor_id = ? LIMIT 1",
      [id],
    );

    if (scheduleRows.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        error: "Professor cannot be deleted because they are assigned to a schedule.",
      });
    }

    await conn.query("DELETE FROM dprtmnt_profs_table WHERE prof_id = ?", [id]);
    await conn.query("DELETE FROM prof_table WHERE prof_id = ?", [id]);

    await conn.commit();

    const profileImage = profRows[0].profile_image;
    if (profileImage) {
      const uploadDirs = [
        path.join(__dirname, "uploads"),
        path.join(__dirname, "../../uploads/Faculty1by1"),
      ];

      for (const uploadDir of uploadDirs) {
        const imagePath = path.join(uploadDir, profileImage);
        try {
          if (fs.existsSync(imagePath)) {
            await fs.promises.unlink(imagePath);
          }
        } catch (fileErr) {
          console.error("Failed to delete professor image:", fileErr.message);
        }
      }
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertFacultyAuditLog({
      req,
      action: "PROFESSOR_ACCOUNT_DELETE",
      severity: "WARN",
      message: `${roleLabel} (${actorId}) deleted professor account ${getProfessorLabel(profRows[0])}.`,
    });

    res.json({ success: true, message: "Professor deleted successfully" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Professor delete error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete professor",
      details: err.message,
    });
  } finally {
    if (conn) conn.release();
  }
});


router.post("/import_professors", async (req, res) => {
  const { professors } = req.body;

  let conn;

  try {
    if (!Array.isArray(professors) || professors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No professors to import",
      });
    }

    conn = await db3.getConnection();
    await conn.beginTransaction();

    // ✅ STEP 1: get all existing emails + employee_ids (ONE QUERY ONLY)
    const [existingRows] = await conn.query(
      `SELECT email, employee_id FROM prof_table`
    );

    const existingEmails = new Set(existingRows.map(e => e.email));
    const existingEmpIds = new Set(existingRows.map(e => e.employee_id));

    const values = [];
    const imported = [];
    const skipped = [];

    for (const prof of professors) {
      const employee_id = prof.employeeNumber?.toString().trim();
      const fname = prof.firstName?.trim();
      const mname = prof.middleName?.trim() || "";
      const lname = prof.lastName?.trim();
      const email = prof.email?.trim();

      if (!employee_id || !fname || !lname || !email) {
        skipped.push({ employee_id, email, reason: "Missing fields" });
        continue;
      }

      if (existingEmails.has(email) || existingEmpIds.has(employee_id)) {
        skipped.push({ employee_id, email, reason: "Duplicate" });
        continue;
      }

      // ⚡ NO BCRYPT (FAST) — plain password muna
      const defaultPassword = lname.toUpperCase();

      values.push([
        employee_id,
        fname,
        mname,
        lname,
        email,
        defaultPassword, // ⚡ NO HASH muna
        1,
        "faculty",
        0
      ]);

      imported.push({ employee_id, email });
    }

    // ✅ STEP 2: BULK INSERT (VERY FAST)
    if (values.length > 0) {
      await conn.query(
        `INSERT INTO prof_table 
        (employee_id, fname, mname, lname, email, password, status, role, require_otp)
        VALUES ?`,
        [values]
      );
    }

    await conn.commit();

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertFacultyAuditLog({
      req,
      action: "PROFESSOR_ACCOUNT_IMPORT",
      message: `${roleLabel} (${actorId}) imported ${imported.length} professor account(s). Skipped row(s): ${skipped.length}.`,
    });

    res.json({
      success: true,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped,
    });

  } catch (error) {
    if (conn) await conn.rollback();

    console.error("IMPORT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Import failed",
      error: error.message,
    });
  } finally {
    if (conn) conn.release();
  }


});


// ─── Faculty: Password Reset Reminder ───────────────────────────────────────
router.post("/notify_faculty", async (req, res) => {
  const { employee_id, email, password } = req.body;

  let conn;

  try {
    if (!employee_id || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    conn = await db3.getConnection();

    const [prof] = await conn.query(
      `SELECT fname, mname, lname, employee_id
       FROM prof_table
       WHERE employee_id = ?`,
      [employee_id]
    );

    if (prof.length === 0) {
      return res.json({ success: false, message: "Professor not found" });
    }

    const [companyRows] = await db.query(`
      SELECT company_name, short_term FROM company_settings LIMIT 1
    `);

    const company_name = companyRows[0]?.company_name || "Company";
    const short_term   = companyRows[0]?.short_term   || "System";
    const frontendUrl  = process.env.FRONTEND_URL;

    const { fname, mname, lname, employee_id: empId } = prof[0];
    const fullName = `${lname}, ${fname} ${mname || ""}`.trim();

    await transporter.sendMail({
      from:    `"${short_term} — Password Security" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: `${short_term} — Action Required: Change Your Password`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #222;">
          <h2 style="margin-bottom: 4px;">${company_name} Faculty Portal</h2>
          <p style="color: #777; margin-top: 0; font-size: 13px;">Password change reminder</p>

          <p>Hello <strong>${fullName}</strong>,</p>

          <p style="color: #555;">
            This is a reminder that your account is currently using a
            <strong style="color: #222;">temporary password</strong>.
            For the security of your account, you are required to update
            your password as soon as possible.
          </p>

          <table style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px;
                         width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px 16px; font-weight: bold; font-size: 14px;"
                  colspan="2">Account details</td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; width: 40%; font-size: 13px;">Username</td>
              <td style="padding: 6px 16px; font-size: 13px;">
                ${email} / ${empId}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; font-size: 13px;">Temporary password</td>
              <td style="padding: 6px 16px; font-family: monospace; font-size: 13px;">${password}</td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; font-size: 13px;">Account type</td>
              <td style="padding: 6px 16px; font-size: 13px;">Faculty</td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; font-size: 13px;">Status</td>
              <td style="padding: 6px 16px; font-size: 13px;">
                <span style="background: #fff8e1; color: #856404; font-size: 12px;
                              padding: 2px 10px; border-radius: 4px;">
                  Requires password change
                </span>
              </td>
            </tr>
          </table>

          <p style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">
            Steps to change your password
          </p>
          <ol style="color: #555; font-size: 13px; line-height: 2;">
            <li>Go to the login page using the link below</li>
            <li>Log in with your username and temporary password</li>
            <li>You will be prompted to set a new password immediately</li>
            <li>Choose a strong password (min. 8 characters, with letters, numbers, and symbols)</li>
          </ol>

          <div style="border-left: 3px solid #dc3545; padding-left: 12px; margin: 16px 0;">
            <p style="color: #dc3545; font-size: 13px; margin: 0; line-height: 1.6;">
              Do not share your password with anyone. This system will never ask
              for your password via email or phone.
            </p>
          </div>

          <p style="font-size: 13px;">
            Login link:<br/>
            <a href="${frontendUrl}/login" style="color: #0d6efd;">${frontendUrl}/login</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #aaa;">
            If you did not request this or believe this was sent in error, please
            contact the system administrator immediately. Do not reply to this email.
          </p>
        </div>
      `
    });

    res.json({ success: true, message: "Faculty password reset reminder sent" });

  } catch (error) {
    console.error("EMAIL ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
