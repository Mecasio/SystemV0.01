const express = require("express");
const { db, db3 } = require("../database/database");
const {
  insertAuditLogAdmission,
  insertAuditLogEnrollment,
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

const formatInterviewScheduleLabel = (schedule) => {
  if (!schedule) return "Unknown schedule";

  return `Schedule ${schedule.schedule_id || "New"} (${schedule.day_description}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
};

const insertInterviewScheduleAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogAdmission({
    actorId,
    role: actorRole,
    action,
    severity: "INFO",
    message,
  });
};

const getInterviewScheduleLabel = async (scheduleId) => {
  if (!scheduleId) return "No schedule";

  const [rows] = await db.query(
    `SELECT schedule_id, day_description, building_description, room_description, start_time, end_time
     FROM interview_exam_schedule
     WHERE schedule_id = ?
     LIMIT 1`,
    [scheduleId],
  );

  const schedule = rows?.[0];
  if (!schedule) return `Schedule ${scheduleId}`;

  return `Schedule ${schedule.schedule_id} (${schedule.day_description}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
};

const resolveActiveSchoolYearId = async (providedId) => {
  if (providedId) {
    return providedId;
  }

  const [activeRows] = await db3.query(
    "SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1",
  );

  return activeRows[0]?.id || null;
};

// ================== INSERT INTERVIEW SCHEDULE ==================
router.post("/insert_interview_schedule", async (req, res) => {
  try {
    const {
      branch, // ✅ ADDED
      day_description,
      building_description,
      room_description,
      start_time,
      end_time,
      interviewer,
      room_quota,
      active_school_year_id, // optional if needed
    } = req.body;

    const resolvedActiveSchoolYearId =
      await resolveActiveSchoolYearId(active_school_year_id);

    // Check conflicts for the same branch, building, room, and overlapping time
    const [conflicts] = await db.query(
      `SELECT *
       FROM interview_exam_schedule
       WHERE branch = ?
         AND day_description = ?
         AND building_description = ?
         AND room_description = ?
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
        end_time, start_time,
        end_time, start_time,
        start_time, end_time,
      ]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({ error: "⚠️ Conflict: Room already booked for this branch." });
    }

    const [insertResult] = await db.query(
      `INSERT INTO interview_exam_schedule
       (branch, day_description, building_description, room_description, start_time, end_time, interviewer, room_quota, active_school_year_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branch,
        day_description,
        building_description,
        room_description,
        start_time,
        end_time,
        interviewer,
        room_quota,
        resolvedActiveSchoolYearId,
      ]
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertInterviewScheduleAuditLog({
      req,
      action: "QUALIFYING_INTERVIEW_SCHEDULE_CREATE",
      message: `${roleLabel} (${actorId}) created qualifying/interview ${formatInterviewScheduleLabel({
        schedule_id: insertResult.insertId,
        day_description,
        building_description,
        room_description,
        start_time,
        end_time,
      })}. Interviewer: ${interviewer || "N/A"}. Room quota: ${room_quota}.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("INSERT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== UPDATE INTERVIEW SCHEDULE ==================
router.put("/update_interview_schedule/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      branch, // ✅ ADDED
      day_description,
      building_description,
      room_description,
      start_time,
      end_time,
      interviewer,
      room_quota,
      active_school_year_id,
    } = req.body;

    const resolvedActiveSchoolYearId =
      await resolveActiveSchoolYearId(active_school_year_id);

    const [conflicts] = await db.query(
      `SELECT schedule_id
       FROM interview_exam_schedule
       WHERE schedule_id != ?
         AND branch = ?
         AND day_description = ?
         AND building_description = ?
         AND room_description = ?
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
        end_time, start_time,
        end_time, start_time,
        start_time, end_time,
      ]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({ error: "⚠️ Conflict detected for this branch." });
    }

    const [[scheduleBefore]] = await db.query(
      "SELECT * FROM interview_exam_schedule WHERE schedule_id = ? LIMIT 1",
      [id],
    );

    if (!scheduleBefore) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    await db.query(
      `UPDATE interview_exam_schedule
       SET branch = ?,
           day_description = ?,
           building_description = ?,
           room_description = ?,
           start_time = ?,
           end_time = ?,
           interviewer = ?,
           room_quota = ?,
           active_school_year_id = ?
       WHERE schedule_id = ?`,
      [
        branch,
        day_description,
        building_description,
        room_description,
        start_time,
        end_time,
        interviewer,
        room_quota,
        resolvedActiveSchoolYearId,
        id,
      ]
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertInterviewScheduleAuditLog({
      req,
      action: "QUALIFYING_INTERVIEW_SCHEDULE_UPDATE",
      message: `${roleLabel} (${actorId}) updated qualifying/interview ${formatInterviewScheduleLabel(scheduleBefore)} to ${formatInterviewScheduleLabel({
        schedule_id: id,
        day_description,
        building_description,
        room_description,
        start_time,
        end_time,
      })}. Interviewer: ${interviewer || "N/A"}. Room quota: ${room_quota}.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ================== DELETE INTERVIEW SCHEDULE ==================
router.delete("/delete_interview_schedule/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[scheduleBefore]] = await db.query(
      "SELECT * FROM interview_exam_schedule WHERE schedule_id = ? LIMIT 1",
      [id],
    );

    const [result] = await db.query(
      "DELETE FROM interview_exam_schedule WHERE schedule_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertInterviewScheduleAuditLog({
      req,
      action: "QUALIFYING_INTERVIEW_SCHEDULE_DELETE",
      message: `${roleLabel} (${actorId}) deleted qualifying/interview ${formatInterviewScheduleLabel(scheduleBefore)}.`,
    });

    res.json({ success: true, message: "Schedule deleted successfully ✅" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET: interview schedules with applicant count, filtered by department if needed
router.get(
  "/interview_schedules_with_count/:yearId/:semesterId",
  async (req, res) => {
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
        ees.interviewer,
        ees.room_quota,
        ees.created_at,
        COALESCE(sy.year_id, current_sy.year_id) AS year_id,
        COALESCE(sy.semester_id, current_sy.semester_id) AS semester_id,
        COUNT(ea.applicant_id) AS current_occupancy
      FROM admission.interview_exam_schedule ees
      LEFT JOIN enrollment.active_school_year_table sy
        ON ees.active_school_year_id = sy.id
      LEFT JOIN enrollment.active_school_year_table current_sy
        ON current_sy.astatus = 1
      LEFT JOIN admission.interview_applicants ea
        ON ees.schedule_id = ea.schedule_id
      WHERE COALESCE(sy.year_id, current_sy.year_id) = ?
        AND COALESCE(sy.semester_id, current_sy.semester_id) = ?${branchClause}
      GROUP BY ees.schedule_id
      ORDER BY ees.day_description, ees.start_time;
    `,
        queryParams,
      );

      res.json(rows);
    } catch (err) {
      console.error("Interview Schedule Error:", err);
      res.status(500).send("Server error");
    }
  },
);

// 2. Get all interview schedules
router.get("/interview_schedules", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM interview_exam_schedule
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching interview schedules:", err);
    res.status(500).json({ error: "Failed to fetch interview schedules" });
  }
});

router.get("/interview_schedules_with_count", async (req, res) => {
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
        s.interviewer,
        s.room_quota,
        IFNULL(COUNT(ia.applicant_id), 0) AS current_occupancy,
        (s.room_quota - IFNULL(COUNT(ia.applicant_id), 0)) AS remaining_slots
      FROM interview_exam_schedule s
      LEFT JOIN interview_applicants ia
        ON s.schedule_id = ia.schedule_id
      GROUP BY
        s.schedule_id,
        s.day_description,
        s.building_description,
        s.room_description,
        s.start_time,
        s.end_time,
        s.interviewer,
        s.room_quota
      HAVING remaining_slots > 0      -- ✅ auto-hide full rooms
      ORDER BY s.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching interview schedules with count:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch interview schedules with count" });
  }
});
// 4. Unassign one applicant
router.post("/unassign_interview", async (req, res) => {
  const { applicant_number, audit_actor_id, audit_actor_role } = req.body;
  try {
    const [[assignedBefore]] = await db.query(
      "SELECT schedule_id FROM interview_applicants WHERE applicant_id = ? LIMIT 1",
      [applicant_number],
    );
    const scheduleLabel = await getInterviewScheduleLabel(
      assignedBefore?.schedule_id,
    );

    await db.query(
      `UPDATE interview_applicants
       SET schedule_id = NULL
       WHERE applicant_id = ?`,
      [applicant_number],
    );

    if (assignedBefore?.schedule_id) {
      const safeActor = audit_actor_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role);

      await insertAuditLogEnrollment({
        actorId: safeActor,
        role: audit_actor_role || "registrar",
        action: "QUALIFYING_INTERVIEW_SCHEDULE_UNASSIGN",
        severity: "INFO",
        message: `${roleLabel} (${safeActor}) unassigned Applicant (${applicant_number}) from qualifying/interview ${scheduleLabel}.`,
      });
    }

    res.json({
      success: true,
      message: `Applicant ${applicant_number} unassigned.`,
    });
  } catch (err) {
    console.error("❌ Error unassigning interview applicant:", err);
    res.status(500).json({ error: "Failed to unassign applicant." });
  }
});

// 5. Unassign ALL applicants
router.post("/unassign_all_from_interview", async (req, res) => {
  const { schedule_id, audit_actor_id, audit_actor_role } = req.body;
  try {
    const [assignedRows] = await db.query(
      "SELECT applicant_id FROM interview_applicants WHERE schedule_id = ?",
      [schedule_id],
    );
    const scheduleLabel = await getInterviewScheduleLabel(schedule_id);

    await db.query(
      `UPDATE interview_applicants
       SET schedule_id = NULL
       WHERE schedule_id = ?`,
      [schedule_id],
    );

    if (assignedRows.length > 0) {
      const safeActor = audit_actor_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role);
      const applicants = assignedRows.map((row) => row.applicant_id).join(", ");

      await insertAuditLogEnrollment({
        actorId: safeActor,
        role: audit_actor_role || "registrar",
        action: "QUALIFYING_INTERVIEW_SCHEDULE_UNASSIGN",
        severity: "INFO",
        message: `${roleLabel} (${safeActor}) unassigned ${assignedRows.length} applicant(s) from qualifying/interview ${scheduleLabel}. Applicant(s): ${applicants}.`,
      });
    }

    res.json({
      success: true,
      message: `All applicants unassigned from schedule ${schedule_id}.`,
    });
  } catch (err) {
    console.error("❌ Error unassigning all interview applicants:", err);
    res.status(500).json({ error: "Failed to unassign all applicants." });
  }
});

router.put("/api/interview_applicants/assign", async (req, res) => {
  const { applicant_numbers } = req.body;
  console.log(applicant_numbers);

  if (!Array.isArray(applicant_numbers) || applicant_numbers.length === 0) {
    return res.status(400).json({ message: "No applicant numbers provided" });
  }

  try {
    const [result] = await db3.query(
      `UPDATE admission.interview_applicants
       SET status = 'Accepted'
       WHERE applicant_id IN (?)`,
      [applicant_numbers],
    );

    res.json({
      message: `Updated ${result.affectedRows} applicants to Accepted.`,
      updated: applicant_numbers,
    });
  } catch (err) {
    console.error("Error accepting applicants:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/api/interview_applicants/assign/:applicant_number",
  async (req, res) => {
    const { applicant_number } = req.params;

    if (!applicant_number) {
      return res.status(400).json({ message: "Missing applicant_number" });
    }

    try {
      const [result] = await db3.query(
        `UPDATE admission.interview_applicants
       SET status = 'Accepted'
       WHERE applicant_id = ?`,
        [applicant_number],
      );

      res.json({
        message: `Applicant ${applicant_number} updated to Accepted.`,
        affectedRows: result.affectedRows,
      });
    } catch (err) {
      console.error("Error accepting applicant:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.put(
  "/api/interview_applicants/unassign/:applicant_number",
  async (req, res) => {
    const { applicant_number } = req.params;

    if (!applicant_number) {
      return res.status(400).json({ message: "Missing applicant_number" });
    }

    try {
      const [result] = await db3.query(
        `UPDATE admission.interview_applicants
       SET status = 'Waiting List'
       WHERE applicant_id = ?`,
        [applicant_number],
      );

      res.json({
        message: `Applicant ${applicant_number} updated to Accepted.`,
        affectedRows: result.affectedRows,
      });
    } catch (err) {
      console.error("Error accepting applicant:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.put("/api/interview_applicants/unassign-all", async (req, res) => {
  const { applicant_numbers } = req.body;
  console.log(applicant_numbers);

  if (!Array.isArray(applicant_numbers) || applicant_numbers.length === 0) {
    return res.status(400).json({ message: "No applicant numbers provided" });
  }

  try {
    const [result] = await db3.query(
      `UPDATE admission.interview_applicants
       SET status = 'Waiting List'
       WHERE applicant_id IN (?)`,
      [applicant_numbers],
    );

    res.json({
      message: `Updated ${result.affectedRows} applicants to Accepted.`,
      updated: applicant_numbers,
    });
  } catch (err) {
    console.error("Error accepting applicants:", err);
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;
