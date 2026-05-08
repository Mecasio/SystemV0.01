const express = require('express');
const multer = require("multer");
const { db, db3 } = require('../database/database');
const {
  CanCreate,
  CanDelete,
  CanEdit,
} = require("../../middleware/pagePermissions");
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

const insertTosfAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
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

router.get("/tosf", async (req, res) => {
  try {
    const [rows] = await db3.query("SELECT * FROM tosf ORDER BY tosf_id");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching data" });
  }
});

router.post("/insert_tosf", CanCreate, async (req, res) => {
  const {
    athletic_fee,
    cultural_fee,
    developmental_fee,
    guidance_fee,
    library_fee,
    medical_and_dental_fee,
    registration_fee,
    school_id_fees,
    nstp_fees,
    computer_fees,
    laboratory_fees,
  } = req.body;

  try {
    const [result] = await db3.query(
      `INSERT INTO tosf (
        athletic_fee,
        cultural_fee,
        developmental_fee,
        guidance_fee,
        library_fee,
        medical_and_dental_fee,
        registration_fee,
        school_id_fees,
        nstp_fees,
        computer_fees,
        laboratory_fees
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        athletic_fee ?? 0,
        cultural_fee ?? 0,
        developmental_fee ?? 0,
        guidance_fee ?? 0,
        library_fee ?? 0,
        medical_and_dental_fee ?? 0,
        registration_fee ?? 0,
        school_id_fees ?? 0,
        nstp_fees ?? 0,
        computer_fees ?? 0,
        laboratory_fees ?? 0,
      ]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "TOSF_CREATE",
      message: `${roleLabel} (${actorId}) created TOSF record ${result.insertId}.`,
    });

    res.json({
      success: true,
      message: "Data Successfully Inserted",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while inserting data" });
  }
});

router.put("/update_tosf/:tosf_id", CanEdit, async (req, res) => {
  const { tosf_id } = req.params;

  const {
    athletic_fee,
    cultural_fee,
    developmental_fee,
    guidance_fee,
    library_fee,
    medical_and_dental_fee,
    registration_fee,
    school_id_fees,
    nstp_fees,
    computer_fees,
    laboratory_fees,
  } = req.body;

  try {
    const [result] = await db3.query(
      `UPDATE tosf SET
        athletic_fee = ?,
        cultural_fee = ?,
        developmental_fee = ?,
        guidance_fee = ?,
        library_fee = ?,
        medical_and_dental_fee = ?,
        registration_fee = ?,
        school_id_fees = ?,
        nstp_fees = ?,
        computer_fees = ?,
        laboratory_fees = ?
      WHERE tosf_id = ?`,
      [
        athletic_fee ?? 0,
        cultural_fee ?? 0,
        developmental_fee ?? 0,
        guidance_fee ?? 0,
        library_fee ?? 0,
        medical_and_dental_fee ?? 0,
        registration_fee ?? 0,
        school_id_fees ?? 0,
        nstp_fees ?? 0,
        computer_fees ?? 0,
        laboratory_fees ?? 0,
        tosf_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "TOSF_UPDATE",
      message: `${roleLabel} (${actorId}) updated TOSF record ${tosf_id}.`,
    });

    res.json({ success: true, message: "Data Successfully Updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating data" });
  }
});

router.delete("/delete_tosf/:tosf_id", CanDelete, async (req, res) => {
  const { tosf_id } = req.params;

  try {
    const [[tosf]] = await db3.query(
      "SELECT tosf_id FROM tosf WHERE tosf_id = ? LIMIT 1",
      [tosf_id]
    );

    const [result] = await db3.query(
      "DELETE FROM tosf WHERE tosf_id = ?",
      [tosf_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "TOSF_DELETE",
      message: `${roleLabel} (${actorId}) deleted TOSF record ${tosf?.tosf_id || tosf_id}.`,
    });

    res.json({ success: true, message: "Data Successfully Deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting data" });
  }
});

router.get("/scholarship_types", async (req, res) => {
  try {
    const [rows] = await db3.query(
      "SELECT id, scholarship_name, rfd, tfd, mfd, nfd, afd, scholarship_status, created_at FROM scholarship_type ORDER BY id DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching scholarship types" });
  }
});

router.post("/insert_scholarship_type", CanCreate, async (req, res) => {
  const { scholarship_name, scholarship_status, created_at } = req.body;

  if (!scholarship_name || !String(scholarship_name).trim()) {
    return res.status(400).json({ message: "scholarship_name is required" });
  }

  try {
    const [maxRow] = await db3.query(
      "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM scholarship_type"
    );
    const nextId = maxRow?.[0]?.next_id || 1;

    await db3.query(
      `INSERT INTO scholarship_type (
        id,
        scholarship_name,
        scholarship_status,
        created_at
      ) VALUES (?, ?, ?, ?)`,
      [
        nextId,
        String(scholarship_name).trim(),
        scholarship_status ?? 1,
        created_at ?? Math.floor(Date.now() / 1000),
      ]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_TYPE_CREATE",
      message: `${roleLabel} (${actorId}) created scholarship type ${String(scholarship_name).trim()}.`,
    });

    res.json({ success: true, message: "Scholarship type inserted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while inserting scholarship type" });
  }
});

router.put("/update_scholarship_type/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const { scholarship_name, rfd, tfd, mfd, nfd, afd, scholarship_status } = req.body;

  if (!scholarship_name || !String(scholarship_name).trim()) {
    return res.status(400).json({ message: "scholarship_name is required" });
  }

  try {
    const [result] = await db3.query(
      `UPDATE scholarship_type
       SET scholarship_name = ?, rfd = ?, tfd = ?, mfd = ?, nfd = ?, afd = ?, scholarship_status = ?
       WHERE id = ?`,
      [
        String(scholarship_name).trim(),
        rfd ?? 0,
        tfd ?? 0,
        mfd ?? 0,
        nfd ?? 0,
        afd ?? 0,
        scholarship_status ?? 1,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Scholarship type not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_TYPE_UPDATE",
      message: `${roleLabel} (${actorId}) updated scholarship type ${String(scholarship_name).trim()}.`,
    });

    res.json({ success: true, message: "Scholarship type updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating scholarship type" });
  }
});

router.delete("/delete_scholarship_type/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [[scholarshipType]] = await db3.query(
      "SELECT scholarship_name FROM scholarship_type WHERE id = ? LIMIT 1",
      [id]
    );

    const [result] = await db3.query(
      "DELETE FROM scholarship_type WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Scholarship type not found" });
    }

    const scholarshipLabel = scholarshipType?.scholarship_name || `scholarship type ID ${id}`;
    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_TYPE_DELETE",
      message: `${roleLabel} (${actorId}) deleted scholarship type ${scholarshipLabel}.`,
    });

    res.json({ success: true, message: "Scholarship type deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting scholarship type" });
  }
});

module.exports = router;
