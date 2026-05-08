const express = require("express");
const { db } = require("../database/database");
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

const insertSubjectAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogAdmission({
    actorId,
    role: actorRole,
    action,
    severity: "INFO",
    message,
  });
};

//////////////////////////////////////////////////////////////
// GET ALL SUBJECTS
//////////////////////////////////////////////////////////////
router.get("/api/subjects", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM subjects
      ORDER BY id ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

//////////////////////////////////////////////////////////////
// GET ACTIVE SUBJECTS ONLY
//////////////////////////////////////////////////////////////
router.get("/api/subjects/active", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM subjects
      WHERE is_active = 1
      ORDER BY id ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active subjects" });
  }
});

//////////////////////////////////////////////////////////////
// CREATE SUBJECT
//////////////////////////////////////////////////////////////
router.post("/api/subjects", async (req, res) => {
  try {
    const { name, max_score } = req.body;

    if (!name || !max_score) {
      return res.status(400).json({
        error: "Name and max_score are required"
      });
    }

    const [result] = await db.query(`
      INSERT INTO subjects (name, max_score, is_active, created_at)
      VALUES (?, ?, 1, NOW())
    `, [name, max_score]);

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertSubjectAuditLog({
      req,
      action: "APPLICANT_EXAM_SUBJECT_CREATE",
      message: `${roleLabel} (${actorId}) created applicant exam subject ${name}. Max score: ${max_score}.`,
    });

    res.json({
      success: true,
      id: result.insertId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

//////////////////////////////////////////////////////////////
// UPDATE SUBJECT
//////////////////////////////////////////////////////////////
router.put("/api/subjects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, max_score, is_active } = req.body;

    const [[subjectBefore]] = await db.query(
      "SELECT * FROM subjects WHERE id = ? LIMIT 1",
      [id],
    );

    if (!subjectBefore) {
      return res.status(404).json({ error: "Subject not found" });
    }

    await db.query(`
      UPDATE subjects
      SET
        name = ?,
        max_score = ?,
        is_active = ?
      WHERE id = ?
    `, [name, max_score, is_active, id]);

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertSubjectAuditLog({
      req,
      action: "APPLICANT_EXAM_SUBJECT_UPDATE",
      message: `${roleLabel} (${actorId}) updated applicant exam subject ${subjectBefore.name} to ${name}. Max score: ${subjectBefore.max_score} to ${max_score}. Status: ${Number(subjectBefore.is_active) === 1 ? "Active" : "Inactive"} to ${Number(is_active) === 1 ? "Active" : "Inactive"}.`,
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update subject" });
  }
});

//////////////////////////////////////////////////////////////
// DELETE SUBJECT (SOFT DELETE)
//////////////////////////////////////////////////////////////
router.delete("/api/subjects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[subjectBefore]] = await db.query(
      "SELECT * FROM subjects WHERE id = ? LIMIT 1",
      [id],
    );

    if (!subjectBefore) {
      return res.status(404).json({ error: "Subject not found" });
    }

    await db.query(`
      UPDATE subjects
      SET is_active = 0
      WHERE id = ?
    `, [id]);

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertSubjectAuditLog({
      req,
      action: "APPLICANT_EXAM_SUBJECT_DELETE",
      message: `${roleLabel} (${actorId}) set applicant exam subject ${subjectBefore.name} to inactive.`,
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

router.post("/api/exam/submit", async (req, res) => {
  try {
    const { applicant_id, answers } = req.body;

    for (const subject_id in answers) {
      await db.query(`
        INSERT INTO exam_results (applicant_id, subject_id, score)
        VALUES (?, ?, ?)
      `, [applicant_id, subject_id, answers[subject_id]]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit exam" });
  }
});

module.exports = router;
