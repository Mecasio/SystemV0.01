const express = require('express');
const { db, db3 } = require('../database/database');
const {
  CanCreate,
  CanDelete,
  CanEdit,
} = require("../../middleware/pagePermissions");
const { insertAuditLogAdmission } = require("../../utils/auditLogger");

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

const insertEmailTemplateAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogAdmission({
    actorId,
    role: actorRole,
    action,
    message,
    severity: "INFO",
  });
};

const getActorLabel = (req) => {
  const { actorId, actorRole } = getAuditActor(req);
  return {
    actorId,
    roleLabel: formatAuditActorRole(actorRole),
  };
};

const getConfiguredSenderEmails = () =>
  [
    process.env.CCS_EMAIL_USER1,
    process.env.CCS_EMAIL_USER2,
  ]
    .filter(Boolean)
    .map((email) => email.trim().toLowerCase());

const normalizeSenderEmail = (senderEmail) =>
  String(senderEmail || "").trim().toLowerCase();

const isConfiguredSenderEmail = (senderEmail) =>
  getConfiguredSenderEmails().includes(normalizeSenderEmail(senderEmail));

// GET all templates with department name
router.get("/api/email-templates", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT et.*, dpr.dprtmnt_name AS department_name
      FROM email_templates et
      LEFT JOIN enrollment.dprtmnt_table dpr
      ON et.department_id = dpr.dprtmnt_id
      ORDER BY et.updated_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// CREATE template
router.post("/api/email-templates", CanCreate, async (req, res) => {
  try {
    const { sender_name, department_id, employee_id, is_active = 1 } = req.body;
    const senderEmail = normalizeSenderEmail(sender_name);

    if (!senderEmail || !department_id)
      return res
        .status(400)
        .json({ error: "Gmail account and department are required" });

    if (!isConfiguredSenderEmail(senderEmail)) {
      return res.status(400).json({
        error: "Gmail account must match a configured sender email in the backend .env file",
      });
    }

    const [result] = await db.query(
      "INSERT INTO email_templates (sender_name, department_id, employee_id, is_active) VALUES (?,  ?, ?, ?)",
      [senderEmail, department_id, employee_id || null, is_active ? 1 : 0],
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertEmailTemplateAuditLog({
      req,
      action: "EMAIL_TEMPLATE_CREATE",
      message: `${roleLabel} (${actorId}) created email template for ${senderEmail}.`,
    });

    res.status(201).json({ template_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// UPDATE template
router.put("/api/email-templates/:id", CanEdit, async (req, res) => {
  try {
    const { sender_name, department_id, employee_id, is_active } = req.body;
    const senderEmail =
      sender_name === undefined ? undefined : normalizeSenderEmail(sender_name);

    if (senderEmail !== undefined && !senderEmail) {
      return res.status(400).json({ error: "Gmail account is required" });
    }

    if (senderEmail !== undefined && !isConfiguredSenderEmail(senderEmail)) {
      return res.status(400).json({
        error: "Gmail account must match a configured sender email in the backend .env file",
      });
    }

    const [result] = await db.query(
      `UPDATE email_templates
       SET sender_name = COALESCE(?, sender_name),
           department_id = COALESCE(?, department_id),
           employee_id = COALESCE(?, employee_id),
           is_active = COALESCE(?, is_active)
       WHERE template_id = ?`,
      [senderEmail, department_id, employee_id, is_active, req.params.id],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Not found" });

    const templateLabel = senderEmail || `template ID ${req.params.id}`;
    const { actorId, roleLabel } = getActorLabel(req);
    await insertEmailTemplateAuditLog({
      req,
      action: "EMAIL_TEMPLATE_UPDATE",
      message: `${roleLabel} (${actorId}) updated email template ${templateLabel}.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// DELETE template
router.delete("/api/email-templates/:id", CanDelete, async (req, res) => {
  try {
    const [[template]] = await db.query(
      "SELECT sender_name FROM email_templates WHERE template_id = ? LIMIT 1",
      [req.params.id],
    );

    const [result] = await db.query(
      "DELETE FROM email_templates WHERE template_id = ?",
      [req.params.id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Not found" });

    const templateLabel = template?.sender_name || `template ID ${req.params.id}`;
    const { actorId, roleLabel } = getActorLabel(req);
    await insertEmailTemplateAuditLog({
      req,
      action: "EMAIL_TEMPLATE_DELETE",
      message: `${roleLabel} (${actorId}) deleted email template ${templateLabel}.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.get("/api/email-templates/active-senders", async (req, res) => {
  const { department_id } = req.query;
  console.log("Department ID: ", department_id);

  try {
    const [rows] = await db.query(
      "SELECT template_id, sender_name FROM email_templates WHERE is_active = 1 AND department_id = ?",
      [department_id],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active senders" });
  }
});

module.exports = router;
