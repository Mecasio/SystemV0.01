const express = require("express");
const webtoken = require("jsonwebtoken");
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

const insertCourseTaggingAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    severity: "INFO",
    message,
  });
};

const getCourseLabel = async (courseId) => {
  const [rows] = await db3.query(
    "SELECT course_code, course_description FROM course_table WHERE course_id = ? LIMIT 1",
    [courseId],
  );
  const course = rows?.[0];
  if (!course) return `Course ${courseId}`;
  return `${course.course_code || "N/A"} - ${course.course_description || "Unknown Course"}`;
};

const getEnrolledSubjectLabel = async (enrolledSubjectId) => {
  const [rows] = await db3.query(
    `SELECT es.id, es.student_number, c.course_code, c.course_description
     FROM enrolled_subject es
     LEFT JOIN course_table c ON c.course_id = es.course_id
     WHERE es.id = ?
     LIMIT 1`,
    [enrolledSubjectId],
  );
  const row = rows?.[0];
  if (!row) return null;

  return {
    studentNumber: row.student_number,
    courseLabel: `${row.course_code || "N/A"} - ${row.course_description || "Unknown Course"}`,
  };
};

// YEAR LEVEL TABLE
router.get("/get_year_level", async (req, res) => {
  const query = "SELECT * FROM year_level_table";

  try {
    const [result] = await db3.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({
      error: "Failed to retrieve year level data",
      details: err.message,
    });
  }
});

// ACTIVE SEMESTER
router.get("/get_active_semester", async (req, res) => {
  try {
    const semester = await db3.query(`
      SELECT smt.semester_id, smt.semester_description
      FROM active_school_year_table AS sy
      LEFT JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
      WHERE sy.astatus = 1;
    `);

    res.json(semester[0]);
  } catch (err) {
    console.log("Internal Server Error");
    res.status(500).json(err);
  }
});

// COURSES BY CURRICULUM
router.get("/courses/:currId", async (req, res) => {
  const { currId } = req.params;
  console.log("cURRICULUM ID: ", currId);

  const sql = `
    SELECT
      ctt.program_tagging_id,
      ctt.curriculum_id,
      ctt.course_id,
      ctt.year_level_id,
      ctt.semester_id,
      c.course_code,
      c.course_description,
      c.course_unit,
      c.lec_unit,
      c.lab_unit,
      c.prereq,
      c.corequisite
    FROM program_tagging_table ctt
    INNER JOIN course_table c
      ON c.course_id = ctt.course_id
    WHERE ctt.curriculum_id = ?
    ORDER BY c.course_code
  `;

  try {
    const [result] = await db3.query(sql, [currId]);
    res.json(result);
  } catch (err) {
    console.error("Error in /courses:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ENROLL ALL SUBJECTS (YEAR 1 + ACTIVE SEM)
router.post("/add-all-to-enrolled-courses", async (req, res) => {
  const {
    subject_id,
    user_id,
    curriculumID,
    departmentSectionID,
    year_level,
    active_school_year_id,
    active_semester_id,
  } = req.body;
  console.log("Received request:", {
    subject_id,
    user_id,
    curriculumID,
    departmentSectionID,
  });

  try {
    let activeSchoolYearId = active_school_year_id;
    let activeSemesterId = active_semester_id;

    if (activeSchoolYearId && !activeSemesterId) {
      const [schoolYearRows] = await db3.query(
        `SELECT semester_id FROM active_school_year_table WHERE id = ? LIMIT 1`,
        [activeSchoolYearId]
      );
      activeSemesterId = schoolYearRows[0]?.semester_id || null;
    }

    if (!activeSchoolYearId || !activeSemesterId) {
      const activeYearSql = `SELECT id, semester_id FROM active_school_year_table WHERE astatus = 1 LIMIT 1`;
      const [yearResult] = await db3.query(activeYearSql);

      if (yearResult.length === 0) {
        return res.status(404).json({ error: "No active school year found" });
      }

      activeSchoolYearId = activeSchoolYearId || yearResult[0].id;
      activeSemesterId = activeSemesterId || yearResult[0].semester_id;
    }
    console.log("Active semester ID:", activeSemesterId);

    const checkSql = `
      SELECT year_level_id, semester_id, curriculum_id
      FROM program_tagging_table
      WHERE course_id = ? AND curriculum_id = ?
      LIMIT 1
    `;

    const [checkResult] = await db3.query(checkSql, [subject_id, curriculumID]);

    if (!checkResult.length) {
      console.warn(`Subject ${subject_id} not found in tagging table`);
      return res.status(404).json({ message: "Subject not found" });
    }

    const { year_level_id, semester_id, curriculum_id } = checkResult[0];
    console.log("Year level found:", year_level_id);
    console.log("Subject semester:", semester_id);
    console.log("Active semester:", activeSemesterId);
    console.log("Curriculum found:", curriculum_id);

    if (
      year_level_id !== year_level ||
      semester_id !== activeSemesterId ||
      curriculum_id !== curriculumID
    ) {
      console.log(
        `Skipping subject ${subject_id} (not Year 1, not active semester ${activeSemesterId}, or wrong curriculum)`
      );
      return res.status(200).json({
        message:
          "Skipped - Not Year 1 / Not Active Semester / Wrong Curriculum",
      });
    }

    const checkDuplicateSql = `
      SELECT * FROM enrolled_subject
      WHERE course_id = ? AND student_number = ? AND active_school_year_id = ?
    `;

    const [dupResult] = await db3.query(checkDuplicateSql, [
      subject_id,
      user_id,
      activeSchoolYearId,
    ]);

    if (dupResult.length > 0) {
      console.log(
        `Skipping subject ${subject_id}, already enrolled for student ${user_id}`
      );
      return res.status(200).json({ message: "Skipped - Already Enrolled" });
    }

    const insertSql = `
      INSERT INTO enrolled_subject (course_id, student_number, active_school_year_id, curriculum_id, department_section_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db3.query(insertSql, [
      subject_id,
      user_id,
      activeSchoolYearId,
      curriculumID,
      departmentSectionID,
      1,
    ]);
    console.log(
      `Student ${user_id} successfully enrolled in subject ${subject_id}`
    );

    const updateStatusSql = `
      UPDATE student_status_table
      SET enrolled_status = 1, active_curriculum = ?, year_level_id = ?, active_school_year_id = ?
      WHERE student_number = ?
    `;

    await db3.query(updateStatusSql, [
      curriculumID,
      year_level,
      activeSchoolYearId,
      user_id,
    ]);

    const [getStudentNUmber] = await db3.query(
      `
      SELECT id, person_id FROM student_numbering_table WHERE student_number = ?
    `,
      [user_id]
    );

    if (getStudentNUmber.length === 0) {
      console.log("Student number not found");
    }

    const student_numbering_id = getStudentNUmber[0].id;
    const person_id = getStudentNUmber[0].person_id;

    const [getDepartmentID] = await db3.query(
      `
      SELECT dprtmnt_id FROM dprtmnt_curriculum_table WHERE curriculum_id = ?
    `,
      [curriculumID]
    );

    if (getDepartmentID.length === 0) {
      console.log("Department ID not found");
    }

    const department_id = getDepartmentID[0].dprtmnt_id;

    const [checkExistingCurriculum] = await db3.query(
      `
      SELECT * FROM student_curriculum_table
      WHERE student_numbering_id = ? AND curriculum_id = ?
      `,
      [student_numbering_id, curriculum_id]
    );

    await db3.query(
      `
        UPDATE user_accounts SET dprtmnt_id = ? WHERE person_id = ?
      `,
      [department_id, person_id]
    );

    if (checkExistingCurriculum.length === 0) {
      await db3.query(
        `
        INSERT INTO student_curriculum_table (student_numbering_id, curriculum_id)
        VALUES (?, ?)
        `,
        [student_numbering_id, curriculum_id]
      );
    } else {
      console.log(
        `âš ï¸ Curriculum ${curriculum_id} already exists for student ${user_id}`
      );
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const courseLabel = await getCourseLabel(subject_id);
    await insertCourseTaggingAuditLog({
      req,
      action: "COURSE_TAGGING_BULK_ENROLL",
      message: `${roleLabel} (${actorId}) enrolled ${courseLabel} to Student (${user_id}) via bulk course tagging.`,
    });

    res.status(200).json({ message: "Course enrolled successfully" });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ENROLL SINGLE SUBJECT
router.post("/add-to-enrolled-courses/:userId/:currId/", async (req, res) => {
  const { subject_id, department_section_id, active_school_year_id } = req.body;
  const { userId, currId } = req.params;

  try {
    let activeSchoolYearId = active_school_year_id;

    if (!activeSchoolYearId) {
      const activeYearSql = `SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1`;
      const [yearResult] = await db3.query(activeYearSql);

      if (yearResult.length === 0) {
        return res.status(404).json({ error: "No active school year found" });
      }

      activeSchoolYearId = yearResult[0].id;
    }

    const sql =
      "INSERT INTO enrolled_subject (course_id, student_number, active_school_year_id, curriculum_id, department_section_id) VALUES (?, ?, ?, ?, ?)";
    await db3.query(sql, [
      subject_id,
      userId,
      activeSchoolYearId,
      currId,
      department_section_id,
    ]);

    const [getStudentNUmber] = await db3.query(
      `
      SELECT id FROM student_numbering_table WHERE student_number = ?
    `,
      [userId]
    );

    if (getStudentNUmber.length === 0) {
      throw new Error("Student number not found");
    }

    const student_numbering_id = getStudentNUmber[0].id;

    const [checkExistingCurriculum] = await db3.query(
      `
      SELECT * FROM student_curriculum_table
      WHERE student_numbering_id = ? AND curriculum_id = ?
      `,
      [student_numbering_id, currId]
    );

    if (checkExistingCurriculum.length === 0) {
      await db3.query(
        `
        INSERT INTO student_curriculum_table (student_numbering_id, curriculum_id)
        VALUES (?, ?)
        `,
        [student_numbering_id, currId]
      );
    } else {
      console.log(
        `âš ï¸ Curriculum ${currId} already exists for student ${userId}`
      );
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const courseLabel = await getCourseLabel(subject_id);
    await insertCourseTaggingAuditLog({
      req,
      action: "COURSE_TAGGING_ENROLL",
      message: `${roleLabel} (${actorId}) enrolled ${courseLabel} to Student (${userId}).`,
    });

    res.json({ message: "Course enrolled successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
});

router.post("/add-student-courses/:userId", async (req, res) => {
  const { subject_id, active_school_year_id, curriculum_id } = req.body;
  const { userId } = req.params;

  console.log("PARAMETER: ", subject_id, active_school_year_id, curriculum_id);

  try {
    let activeSchoolYearId = active_school_year_id;

    if (!activeSchoolYearId) {
      const [activeYearRows] = await db3.query(
        "SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1"
      );

      if (activeYearRows.length === 0) {
        return res.status(404).json({ message: "No active school year found" });
      }

      activeSchoolYearId = activeYearRows[0].id;
    }

    if (!subject_id || !userId || !curriculum_id) {
      return res.status(400).json({ message: "Missing required course data" });
    }

    const [selectExistingRows] = await db3.query(`
        SELECT student_number FROM enrolled_subject WHERE course_id = ? AND student_number = ? AND active_school_year_id = ? AND curriculum_id = ?
      `, [subject_id, userId, activeSchoolYearId, curriculum_id])

    if (selectExistingRows.length > 0) {
      return res.status(400).json({ message: "Record already existed" });
    }

    const sql =
      "INSERT INTO enrolled_subject (course_id, student_number, active_school_year_id, curriculum_id, department_section_id) VALUES (?, ?, ?, ?, ?)";
    
    await db3.query(sql, [
      subject_id,
      userId,
      activeSchoolYearId,
      curriculum_id,
      null,
    ]);

    res.json({ message: "Course enrolled successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
});

router.put("/courses/dropped/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const sql = "UPDATE enrolled_subject SET en_remarks = 4 WHERE id = ?";
    await db3.query(sql, [id]);

    res.json({
      message: "Course and related evaluations removed successfully",
    });
  } catch (err) {
    console.error("Error deleting subject:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

router.put("/courses/change/:id", async (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ error: "course_id is required" });
  }

  try {
    const sql = "UPDATE enrolled_subject SET course_id = ? WHERE id = ?";
    await db3.query(sql, [course_id, id]);

    res.json({
      message: "Course changed successfully",
    });
  } catch (err) {
    console.error("Error changing subject:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// Delete a single selected subject + its evaluations
router.delete("/courses/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const enrolledBefore = await getEnrolledSubjectLabel(id);
    const sql = "DELETE FROM enrolled_subject WHERE id = ?";
    const [result] = await db3.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Enrolled course not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertCourseTaggingAuditLog({
      req,
      action: "COURSE_TAGGING_UNENROLL",
      message: `${roleLabel} (${actorId}) unenrolled ${enrolledBefore?.courseLabel || `enrolled_subject ${id}`} from Student (${enrolledBefore?.studentNumber || "unknown"}).`,
    });

    res.json({
      message: "Course and related evaluations removed successfully",
    });
  } catch (err) {
    console.error("Error deleting subject:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// Delete all courses for user
router.delete("/courses/user/:userId", async (req, res) => {
  const { userId } = req.params;
  const { activeSchoolYearId } = req.query;

  try {
    let effectiveActiveSchoolYearId = activeSchoolYearId;

    if (!effectiveActiveSchoolYearId) {
      const activeYearSql = `SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1`;
      const [yearResult] = await db3.query(activeYearSql);

      if (yearResult.length === 0) {
        return res.status(404).json({ error: "No active school year found" });
      }

      effectiveActiveSchoolYearId = yearResult[0].id;
    }

    const [enrolledBefore] = await db3.query(
      `SELECT es.id, c.course_code, c.course_description
       FROM enrolled_subject es
       LEFT JOIN course_table c ON c.course_id = es.course_id
       WHERE es.student_number = ? AND es.active_school_year_id = ?`,
      [userId, effectiveActiveSchoolYearId],
    );

    const sql =
      "DELETE FROM enrolled_subject WHERE student_number = ? AND active_school_year_id = ?";
    const [result] = await db3.query(sql, [userId, effectiveActiveSchoolYearId]);

    if (result.affectedRows > 0) {
      const { actorId, actorRole } = getAuditActor(req);
      const roleLabel = formatAuditActorRole(actorRole);
      const sampleCourses = enrolledBefore
        .slice(0, 5)
        .map((row) => `${row.course_code || "N/A"} - ${row.course_description || "Unknown Course"}`)
        .join(", ");
      const extraCount =
        enrolledBefore.length > 5 ? ` and ${enrolledBefore.length - 5} more` : "";

      await insertCourseTaggingAuditLog({
        req,
        action: "COURSE_TAGGING_UNENROLL_ALL",
        message: `${roleLabel} (${actorId}) unenrolled ${result.affectedRows} course(s) from Student (${userId}). Course(s): ${sampleCourses || "N/A"}${extraCount}.`,
      });
    }

    res.json({ message: "All courses unenrolled successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
});

// SEARCH STUDENT (REGISTRAR)
router.post("/student-tagging", async (req, res) => {
  const { studentNumber, active_school_year_id } = req.body;
  console.log("Student NUmber", studentNumber);
  if (!studentNumber) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const whereClause = active_school_year_id
      ? "WHERE sn.student_number = ?"
      : "WHERE sn.student_number = ? AND (ss.active_school_year_id = 0 OR sy.astatus = 1)";
    const queryParams = active_school_year_id
      ? [studentNumber]
      : [studentNumber];

    const sql = `
      SELECT DISTINCT
        IFNULL(ss.id, "") AS student_status_id ,
        sn.student_number,
        ptbl.person_id,
        ptbl.first_name,
        ptbl.last_name,
        ptbl.middle_name,
        ptbl.age,
        ptbl.gender,
        ptbl.applyingAs,
        ptbl.emailAddress,
        ptbl.program,
        ptbl.profile_img,
        ptbl.extension,
        ss.active_curriculum,
        pt.program_id,
        pt.major,
        pt.program_description,
        pt.program_code,
        yt.year_id,
        yt.year_description,
        es.status AS enrolled_status,
        es.department_section_id,
        st.description AS section_description,
        dt.dprtmnt_name,
        ylt.year_level_id,
        ylt.year_level_description,
        ss.active_school_year_id,
        sy.semester_id
    FROM student_numbering_table AS sn
    LEFT JOIN student_status_table AS ss ON sn.student_number = ss.student_number
    LEFT JOIN person_table AS ptbl ON sn.person_id = ptbl.person_id
    LEFT JOIN curriculum_table AS c ON ss.active_curriculum = c.curriculum_id
    LEFT JOIN program_table AS pt ON c.program_id = pt.program_id
    LEFT JOIN year_table AS yt ON c.year_id = yt.year_id
    LEFT JOIN enrolled_subject AS es ON ss.student_number = es.student_number
    LEFT JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
    LEFT JOIN section_table AS st ON dst.section_id = st.id
    LEFT JOIN dprtmnt_curriculum_table AS dct ON c.curriculum_id = dct.curriculum_id
    LEFT JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
    LEFT JOIN year_level_table AS ylt ON ss.year_level_id = ylt.year_level_id
    LEFT JOIN active_school_year_table AS sy ON ss.active_school_year_id = sy.id
    ${whereClause};
    `;

    const [results] = await db3.query(sql, queryParams);

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid Student Number" });
    }

    const student = results[0];

    const effectiveProgram =
      student.active_curriculum && student.active_curriculum !== 0
        ? student.active_curriculum
        : student.program;

    const feeSql = `
      SELECT
        COALESCE(SUM(lec_fee), 0) AS total_lec_fee,
        COALESCE(SUM(lab_fee), 0) AS total_lab_fee,
        COALESCE(SUM(total_nstp), 0) AS total_nstp,
        COALESCE(SUM(total_computer_lab), 0) AS total_computer_lab,
        COALESCE(SUM(total_laboratory), 0) AS total_laboratory
      FROM (
        SELECT
          course_id,
          MAX(lec_fee) AS lec_fee,
          MAX(lab_fee) AS lab_fee,
          MAX(is_nstp = 1) AS total_nstp,
          MAX(iscomputer_lab = 1) AS total_computer_lab,
          MAX(islaboratory_fee = 1) AS total_laboratory
        FROM program_tagging_table
        WHERE curriculum_id = ?
          AND year_level_id = ?
          AND semester_id = ?
        GROUP BY course_id
      ) fees;

    `;

    const [feeResult] = await db3.query(feeSql, [
      effectiveProgram,
      student.year_level_id,
      student.semester_id,
    ]);

    const totalLecFee = Number(feeResult[0]?.total_lec_fee || 0);
    const totalLabFee = Number(feeResult[0]?.total_lab_fee || 0);
    const totalFees = totalLecFee + totalLabFee;
    const totalNstpCount = Number(feeResult[0]?.total_nstp || 0);
    const totalComputerLab = Number(feeResult[0]?.total_computer_lab || 0);
    const totalLaboratory = Number(feeResult[0]?.total_laboratory || 0);
    const isEnrolled = student.enrolled_status === 1;

    const token2 = webtoken.sign(
      {
        id: student.student_status_id,
        person_id2: student.person_id,
        studentNumber: student.student_number,
        section: student.section_description,
        activeCurriculum: effectiveProgram,
        major: student.major,
        yearLevel: student.year_level_id,
        yearLevelDescription: student.year_level_description,
        courseCode: student.program_code,
        courseDescription: student.program_description,
        departmentName: student.dprtmnt_name,
        yearDesc: student.year_description,
        firstName: student.first_name,
        middleName: student.middle_name,
        lastName: student.last_name,
        age: student.age,
        gender: student.gender,
        applyingAs: student.applyingAs,
        email: student.emailAddress,
        program: student.program,
        profile_img: student.profile_img,
        extension: student.extension,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("Search response:", {
      token2,
      totalNstpCount,
      studentNumber: student.student_number,
      person_id2: student.person_id,
      activeCurriculum: student.active_curriculum,
      section: student.section_description,
      major: student.major,
      yearLevel: student.year_level_id,
      yearLevelDescription: student.year_level_description,
      courseCode: student.program_code,
      courseDescription: student.program_description,
      departmentName: student.dprtmnt_name,
      yearDesc: student.year_description,
      firstName: student.first_name,
      middleName: student.middle_name,
      lastName: student.last_name,
      age: student.age,
      gender: student.gender,
      applyingAs: student.applyingAs,
      email: student.emailAddress,
      program: student.program,
      profile_img: student.profile_img,
      extension: student.extension,
    });

    res.json({
      message: "Search successful",
      token2,
      isEnrolled,
      totalLecFee,
      totalLabFee,
      totalFees,
      totalComputerLab,
      totalLaboratory,
      totalNstpCount,
      studentNumber: student.student_number,
      person_id2: student.person_id,
      section: student.section_description,
      activeCurriculum: effectiveProgram,
      major: student.major,
      yearLevel: student.year_level_id,
      yearLevelDescription: student.year_level_description,
      courseCode: student.program_code,
      courseDescription: student.program_description,
      departmentName: student.dprtmnt_name,
      yearDesc: student.year_description,
      firstName: student.first_name,
      middleName: student.middle_name,
      lastName: student.last_name,
      age: student.age,
      gender: student.gender,
      applyingAs: student.applyingAs,
      email: student.emailAddress,
      program: student.program,
      profile_img: student.profile_img,
      extension: student.extension,
    });
  } catch (err) {
    console.error("SQL error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// SEARCH STUDENT BY DEPARTMENT
router.post("/student-tagging/dprtmnt", async (req, res) => {
  const { studentNumber, dprtmntId, active_school_year_id } = req.body;

  console.log("Student Number: ", studentNumber);
  if (!studentNumber || dprtmntId == null) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const whereClause = active_school_year_id
      ? "WHERE sn.student_number = ? AND dct.dprtmnt_id = ? AND (ss.active_school_year_id = 0 OR ss.active_school_year_id = ?)"
      : "WHERE sn.student_number = ? AND dct.dprtmnt_id = ? AND (ss.active_school_year_id = 0 OR sy.astatus = 1)";
    const queryParams = active_school_year_id
      ? [studentNumber, dprtmntId, active_school_year_id]
      : [studentNumber, dprtmntId];

    const sql = `
      SELECT DISTINCT
        IFNULL(ss.id, "") AS student_status_id ,
        sn.student_number,
        ptbl.person_id,
        ptbl.first_name,
        ptbl.last_name,
        ptbl.middle_name,
        ptbl.age,
        ptbl.gender,
        ptbl.applyingAs,
        ptbl.emailAddress,
        ptbl.program,
        ptbl.profile_img,
        ptbl.extension,
        ss.active_curriculum,
        pt.program_id,
        pt.major,
        pt.program_description,
        pt.program_code,
        yt.year_id,
        yt.year_description,
        es.status AS enrolled_status,
        es.department_section_id,
        st.description AS section_description,
        dt.dprtmnt_name,
        ylt.year_level_id,
        ylt.year_level_description,
        ss.active_school_year_id,
        sy.semester_id
    FROM student_numbering_table AS sn
    LEFT JOIN student_status_table AS ss ON sn.student_number = ss.student_number
    LEFT JOIN person_table AS ptbl ON sn.person_id = ptbl.person_id
    LEFT JOIN curriculum_table AS c
      ON c.curriculum_id = COALESCE(NULLIF(ss.active_curriculum, 0), ptbl.program)
    LEFT JOIN program_table AS pt ON c.program_id = pt.program_id
    LEFT JOIN year_table AS yt ON c.year_id = yt.year_id
    LEFT JOIN enrolled_subject AS es ON ss.student_number = es.student_number
    LEFT JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
    LEFT JOIN section_table AS st ON dst.section_id = st.id
    LEFT JOIN dprtmnt_curriculum_table AS dct ON c.curriculum_id = dct.curriculum_id
    LEFT JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
    LEFT JOIN year_level_table AS ylt ON ss.year_level_id = ylt.year_level_id
    LEFT JOIN active_school_year_table AS sy ON ss.active_school_year_id = sy.id
    ${whereClause};
    `;

    const [results] = await db3.query(sql, queryParams);

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid Student Number" });
    }

    const student = results[0];

    const feeSql = `
      SELECT
        COALESCE(SUM(lec_fee), 0) AS total_lec_fee,
        COALESCE(SUM(lab_fee), 0) AS total_lab_fee,
        COALESCE(SUM(total_nstp), 0) AS total_nstp,
        COALESCE(SUM(total_computer_lab), 0) AS total_computer_lab,
        COALESCE(SUM(total_laboratory), 0) AS total_laboratory
      FROM (
        SELECT
          course_id,
          MAX(lec_fee) AS lec_fee,
          MAX(lab_fee) AS lab_fee,
          MAX(is_nstp = 1) AS total_nstp,
          MAX(iscomputer_lab = 1) AS total_computer_lab,
          MAX(islaboratory_fee = 1) AS total_laboratory
        FROM program_tagging_table
        WHERE curriculum_id = ?
          AND year_level_id = ?
          AND semester_id = ?
        GROUP BY course_id
      ) fees;
    `;
    const [feeResult] = await db3.query(feeSql, [
      student.active_curriculum,
      student.year_level_id,
      student.semester_id,
    ]);

    const totalLecFee = Number(feeResult[0]?.total_lec_fee || 0);
    const totalLabFee = Number(feeResult[0]?.total_lab_fee || 0);
    const totalFees = totalLecFee + totalLabFee;
    const totalNstpCount = Number(feeResult[0]?.total_nstp || 0);
    const totalComputerLab = Number(feeResult[0]?.total_computer_lab || 0);
    const totalLaboratory = Number(feeResult[0]?.total_laboratory || 0);
    const isEnrolled = student.enrolled_status === 1;

    const effectiveProgram =
      student.active_curriculum && student.active_curriculum !== 0
        ? student.active_curriculum
        : student.program;

    const token2 = webtoken.sign(
      {
        id: student.student_status_id,
        person_id2: student.person_id,
        studentNumber: student.student_number,
        section: student.section_description,
        activeCurriculum: effectiveProgram,
        major: student.major,
        yearLevel: student.year_level_id,
        yearLevelDescription: student.year_level_description,
        courseCode: student.program_code,
        courseDescription: student.program_description,
        departmentName: student.dprtmnt_name,
        yearDesc: student.year_description,
        firstName: student.first_name,
        middleName: student.middle_name,
        lastName: student.last_name,
        age: student.age,
        gender: student.gender,
        email: student.emailAddress,
        program: student.program,
        profile_img: student.profile_img,
        extension: student.extension,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Search successful",
      token2,
      isEnrolled,
      totalLecFee,
      totalLabFee,
      totalFees,
      totalComputerLab,
      totalLaboratory,
      totalNstpCount,
      studentNumber: student.student_number,
      person_id2: student.person_id,
      section: student.section_description,
      activeCurriculum: effectiveProgram,
      major: student.major,
      yearLevel: student.year_level_id,
      yearLevelDescription: student.year_level_description,
      courseCode: student.program_code,
      courseDescription: student.program_description,
      departmentName: student.dprtmnt_name,
      yearDesc: student.year_description,
      firstName: student.first_name,
      middleName: student.middle_name,
      lastName: student.last_name,
      age: student.age,
      gender: student.gender,
      applyingAs: student.applyingAs,
      email: student.emailAddress,
      program: student.program,
      profile_img: student.profile_img,
      extension: student.extension,
    });
  } catch (err) {
    console.error("SQL error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// ENROLLED COURSES
router.get("/enrolled_courses/:userId/:currId", async (req, res) => {
  const { userId, currId } = req.params;
  const { activeSchoolYearId } = req.query;

  try {
    let effectiveActiveSchoolYearId = activeSchoolYearId;

    if (!effectiveActiveSchoolYearId) {
      const activeYearSql = `SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1`;
      const [yearResult] = await db3.query(activeYearSql);

      if (yearResult.length === 0) {
        return res.status(404).json({ error: "No active school year found" });
      }

      effectiveActiveSchoolYearId = yearResult[0].id;
    }

    const sql = `
      SELECT
        es.id,
        es.course_id,
        c.course_code,
        c.course_description,
        st.description,
        c.course_unit,
        c.lab_unit,
        c.lec_unit,
        ds.id AS department_section_id,
        IFNULL(pt.program_code, 'NOT') AS program_code,
        IFNULL(pt.program_description, 'CURRENTLY') AS program_description,
        IFNULL(st.description, 'ENROLLED') AS section,
        IFNULL(rd.description, 'TBA') AS day_description,
        IFNULL(tt.school_time_start, 'TBA') AS school_time_start,
        IFNULL(tt.school_time_end, 'TBA') AS school_time_end,
        IFNULL(rtbl.room_description, 'TBA') AS room_description,
        IFNULL(prof_table.lname, 'TBA') AS lname,
        (
          SELECT COUNT(*)
          FROM enrolled_subject es2
          WHERE es2.active_school_year_id = es.active_school_year_id
            AND es2.department_section_id = es.department_section_id
            AND es2.course_id = es.course_id
        ) AS number_of_enrolled

      FROM enrolled_subject AS es
      LEFT JOIN course_table AS c
        ON c.course_id = es.course_id
      LEFT JOIN dprtmnt_section_table AS ds
        ON ds.id = es.department_section_id
      LEFT JOIN section_table AS st
        ON st.id = ds.section_id
      LEFT JOIN curriculum_table AS cr
        ON cr.curriculum_id = ds.curriculum_id
      LEFT JOIN program_table AS pt
        ON pt.program_id = cr.program_id
      LEFT JOIN time_table AS tt
        ON tt.school_year_id = es.active_school_year_id
        AND tt.department_section_id = es.department_section_id
        AND tt.course_id = es.course_id
      LEFT JOIN room_day_table AS rd
        ON rd.id = tt.room_day
      LEFT JOIN dprtmnt_room_table as dr
        ON dr.dprtmnt_room_id = tt.department_room_id
      LEFT JOIN room_table as rtbl
        ON rtbl.room_id = dr.room_id
      LEFT JOIN prof_table
        ON prof_table.prof_id = tt.professor_id
      WHERE es.student_number = ?
        AND es.active_school_year_id = ?
        AND es.curriculum_id = ?
      ORDER BY c.course_id ASC;
    `;

    const [result] = await db3.query(sql, [
      userId,
      effectiveActiveSchoolYearId,
      currId,
    ]);
    res.json(result);
  } catch (err) {
    console.error("Error in /enrolled_courses:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/student-tagging-batch", async (req, res) => {
  const { studentNumbers, selectedYearLevel, activeSchoolYearId } = req.body;

  if (
    !studentNumbers ||
    !Array.isArray(studentNumbers) ||
    studentNumbers.length === 0
  ) {
    return res.status(400).json({ message: "Student numbers are required" });
  }

  console.log("student-tagging-batch:", { selectedYearLevel, activeSchoolYearId });
  try {
    // SQL: WHERE sn.student_number IN (?, ?, ?)
    const placeholders = studentNumbers.map(() => "?").join(",");

    const sql = `
      SELECT DISTINCT
        IFNULL(ss.id, "") AS student_status_id,
        sn.student_number,
        ptbl.person_id,
        ptbl.first_name,
        ptbl.last_name,
        ptbl.middle_name,
        ptbl.campus,
        ptbl.lrnNumber,
        ptbl.cellphoneNumber,
        ptbl.age,
        ptbl.gender,
        ptbl.emailAddress,
        ptbl.program,
        ptbl.profile_img,
        ptbl.extension,
        ss.active_curriculum,
        pt.program_id,
        pt.major,
        pt.program_description,
        pt.program_code,
        yt.year_id,
        yt.year_description,
        es.status AS enrolled_status,
        es.department_section_id,
        st.description AS section_description,
        dt.dprtmnt_name,
        ylt.year_level_id,
        ylt.year_level_description,
        ss.active_school_year_id,
        sy.semester_id
      FROM student_numbering_table AS sn
      INNER JOIN student_status_table AS ss ON sn.student_number = ss.student_number
      INNER JOIN person_table AS ptbl ON sn.person_id = ptbl.person_id
      INNER JOIN curriculum_table AS c ON ss.active_curriculum = c.curriculum_id
      INNER JOIN program_table AS pt ON c.program_id = pt.program_id
      INNER JOIN year_table AS yt ON c.year_id = yt.year_id
      LEFT JOIN enrolled_subject AS es
        ON ss.student_number = es.student_number
       AND es.active_school_year_id = ss.active_school_year_id
      LEFT JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
      LEFT JOIN section_table AS st ON dst.section_id = st.id
      LEFT JOIN dprtmnt_curriculum_table AS dct ON c.curriculum_id = dct.curriculum_id
      LEFT JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
      INNER JOIN year_level_table AS ylt ON ss.year_level_id = ylt.year_level_id
      INNER JOIN active_school_year_table AS sy ON ss.active_school_year_id = sy.id
      WHERE sn.student_number IN (${placeholders})
        AND ss.year_level_id = ?
        ${activeSchoolYearId ? "AND ss.active_school_year_id = ?" : ""}
    `;

    const queryParams = activeSchoolYearId
      ? [...studentNumbers, selectedYearLevel, activeSchoolYearId]
      : [...studentNumbers, selectedYearLevel];

    const [results] = await db3.query(sql, queryParams);

    if (!results.length) {
      return res
        .status(400)
        .json({ message: "No valid student numbers found" });
    }

    const studentsWithFees = await Promise.all(
      results.map(async (student) => {
        const feeSql = `
          SELECT
            COALESCE(SUM(lec_fee), 0) AS total_lec_fee,
            COALESCE(SUM(lab_fee), 0) AS total_lab_fee,
            COALESCE(SUM(total_nstp), 0) AS total_nstp,
            COALESCE(SUM(total_computer_lab), 0) AS total_computer_lab,
            COALESCE(SUM(total_laboratory), 0) AS total_laboratory
          FROM (
            SELECT
              course_id,
              MAX(lec_fee) AS lec_fee,
              MAX(lab_fee) AS lab_fee,
              MAX(is_nstp = 1) AS total_nstp,
              MAX(iscomputer_lab = 1) AS total_computer_lab,
              MAX(islaboratory_fee = 1) AS total_laboratory
            FROM program_tagging_table
            WHERE curriculum_id = ?
              AND year_level_id = ?
              AND semester_id = ?
            GROUP BY course_id
          ) fees;
        `;
        const [feeResult] = await db3.query(feeSql, [
          student.active_curriculum,
          student.year_level_id,
          student.semester_id,
        ]);

        const totalLecFee = Number(feeResult[0]?.total_lec_fee || 0);
        const totalLabFee = Number(feeResult[0]?.total_lab_fee || 0);
        const totalNstpCount = Number(feeResult[0]?.total_nstp || 0);
        const totalComputerLab = Number(feeResult[0]?.total_computer_lab || 0);
        const totalLaboratory = Number(feeResult[0]?.total_laboratory || 0);
        const corData = {
          student_number: student.student_number,
          person_id: student.person_id,
          profile_img: student.profile_img,
          lrnNumber: student.lrnNumber,
          cellphoneNumber: student.cellphoneNumber,
          last_name: student.last_name,
          middle_name: student.middle_name,
          campus: student.campus,
          first_name: student.first_name,
          extension: student.extension,
          gender: student.gender,
          age: student.age,
          email: student.emailAddress,
          curriculum: student.active_curriculum,
          yearlevel: student.year_level_id,
          program: student.program_description,
          program_code: student.program_code,
          college: student.dprtmnt_name,
          active_school_year_id: student.active_school_year_id,
        };

        const token2 = webtoken.sign(
          {
            id: student.student_status_id,
            person_id2: student.person_id,
            studentNumber: student.student_number,
            firstName: student.first_name,
            middleName: student.middle_name,
            lastName: student.last_name,
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" },
        );

        return {
          ...student,
          totalLecFee,
          totalLabFee,
          totalNstpCount,
          totalComputerLab,
          totalLaboratory,
          corData,
          token2,
        };
      }),
    );

    res.json({
      message: "Search successful",
      students: studentsWithFees,
    });
  } catch (err) {
    console.error("SQL error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// DEPARTMENT SECTIONS
router.get("/api/department-sections", async (req, res) => {
  const { departmentId } = req.query;

  const query = `
    SELECT
      dt.dprtmnt_id,
      dt.dprtmnt_name,
      dt.dprtmnt_code,
      c.year_id,
      c.program_id,
      c.curriculum_id,
      ds.id as department_and_program_section_id,
      ds.section_id,
      pt.program_description,
      pt.program_code,
      pt.major,
      st.description
      FROM dprtmnt_table as dt
        INNER JOIN dprtmnt_curriculum_table as dc ON dc.dprtmnt_id  = dt.dprtmnt_id
        INNER JOIN curriculum_table as c ON c.curriculum_id = dc.curriculum_id
        INNER JOIN dprtmnt_section_table as ds ON ds.curriculum_id = c.curriculum_id
        INNER JOIN program_table as pt ON c.program_id = pt.program_id
        INNER JOIN section_table as st ON st.id = ds.section_id
      WHERE dt.dprtmnt_id = ?
    ORDER BY ds.id
  `;

  try {
    const [results] = await db3.query(query, [departmentId]);
    res.status(200).json(results);
    console.log(results);
  } catch (err) {
    console.error("Error fetching department sections:", err);
    return res
      .status(500)
      .json({ error: "Database error", details: err.message });
  }
});

// UPDATE ACTIVE CURRICULUM
router.put("/api/update-active-curriculum", async (req, res) => {
  const { studentId, departmentSectionId } = req.body;

  if (!studentId || !departmentSectionId) {
    return res
      .status(400)
      .json({ error: "studentId and departmentSectionId are required" });
  }

  const fetchCurriculumQuery = `
    SELECT curriculum_id
    FROM dprtmnt_section_table
    WHERE id = ?
  `;

  try {
    const [curriculumResult] = await db3.query(fetchCurriculumQuery, [
      departmentSectionId,
    ]);

    if (curriculumResult.length === 0) {
      return res.status(404).json({ error: "Section not found" });
    }

    const curriculumId = curriculumResult[0].curriculum_id;

    const updateQuery = `
      UPDATE student_status_table
      SET active_curriculum = ?
      WHERE student_number = ?
    `;
    const result = await db3.query(updateQuery, [curriculumId, studentId]);
    const data = result[0];
    console.log(data);
    res.status(200).json({
      message: "Active curriculum updated successfully",
    });
  } catch (err) {
    console.error("Error updating active curriculum:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

// SEARCH STUDENT BY SECTION
router.get("/api/search-student/:sectionId", async (req, res) => {
  const { sectionId } = req.params;
  console.log("Section Id : ", sectionId);

  try {
    const [programResult] = await db3.query(
      `
      SELECT
        dst.curriculum_id,
        pt.program_description,
        pt.program_code
      FROM dprtmnt_section_table dst
      INNER JOIN curriculum_table ct ON dst.curriculum_id = ct.curriculum_id
      INNER JOIN program_table pt ON ct.program_id = pt.program_id
      WHERE dst.id = ?
      `,
      [sectionId]
    );

    if (!programResult.length) {
      return res.status(404).json({ message: "Section not found" });
    }

    const { curriculum_id } = programResult[0];

    const [courses] = await db3.query(
      `
  SELECT
    c.course_id,
    c.course_code,
    c.course_description,
    c.course_unit,
    c.lab_unit,
    c.prereq,
    c.corequisite
  FROM curriculum_table ct
  INNER JOIN program_tagging_table ptt ON ct.curriculum_id = ptt.curriculum_id
  INNER JOIN program_table pt ON ct.program_id = pt.program_id
  INNER JOIN course_table c ON ptt.course_id = c.course_id
  WHERE ct.curriculum_id = ?
  ORDER BY c.course_code
  `,
      [curriculum_id]
    );

    const formattedCourses = courses.map((c) => ({
      ...c,
      prereq_list: c.prereq ? c.prereq.split(",").map((p) => p.trim()) : [],
    }));

    res.status(200).json({
      ...programResult[0],
      courses: formattedCourses,
    });
  } catch (err) {
    console.error("Error fetching course tagging data:", err);
    res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

// SUBJECT ENROLLMENT COUNT
router.get("/subject-enrollment-count", async (req, res) => {
  const { sectionId, activeSchoolYearId } = req.query;

  try {
    let effectiveActiveSchoolYearId = activeSchoolYearId;

    if (!effectiveActiveSchoolYearId) {
      const activeYearSql = `SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1`;
      const [yearResult] = await db3.query(activeYearSql);

      if (yearResult.length === 0) {
        return res.status(404).json({ error: "No active school year found" });
      }

      effectiveActiveSchoolYearId = yearResult[0].id;
    }

    const sql = `
      SELECT
        es.course_id,
        COUNT(*) AS enrolled_count
      FROM enrolled_subject AS es
      WHERE es.active_school_year_id = ?
        AND es.department_section_id = ?
      GROUP BY es.course_id
    `;

    const [result] = await db3.query(sql, [
      effectiveActiveSchoolYearId,
      sectionId,
    ]);
    res.json(result);
  } catch (err) {
    console.error("Error fetching enrolled counts:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ADMIN DATA (DEPARTMENT BY EMAIL)
router.get("/api/admin_data/:email", async (req, res) => {
  const { email } = req.params;
  console.log("Email: ", email);

  try {
    const [rows] = await db3.query(
      "SELECT ua.dprtmnt_id FROM user_accounts AS ua WHERE email = ?",
      [email]
    );

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch department" });
  }
});

// CHECK PREREQUISITE BEFORE ENROLLMENT
router.post("/api/check-prerequisite", async (req, res) => {
  try {
    const { student_number, course_id, semester_id, curriculum_id } = req.body;

    if (!student_number || !course_id) {
      return res.status(400).json({
        allowed: false,
        status: "INVALID_REQUEST",
        message: "student_number and course_id are required.",
      });
    }

    const [courseRows] = await db3.query(
      "SELECT prereq, course_code FROM course_table WHERE course_id = ? LIMIT 1",
      [course_id]
    );

    if (!courseRows.length) {
      return res.status(404).json({
        allowed: false,
        status: "COURSE_NOT_FOUND",
        message: "Course not found in course_table.",
      });
    }

    const { prereq, course_code } = courseRows[0];
    console.log("Code and Prequiesite", prereq);
    console.log("Code and Prequiesite", course_code);

    if (!prereq || String(prereq).trim() === "") {
      return res.json({
        allowed: true,
        status: "NO_PREREQ",
        message: `Course ${course_code} has no prerequisite.`,
      });
    }

    const prereqCodes = String(prereq)
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (prereqCodes.length === 0) {
      return res.json({
        allowed: true,
        status: "NO_PREREQ",
        message: `Course ${course_code} has no prerequisite (empty prereq field).`,
      });
    }

    const placeholders = prereqCodes.map(() => "?").join(", ");

    const [prereqCourses] = await db3.query(
      `
      SELECT course_id, course_code
      FROM course_table
      WHERE course_code IN (${placeholders})
      `,
      prereqCodes
    );

    if (!prereqCourses.length) {
      return res.json({
        allowed: true,
        status: "PREREQ_NOT_FOUND",
        message:
          "Prerequisite course codes do not exist in course_table. Enrollment is allowed but please verify your curriculum data.",
      });
    }

    let applicablePrereqCourses = prereqCourses;

    if (semester_id && curriculum_id) {
      const prereqCourseIds = prereqCourses.map((p) => p.course_id);
      const placeholders2 = prereqCourseIds.map(() => "?").join(", ");

      const [tagRows] = await db3.query(
        `
        SELECT course_id, semester_id
        FROM program_tagging_table
        WHERE curriculum_id = ? AND course_id IN (${placeholders2})
        `,
        [curriculum_id, ...prereqCourseIds]
      );

      const prereqSemesterMap = new Map(
        tagRows.map((row) => [row.course_id, row.semester_id])
      );

      applicablePrereqCourses = prereqCourses.filter((p) => {
        const prereqSemesterId = prereqSemesterMap.get(p.course_id);
        if (!prereqSemesterId) return true;
        return Number(prereqSemesterId) < Number(semester_id);
      });

      if (applicablePrereqCourses.length === 0) {
        return res.json({
          allowed: true,
          status: "NO_APPLICABLE_PREREQ",
          message:
            "Prerequisites are not applicable for the selected semester.",
        });
      }
    }

    const failedPrereq = [];
    const missingPrereq = [];

    for (const prereqCourse of applicablePrereqCourses) {
      const prereqCourseId = prereqCourse.course_id;
      const prereqCourseCode = prereqCourse.course_code;

      const [gradeRows] = await db3.query(
        `
        SELECT
          MAX(CASE WHEN en_remarks = 1 THEN 1 ELSE 0 END) AS has_pass,
          MAX(CASE WHEN en_remarks = 2 THEN 1 ELSE 0 END) AS has_fail
        FROM enrolled_subject
        WHERE student_number = ? AND course_id = ?
        `,
        [student_number, prereqCourseId]
      );

      const { has_pass, has_fail } = gradeRows[0];

      if (!has_pass && has_fail) {
        failedPrereq.push(prereqCourseCode);
      } else if (!has_pass && !has_fail) {
        missingPrereq.push(prereqCourseCode);
      }
    }

    if (failedPrereq.length > 0) {
      return res.json({
        allowed: false,
        status: "FAILED_PREREQ",
        failedPrereq,
        missingPrereq,
        message: `Student has FAILED prerequisite(s): ${failedPrereq.join(
          ", "
        )}. They must PASS these before enrolling in ${course_code}.`,
      });
    }

    if (missingPrereq.length > 0) {
      return res.json({
        allowed: false,
        status: "MISSING_PREREQ",
        failedPrereq,
        missingPrereq,
        message: `Student must FIRST ENROLL and PASS prerequisite(s): ${missingPrereq.join(
          ", "
        )} before taking ${course_code}.`,
      });
    }

    return res.json({
      allowed: true,
      status: "OK",
      failedPrereq: [],
      missingPrereq: [],
      message: `All prerequisites satisfied for ${course_code}.`,
    });
  } catch (err) {
    console.error("Error in /api/check-prerequisite:", err);
    return res.status(500).json({
      allowed: false,
      status: "SERVER_ERROR",
      message: err.message,
    });
  }
});

router.post("/add-all-to-enrolled-courses-summer", async (req, res) => {
  const {
    subject_id,
    user_id,
    curriculumID,
    departmentSectionID,
    year_level,
    active_school_year_id,
    active_semester_id,
  } = req.body;

  try {
    let activeSchoolYearId = active_school_year_id;
    let activeSemesterId = active_semester_id;

    if (activeSchoolYearId && !activeSemesterId) {
      const [schoolYearRows] = await db3.query(
        `SELECT semester_id FROM active_school_year_table WHERE id = ? LIMIT 1`,
        [activeSchoolYearId],
      );
      activeSemesterId = schoolYearRows[0]?.semester_id || null;
    }

    if (!activeSchoolYearId || !activeSemesterId) {
      const activeYearSql = `SELECT id, semester_id FROM active_school_year_table WHERE astatus = 1 LIMIT 1`;
      const [yearResult] = await db3.query(activeYearSql);

      if (yearResult.length === 0) {
        return res.status(404).json({ error: "No active school year found" });
      }

      activeSchoolYearId = activeSchoolYearId || yearResult[0].id;
      activeSemesterId = activeSemesterId || yearResult[0].semester_id;
    }

    const checkSql = `
      SELECT year_level_id, semester_id, curriculum_id
      FROM program_tagging_table
      WHERE course_id = ? AND curriculum_id = ?
      LIMIT 1
    `;

    const [checkResult] = await db3.query(checkSql, [subject_id, curriculumID]);

    if (!checkResult.length) {
      console.warn(`Subject ${subject_id} not found in tagging table`);
      return res.status(404).json({ message: "Subject not found" });
    }

    const { year_level_id, semester_id, curriculum_id } = checkResult[0];

    if (year_level_id !== year_level || curriculum_id !== curriculumID) {
      console.log(
        `Skipping subject ${subject_id} (wrong year level or curriculum)`,
      );
      return res.status(200).json({
        message: "Skipped - Wrong Year Level / Wrong Curriculum",
      });
    }

    const checkDuplicateSql = `
      SELECT * FROM enrolled_subject
      WHERE course_id = ? AND student_number = ? AND active_school_year_id = ?
    `;

    const [dupResult] = await db3.query(checkDuplicateSql, [
      subject_id,
      user_id,
      activeSchoolYearId,
    ]);

    if (dupResult.length > 0) {
      console.log(
        `Skipping subject ${subject_id}, already enrolled for student ${user_id}`,
      );
      return res.status(200).json({ message: "Skipped - Already Enrolled" });
    }

    const insertSql = `
      INSERT INTO enrolled_subject (course_id, student_number, active_school_year_id, curriculum_id, department_section_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db3.query(insertSql, [
      subject_id,
      user_id,
      activeSchoolYearId,
      curriculumID,
      departmentSectionID,
      1,
    ]);
    console.log(
      `Student ${user_id} successfully enrolled in subject ${subject_id} (summer bulk)`,
    );

    const updateStatusSql = `
      UPDATE student_status_table
      SET enrolled_status = 1, active_curriculum = ?, year_level_id = ?, active_school_year_id = ?
      WHERE student_number = ?
    `;

    await db3.query(updateStatusSql, [
      curriculumID,
      year_level,
      activeSchoolYearId,
      user_id,
    ]);

    const [getStudentNUmber] = await db3.query(
      `
      SELECT id, person_id FROM student_numbering_table WHERE student_number = ?
    `,
      [user_id],
    );

    if (getStudentNUmber.length === 0) {
      console.log("Student number not found");
    }

    const student_numbering_id = getStudentNUmber[0].id;
    const person_id = getStudentNUmber[0].person_id;

    const [getDepartmentID] = await db3.query(
      `
      SELECT dprtmnt_id FROM dprtmnt_curriculum_table WHERE curriculum_id = ?
    `,
      [curriculumID],
    );

    if (getDepartmentID.length === 0) {
      console.log("Department ID not found");
    }

    const department_id = getDepartmentID[0].dprtmnt_id;

    const [checkExistingCurriculum] = await db3.query(
      `
      SELECT * FROM student_curriculum_table
      WHERE student_numbering_id = ? AND curriculum_id = ?
      `,
      [student_numbering_id, curriculum_id],
    );

    await db3.query(
      `
        UPDATE user_accounts SET dprtmnt_id = ? WHERE person_id = ?
      `,
      [department_id, person_id],
    );

    if (checkExistingCurriculum.length === 0) {
      await db3.query(
        `
        INSERT INTO student_curriculum_table (student_numbering_id, curriculum_id)
        VALUES (?, ?)
        `,
        [student_numbering_id, curriculum_id],
      );
    } else {
      console.log(
        `⚠️ Curriculum ${curriculum_id} already exists for student ${user_id}`,
      );
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const courseLabel = await getCourseLabel(subject_id);
    await insertCourseTaggingAuditLog({
      req,
      action: "COURSE_TAGGING_SUMMER_BULK_ENROLL",
      message: `${roleLabel} (${actorId}) enrolled ${courseLabel} to Student (${user_id}) via summer bulk course tagging.`,
    });

    res.status(200).json({ message: "Course enrolled successfully" });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  } 
});

module.exports = router;
