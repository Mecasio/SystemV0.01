const express = require("express");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { db3 } = require("../database/database");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");

const router = express.Router();

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

const insertResetAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    severity: "INFO",
    message,
  });
};

/* ============================================================
   🔹 REGISTRAR: GET INFO (Search by Employee ID, Name, Email)
============================================================ */
router.post("/superadmin-get-registrar", async (req, res) => {
  const { search } = req.body;

  try {
    const searchTerm = `%${search}%`;

    const [rows] = await db3.query(
      `
      SELECT 
        employee_id,
        first_name,
        middle_name,
        last_name,
        email,
        status
      FROM user_accounts
      WHERE role = 'registrar'
      AND (
        employee_id LIKE ? OR
        first_name LIKE ? OR
        middle_name LIKE ? OR
        last_name LIKE ? OR
        email LIKE ?
      )
      LIMIT 1
      `,
      [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Registrar not found" });
    }

    const r = rows[0];

    const fullName = [r.first_name, r.middle_name, r.last_name]
      .filter(Boolean)
      .join(" ");

    res.json({
      employee_id: r.employee_id,
      email: r.email,
      fullName,
      status: r.status ?? 0,
    });

  } catch (err) {
    console.error("Get registrar error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


/* ============================================================
   🔹 REGISTRAR: RESET PASSWORD
============================================================ */
router.post("/superadmin-reset-registrar", async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db3.query(
      `SELECT email FROM user_accounts WHERE email = ? AND role = 'registrar'`,
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Registrar not found." });
    }

    // Generate random password
    const newPassword = Array.from({ length: 8 }, () =>
      String.fromCharCode(Math.floor(Math.random() * 26) + 65)
    ).join("");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db3.query(
      `UPDATE user_accounts SET password = ? WHERE email = ?`,
      [hashedPassword, email]
    );

    // Get school short term
    const [settings] = await db3.query(
      "SELECT short_term FROM company_settings WHERE id = 1"
    );

    const shortTerm =
      settings.length > 0 && settings[0].short_term
        ? settings[0].short_term
        : "Institution";

    // Email config
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${shortTerm} - Information System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Registrar Password Reset",
      text: `Your new temporary password is: ${newPassword}\n\nPlease change it after logging in.`,
    });

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertResetAuditLog({
      req,
      action: "REGISTRAR_PASSWORD_RESET",
      message: `${roleLabel} (${actorId}) reset password for Registrar (${email}).`,
    });

    res.json({
      success: true,
      message: "Password reset successfully. Email sent.",
    });

  } catch (err) {
    console.error("Reset registrar error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


/* ============================================================
   🔹 REGISTRAR: UPDATE STATUS
============================================================ */
router.post("/superadmin-update-status-registrar", async (req, res) => {
  const { email, status } = req.body;

  try {
    const [result] = await db3.query(
      `UPDATE user_accounts SET status = ? WHERE email = ? AND role='registrar'`,
      [status, email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Registrar not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertResetAuditLog({
      req,
      action: "REGISTRAR_RESET_STATUS_UPDATE",
      message: `${roleLabel} (${actorId}) set Registrar (${email}) to ${Number(status) === 1 ? "Active" : "Inactive"}.`,
    });

    res.json({
      message: "Registrar status updated successfully",
      status,
    });

  } catch (err) {
    console.error("Update registrar status error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


/* ============================================================
   🔹 REGISTRAR: GET ALL REGISTRARS (TABLE)
============================================================ */
router.get("/superadmin-get-all-registrar", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT 
        employee_id,
        CONCAT(first_name,' ',IFNULL(middle_name,''),' ',last_name) AS fullName,
        email,
        status
      FROM user_accounts
      WHERE role = 'registrar'
      ORDER BY first_name ASC
    `);

    res.json(rows);

  } catch (err) {
    console.error("Registrar fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* ============================================================
   🔹 REGISTRAR: SEARCH TABLE CLICK (LIKE EMPLOYEE)
============================================================ */
router.post("/superadmin-get-registrar-row", async (req, res) => {
  const { search } = req.body;
  const term = `%${search}%`;

  const [rows] = await db3.query(`
    SELECT 
      employee_id,
      CONCAT(first_name,' ',IFNULL(middle_name,''),' ',last_name) AS fullName,
      email,
      status
    FROM user_accounts
    WHERE role='registrar'
    AND (
      employee_id LIKE ? OR
      first_name LIKE ? OR
      last_name LIKE ? OR
      email LIKE ?
    )
    LIMIT 1
  `, [term, term, term, term]);

  if (!rows.length) return res.status(404).json({ message: "Not found" });

  res.json(rows[0]);
});


module.exports = router;
