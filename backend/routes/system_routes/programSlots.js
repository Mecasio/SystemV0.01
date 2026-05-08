const express = require("express");
const { db, db3 } = require("../database/database");
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

const insertProgramSlotAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogAdmission({
    actorId,
    role: actorRole,
    action,
    severity: "INFO",
    message,
  });
};

const getProgramSlotLabel = async (curriculumId) => {
  const [rows] = await db3.query(
    `SELECT p.program_code, p.program_description, p.major
     FROM curriculum_table ct
     LEFT JOIN program_table p ON p.program_id = ct.program_id
     WHERE ct.curriculum_id = ?
     LIMIT 1`,
    [curriculumId],
  );

  const program = rows?.[0];
  if (!program) return `Curriculum ${curriculumId}`;

  return `${program.program_code || "N/A"} - ${program.program_description || "Unknown Program"}${program.major ? ` (${program.major})` : ""}`;
};

const memoryCache = {
  data: new Map(),
  set(key, value, ttlMs = 80000) {
    // 3 min default
    this.data.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  },
  get(key) {
    const item = this.data.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  },
  clear() {
    this.data.clear();
  },
};

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.data.entries()) {
    if (now > item.expires) {
      memoryCache.data.delete(key);
    }
  }
}, 1000000);

router.get("/programs/availability", async (req, res) => {
  const { year_id, semester_id } = req.query;

  try {
    if (!year_id || !semester_id) {
      return res
        .status(400)
        .json({ message: "Missing year_id or semester_id" });
    }

    // Check cache first
    const cacheKey = `prog_${year_id}_${semester_id}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Parallel query execution
    const [activeResult, programsResult] = await Promise.all([
      db3.query(
        "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ? LIMIT 1",
        [year_id, semester_id],
      ),
      db3.query(`
        SELECT 
          dc.dprtmnt_curriculum_id,
          dc.dprtmnt_id,
          dc.curriculum_id,
          dt.dprtmnt_name,
          dt.dprtmnt_code,
          ct.year_id,
          y.year_description,
          ct.program_id,
          p.program_description,
          p.program_code,
          p.major,
          p.components
        FROM dprtmnt_curriculum_table dc
        INNER JOIN dprtmnt_table dt ON dc.dprtmnt_id = dt.dprtmnt_id
        INNER JOIN curriculum_table ct ON dc.curriculum_id = ct.curriculum_id
        INNER JOIN program_table p ON ct.program_id = p.program_id
        INNER JOIN year_table y ON ct.year_id = y.year_id
        WHERE ct.lock_status = 1
        ORDER BY dt.dprtmnt_name, p.program_description
      `),
    ]);

    const activeSchoolYearId = activeResult[0][0]?.id;

    if (!activeSchoolYearId) {
      return res.json([]);
    }

    const programs = programsResult[0];

    if (programs.length === 0) {
      const emptyResult = [];
      memoryCache.set(cacheKey, emptyResult);
      return res.json(emptyResult);
    }

    // Extract curriculum IDs efficiently
    const curriculumIds = programs.map((p) => p.curriculum_id);

    // Parallel fetch slots and enrollment data
    const [slotsResult, enrollmentResult] = await Promise.all([
      db.query(
        `SELECT curriculum_id, max_slots, active_school_year_id
         FROM program_slots 
         WHERE curriculum_id IN (?) AND active_school_year_id = ?`,
        [curriculumIds, activeSchoolYearId],
      ),
      db3.query(
        `SELECT curriculum_id, COUNT(DISTINCT student_number) as total_enrolled
         FROM enrollment.enrolled_subject es
         WHERE curriculum_id IN (?)
           AND active_school_year_id = ?
           AND EXISTS (
             SELECT 1 FROM enrollment.student_status_table sts
             WHERE sts.student_number = es.student_number 
             AND sts.year_level_id = 1
           )
         GROUP BY curriculum_id`,
        [curriculumIds, activeSchoolYearId],
      ),
    ]);

    const slots = slotsResult[0];
    const enrollment = enrollmentResult[0];

    // Build lookup objects (faster than Map for small datasets, no extra dependency)
    const slotsLookup = {};
    for (let i = 0; i < slots.length; i++) {
      slotsLookup[slots[i].curriculum_id] = slots[i];
    }

    const enrollmentLookup = {};
    for (let i = 0; i < enrollment.length; i++) {
      enrollmentLookup[enrollment[i].curriculum_id] = Number(
        enrollment[i].total_enrolled,
      );
    }

    // Merge data efficiently using plain object spread
    const results = new Array(programs.length);
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      const slot = slotsLookup[p.curriculum_id];
      const maxSlots = slot?.max_slots || 0;
      const totalEnrolled = enrollmentLookup[p.curriculum_id] || 0;

      results[i] = {
        dprtmnt_curriculum_id: p.dprtmnt_curriculum_id,
        dprtmnt_id: p.dprtmnt_id,
        curriculum_id: p.curriculum_id,
        dprtmnt_name: p.dprtmnt_name,
        dprtmnt_code: p.dprtmnt_code,
        ct_curriculum_id: p.curriculum_id,
        year_id: p.year_id,
        year_description: p.year_description,
        program_id: p.program_id,
        lock_status: 1,
        program_description: p.program_description,
        program_code: p.program_code,
        major: p.major,
        components: p.components,
        active_school_year_id:
          slot?.active_school_year_id || activeSchoolYearId,
        max_slots: maxSlots,
        total_enrolled: totalEnrolled,
        remaining: maxSlots - totalEnrolled > 0 ? maxSlots - totalEnrolled : 0,
      };
    }

    // Cache the results
    memoryCache.set(cacheKey, results);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch program availability" });
  }
});

router.post("/apply", async (req, res) => {
  console.log("apply route body:", req.body);
  const { curriculum_id, year_id, person_id } = req.body;

  // Use db pool instead of undefined pool
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Prevent double application
    const [[alreadyapplied]] = await connection.query(
      `
  SELECT program
  FROM admission.person_table
  WHERE person_id = ?
    AND program IS NOT NULL
`,
      [person_id],
    );

    if (alreadyapplied) {
      await connection.rollback();
      return res.json({
        message: "You have already applied to a program",
        alreadyapplied: true,
        curriculum_id: alreadyapplied.program, // optional
      });
    }

    // Lock slot row
    const [[slot]] = await connection.query(
      `
      SELECT 
        ps.max_slots,
        COUNT(DISTINCT pt.person_id) AS used_slots
      FROM enrollment.curriculum_table c
      JOIN admission.program_slots ps
        ON ps.curriculum_id = c.curriculum_id
      LEFT JOIN admission.person_table pt
        ON pt.program = c.curriculum_id
      WHERE c.curriculum_id = ?
      FOR UPDATE
    `,
      [curriculum_id],
    );

    if (!slot) {
      await connection.rollback();
      return res.status(400).json({
        message: "Program slot not configured",
      });
    }

    if (slot.used_slots >= slot.max_slots) {
      await connection.rollback();
      return res.status(403).json({
        message: "This program is already full",
      });
    }

    // Assign program
    await connection.query(
      `
      UPDATE admission.person_table
      SET program = ?
      WHERE person_id = ?
    `,
      [curriculum_id, person_id],
    );

    await connection.commit();
    res.json({ message: "application submitted successfully" });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: "application failed" });
  } finally {
    connection.release();
  }
});

router.post("/program-slots", async (req, res) => {
  const { curriculum_id, max_slots, year_id, semester_id } = req.body;

  if (!curriculum_id || !max_slots || !year_id || !semester_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [activeRows] = await db3.query(
      "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ? LIMIT 1",
      [year_id, semester_id],
    );
    const activeSchoolYearId = activeRows[0]?.id;

    if (!activeSchoolYearId) {
      return res
        .status(400)
        .json({ message: "Active school year not found for selection" });
    }

    // check if already exists
    const [[existing]] = await db.query(
      `
      SELECT slot_id
      FROM admission.program_slots
      WHERE curriculum_id = ? AND active_school_year_id = ?
    `,
      [curriculum_id, activeSchoolYearId],
    );

    if (existing) {
      // UPDATE
      await db.query(
        `
        UPDATE admission.program_slots
        SET max_slots = ?
        WHERE curriculum_id = ? AND active_school_year_id = ?
      `,
        [max_slots, curriculum_id, activeSchoolYearId],
      );

      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      const programLabel = await getProgramSlotLabel(curriculum_id);
      await insertProgramSlotAuditLog({
        req,
        action: "PROGRAM_SLOT_UPDATE",
        message: `${roleLabel} (${actorId}) updated program slot limit for ${programLabel} to ${max_slots}.`,
      });

      memoryCache.clear();
      return res.json({ message: "Program slots updated" });
    }

    // INSERT
    await db.query(
      `
      INSERT INTO admission.program_slots
      (curriculum_id, max_slots, active_school_year_id, created_at)
      VALUES (?, ?, ?, NOW())
    `,
      [curriculum_id, max_slots, activeSchoolYearId],
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const programLabel = await getProgramSlotLabel(curriculum_id);
    await insertProgramSlotAuditLog({
      req,
      action: "PROGRAM_SLOT_CREATE",
      message: `${roleLabel} (${actorId}) created program slot limit for ${programLabel}. Max slots: ${max_slots}.`,
    });

    memoryCache.clear();
    res.json({ message: "Program slots created" });
  } catch (err) {
    console.error("Error saving program slots:", err);
    res.status(500).json({ message: "Failed to save program slots" });
  }
});

router.post("/program-slots/department", async (req, res) => {
  const { dprtmnt_id, max_slots, year_id, semester_id } = req.body;

  if (!dprtmnt_id || !max_slots || !year_id || !semester_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const connection = await db.getConnection();

  try {
    const [activeRows] = await db3.query(
      "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ? LIMIT 1",
      [year_id, semester_id],
    );
    const activeSchoolYearId = activeRows[0]?.id;

    if (!activeSchoolYearId) {
      return res
        .status(400)
        .json({ message: "Active school year not found for selection" });
    }

    const [curriculumRows] = await db3.query(
      `
      SELECT dc.curriculum_id
      FROM dprtmnt_curriculum_table dc
      WHERE dc.dprtmnt_id = ?
    `,
      [dprtmnt_id],
    );

    const curriculumIds = curriculumRows.map((row) => row.curriculum_id);
    if (!curriculumIds.length) {
      return res
        .status(404)
        .json({ message: "No programs found for department" });
    }

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
      SELECT curriculum_id
      FROM admission.program_slots
      WHERE active_school_year_id = ?
        AND curriculum_id IN (?)
    `,
      [activeSchoolYearId, curriculumIds],
    );
    const existingSet = new Set(existingRows.map((row) => row.curriculum_id));

    for (const curriculumId of curriculumIds) {
      if (existingSet.has(curriculumId)) {
        await connection.query(
          `
          UPDATE admission.program_slots
          SET max_slots = ?
          WHERE curriculum_id = ? AND active_school_year_id = ?
        `,
          [max_slots, curriculumId, activeSchoolYearId],
        );
      } else {
        await connection.query(
          `
          INSERT INTO admission.program_slots
          (curriculum_id, max_slots, active_school_year_id, created_at)
          VALUES (?, ?, ?, NOW())
        `,
          [curriculumId, max_slots, activeSchoolYearId],
        );
      }
    }

    await connection.commit();
    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertProgramSlotAuditLog({
      req,
      action: "PROGRAM_SLOT_DEPARTMENT_UPDATE",
      message: `${roleLabel} (${actorId}) set program slot limit to ${max_slots} for ${curriculumIds.length} program(s) in department ${dprtmnt_id}.`,
    });
    memoryCache.clear();
    res.json({ message: "Program slots updated for department" });
  } catch (err) {
    await connection.rollback();
    console.error("Error saving department program slots:", err);
    res
      .status(500)
      .json({ message: "Failed to save department program slots" });
  } finally {
    connection.release();
  }
});

router.post("/program-slots/all", async (req, res) => {
  const { max_slots, year_id, semester_id } = req.body;

  if (!max_slots || !year_id || !semester_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const connection = await db.getConnection();

  try {
    const [activeRows] = await db3.query(
      "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ? LIMIT 1",
      [year_id, semester_id],
    );
    const activeSchoolYearId = activeRows[0]?.id;

    if (!activeSchoolYearId) {
      return res
        .status(400)
        .json({ message: "Active school year not found for selection" });
    }

    const [curriculumRows] = await db3.query(`
      SELECT dc.curriculum_id
      FROM dprtmnt_curriculum_table dc
    `);

    const curriculumIds = curriculumRows.map((row) => row.curriculum_id);
    if (!curriculumIds.length) {
      return res.status(404).json({ message: "No programs found" });
    }

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
      SELECT curriculum_id
      FROM admission.program_slots
      WHERE active_school_year_id = ?
        AND curriculum_id IN (?)
    `,
      [activeSchoolYearId, curriculumIds],
    );
    const existingSet = new Set(existingRows.map((row) => row.curriculum_id));

    for (const curriculumId of curriculumIds) {
      if (existingSet.has(curriculumId)) {
        await connection.query(
          `
          UPDATE admission.program_slots
          SET max_slots = ?
          WHERE curriculum_id = ? AND active_school_year_id = ?
        `,
          [max_slots, curriculumId, activeSchoolYearId],
        );
      } else {
        await connection.query(
          `
          INSERT INTO admission.program_slots
          (curriculum_id, max_slots, active_school_year_id, created_at)
          VALUES (?, ?, ?, NOW())
        `,
          [curriculumId, max_slots, activeSchoolYearId],
        );
      }
    }

    await connection.commit();
    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertProgramSlotAuditLog({
      req,
      action: "PROGRAM_SLOT_ALL_UPDATE",
      message: `${roleLabel} (${actorId}) set program slot limit to ${max_slots} for all ${curriculumIds.length} program(s).`,
    });
    memoryCache.clear();
    res.json({ message: "Program slots updated for all programs" });
  } catch (err) {
    await connection.rollback();
    console.error("Error saving program slots for all programs:", err);
    res.status(500).json({ message: "Failed to save program slots" });
  } finally {
    connection.release();
  }
});

module.exports = router;
