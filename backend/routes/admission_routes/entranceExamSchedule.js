const express = require("express");
const { db, db3 } = require("../database/database");
const {
  insertAuditLogAdmission,
} = require("../../utils/auditLogger");

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

const formatEntranceExamScheduleLabel = (schedule) => {
  if (!schedule) return "Unknown schedule";

  return `Schedule ${schedule.schedule_id || "New"} (${schedule.day_description}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
};

const insertEntranceExamScheduleAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogAdmission({
    actorId,
    role: actorRole,
    action,
    severity: "INFO",
    message,
  });
};

const getEntranceExamScheduleLabel = async (scheduleId) => {
  if (!scheduleId) return "No schedule";

  const [rows] = await db.query(
    `SELECT schedule_id, day_description, building_description, room_description, start_time, end_time
     FROM entrance_exam_schedule
     WHERE schedule_id = ?
     LIMIT 1`,
    [scheduleId],
  );

  const schedule = rows?.[0];
  if (!schedule) return `Schedule ${scheduleId}`;

  return `Schedule ${schedule.schedule_id} (${schedule.day_description}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
};

// ================== INSERT EXAM SCHEDULE ==================
router.post("/insert_exam_schedule", async (req, res) => {
  try {
    const {
      branch,
      day_description,
      building_description,
      room_description,
      start_time,
      end_time,
      proctor,
      room_quota,
      active_school_year_id,
    } = req.body;

    // Check for conflicts
    const [conflicts] = await db.query(
      `SELECT * 
       FROM entrance_exam_schedule 
       WHERE branch = ?
         AND day_description = ?
         AND building_description = ?
         AND room_description = ?
         AND active_school_year_id = ?
         AND (
              (start_time < ? AND end_time > ?) OR
              (start_time < ? AND end_time > ?) OR
              (start_time >= ? AND end_time <= ?)
         )`,
      [
        branch,
        day_description,
        building_description,
        room_description,
        active_school_year_id,
        end_time, start_time,
        end_time, start_time,
        start_time, end_time,
      ]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({ error: "⚠️ Room already exists for this branch on this date." });
    }

    // Insert new schedule
    const [insertResult] = await db.query(
      `INSERT INTO entrance_exam_schedule
         (branch, day_description, building_description, room_description,
           start_time, end_time, proctor, room_quota, active_school_year_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [branch, day_description, building_description, room_description,
        start_time, end_time, proctor, room_quota, active_school_year_id]
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertEntranceExamScheduleAuditLog({
      req,
      action: "ENTRANCE_EXAM_SCHEDULE_CREATE",
      message: `${roleLabel} (${actorId}) created entrance examination ${formatEntranceExamScheduleLabel({
        schedule_id: insertResult.insertId,
        day_description,
        building_description,
        room_description,
        start_time,
        end_time,
      })}. Proctor: ${proctor || "N/A"}. Room quota: ${room_quota}.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== UPDATE EXAM SCHEDULE ==================
router.put("/update_exam_schedule/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      branch,
      day_description,
      building_description,
      room_description,
      start_time,
      end_time,
      proctor,
      room_quota,
      active_school_year_id
    } = req.body;

    // Check for conflicts excluding current schedule
    const [conflicts] = await db.query(
      `SELECT * FROM entrance_exam_schedule
       WHERE schedule_id != ?
         AND branch = ?
         AND day_description = ?
         AND building_description = ?
         AND room_description = ?
         AND active_school_year_id = ?
         AND (
              (start_time < ? AND end_time > ?) OR
              (start_time < ? AND end_time > ?) OR
              (start_time >= ? AND end_time <= ?)
         )`,
      [
        id,
        branch,
        day_description,
        building_description,
        room_description,
        active_school_year_id,
        end_time, start_time,
        end_time, start_time,
        start_time, end_time,
      ]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({ error: "⚠️ Conflict: Room already booked." });
    }

    const [[scheduleBefore]] = await db.query(
      "SELECT * FROM entrance_exam_schedule WHERE schedule_id = ? LIMIT 1",
      [id],
    );

    if (!scheduleBefore) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Update schedule
    await db.query(
      `UPDATE entrance_exam_schedule
       SET branch=?, day_description=?, building_description=?, room_description=?,
           start_time=?, end_time=?, proctor=?, room_quota=?, active_school_year_id = ?
       WHERE schedule_id=?`,
      [branch, day_description, building_description, room_description,
       start_time, end_time, proctor, room_quota, active_school_year_id, id]
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertEntranceExamScheduleAuditLog({
      req,
      action: "ENTRANCE_EXAM_SCHEDULE_UPDATE",
      message: `${roleLabel} (${actorId}) updated entrance examination ${formatEntranceExamScheduleLabel(scheduleBefore)} to ${formatEntranceExamScheduleLabel({
        schedule_id: id,
        day_description,
        building_description,
        room_description,
        start_time,
        end_time,
      })}. Proctor: ${proctor || "N/A"}. Room quota: ${room_quota}.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ================== DELETE EXAM SCHEDULE ==================
router.delete("/delete_exam_schedule/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[scheduleBefore]] = await db.query(
      "SELECT * FROM entrance_exam_schedule WHERE schedule_id = ? LIMIT 1",
      [id],
    );

    const [result] = await db.query(
      `DELETE FROM entrance_exam_schedule WHERE schedule_id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertEntranceExamScheduleAuditLog({
      req,
      action: "ENTRANCE_EXAM_SCHEDULE_DELETE",
      message: `${roleLabel} (${actorId}) deleted entrance examination ${formatEntranceExamScheduleLabel(scheduleBefore)}.`,
    });

    res.json({ success: true, message: "Schedule deleted successfully ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ================== GET SCHEDULES WITH COUNT ==================
// ================== GET SCHEDULES WITH COUNT ==================
router.get("/exam_schedules_with_count", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.schedule_id,
        s.branch,
        s.day_description,
        s.building_description,
        s.room_description,
        s.start_time,
        s.end_time,
        s.proctor,
        s.room_quota,
        COUNT(ea.applicant_id) AS current_occupancy,
        (s.room_quota - COUNT(ea.applicant_id)) AS remaining_slots
      FROM admission.entrance_exam_schedule s
      LEFT JOIN admission.exam_applicants ea
        ON ea.schedule_id = s.schedule_id
      LEFT JOIN enrollment.active_school_year_table sy ON s.active_school_year_id = sy.id
      WHERE sy.astatus = 1
      GROUP BY s.schedule_id
      ORDER BY s.day_description, s.start_time
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching schedules with count:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== GET SCHEDULES BY YEAR AND SEMESTER ==================
router.get("/exam_schedules_with_count/:yearId/:semesterId", async (req, res) => {
  const { yearId, semesterId } = req.params;
  const { branch } = req.query;

  const queryParams = [yearId, semesterId];
  let branchClause = "";

  if (branch) {
    branchClause = " AND ees.branch = ?";
    queryParams.push(branch);
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        ees.schedule_id,
        ees.branch,
        ees.day_description,
        ees.building_description,
        ees.room_description,
        ees.start_time,
        ees.end_time,
        ees.proctor,
        ees.room_quota,
        ees.created_at,
        sy.year_id,
        sy.semester_id,
        SUBSTRING(ea.applicant_id, 5, 1) AS middle_code,
        COUNT(ea.applicant_id) AS current_occupancy
      FROM admission.entrance_exam_schedule ees
      JOIN enrollment.active_school_year_table sy ON ees.active_school_year_id = sy.id
      LEFT JOIN admission.exam_applicants ea
        ON ees.schedule_id = ea.schedule_id
      WHERE sy.year_id = ? AND sy.semester_id = ?${branchClause}
      GROUP BY ees.schedule_id
      ORDER BY ees.day_description, ees.start_time;
    `,
      queryParams
    );

    res.json(rows);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server error");
  }
});

// ================== UNASSIGN ALL APPLICANTS FROM A SCHEDULE ==================
router.post("/unassign_all_from_schedule", async (req, res) => {
  const { schedule_id, audit_actor_id, audit_actor_role } = req.body;
  try {
    const [assignedRows] = await db.query(
      "SELECT applicant_id FROM exam_applicants WHERE schedule_id = ?",
      [schedule_id],
    );
    const scheduleLabel = await getEntranceExamScheduleLabel(schedule_id);

    await db.execute(
      "UPDATE exam_applicants SET schedule_id = NULL WHERE schedule_id = ?",
      [schedule_id]
    );

    if (assignedRows.length > 0) {
      const safeActor = audit_actor_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role);
      const applicants = assignedRows.map((row) => row.applicant_id).join(", ");

      await insertAuditLogAdmission({
        actorId: safeActor,
        role: audit_actor_role || "registrar",
        action: "ENTRANCE_EXAM_SCHEDULE_UNASSIGN",
        severity: "INFO",
        message: `${roleLabel} (${safeActor}) unassigned ${assignedRows.length} applicant(s) from entrance examination ${scheduleLabel}. Applicant(s): ${applicants}.`,
      });
    }

    res.json({
      success: true,
      message: `All applicants unassigned from schedule ${schedule_id}`,
    });
  } catch (err) {
    console.error("Error unassigning all applicants:", err);
    res.status(500).json({ error: "Failed to unassign all applicants" });
  }
});

// ================== UNASSIGN SINGLE APPLICANT ==================
router.post("/unassign_schedule", async (req, res) => {
  const { applicant_number, audit_actor_id, audit_actor_role } = req.body;

  if (!applicant_number) {
    return res.status(400).json({ error: "Applicant number is required." });
  }

  try {
    const [[assignedBefore]] = await db.query(
      "SELECT schedule_id FROM exam_applicants WHERE applicant_id = ? LIMIT 1",
      [applicant_number],
    );
    const scheduleLabel = await getEntranceExamScheduleLabel(
      assignedBefore?.schedule_id,
    );

    const [result] = await db.query(
      `DELETE FROM admission.exam_applicants WHERE applicant_id = ?`,
      [applicant_number]
    );

    if (result.affectedRows > 0) {
      const safeActor = audit_actor_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role);

      await insertAuditLogAdmission({
        actorId: safeActor,
        role: audit_actor_role || "registrar",
        action: "ENTRANCE_EXAM_SCHEDULE_UNASSIGN",
        severity: "INFO",
        message: `${roleLabel} (${safeActor}) unassigned Applicant (${applicant_number}) from entrance examination ${scheduleLabel}.`,
      });

      res.json({
        success: true,
        message: `Applicant ${applicant_number} unassigned.`,
      });
    } else {
      res.status(404).json({ error: "Applicant not found or not assigned." });
    }
  } catch (err) {
    console.error("Error unassigning schedule:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
