const express = require("express");
const { db3 } = require("../database/database");
const router = express.Router();

router.get("/get_student_per_section", async (req, res) => {
  const { department_section_id, active_school_year_id } = req.query;
  console.log(
    "Received params - Department Section ID:",
    department_section_id,
    "Active School Year ID:",
    active_school_year_id,
  );
  try {
    const [rows] = await db3.query(
      `
      SELECT 
      es.student_number, p.first_name, p.last_name,
      pgt.program_code, pgt.program_id, pgt.program_description,
      s.student_number
      FROM enrolled_subject es
      JOIN student_numbering_table s ON es.student_number = s.student_number
      JOIN person_table p ON s.person_id = p.person_id
      JOIN curriculum_table ct ON es.curriculum_id = ct.curriculum_id
      JOIN program_table pgt ON ct.program_id = pgt.program_id
      WHERE es.department_section_id = ? AND es.active_school_year_id = ? AND course_id IN (
        SELECT course_id FROM course_table WHERE course_code IN ('NSTPROG1', 'NSTPROG2')
      )
      `,
      [department_section_id, active_school_year_id],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch student data" });
  }
});

router.get("/get_nstp_tagged_student", async (req, res) => {
  const { department_section_id, active_school_year_id } = req.query;
  console.log(
    "Received params - Department Section ID:",
    department_section_id,
    "Active School Year ID:",
    active_school_year_id,
  );
  try {
    const [rows] = await db3.query(
      `SELECT 
        es.student_number,
        p.first_name,
        p.last_name,
        pgt.program_code,
        pgt.program_id,
        pgt.program_description,
        s.student_number,
        es.component
      FROM enrolled_subject es
      JOIN student_numbering_table s ON es.student_number = s.student_number
      JOIN person_table p ON s.person_id = p.person_id
      JOIN curriculum_table ct ON es.curriculum_id = ct.curriculum_id
      JOIN program_table pgt ON ct.program_id = pgt.program_id
      WHERE es.department_section_id = ?
        AND es.active_school_year_id = ?
        AND es.component IS NOT NULL
        AND es.component != 0
        AND es.course_id IN (
          SELECT course_id 
          FROM course_table 
          WHERE course_code IN ('NSTPROG1', 'NSTPROG2')
        );
      `,
      [department_section_id, active_school_year_id],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch NSTP tagged students" });
  }
});

router.put("/enroll_nstp_component", async (req, res) => {
  const {
    department_section_id,
    active_school_year_id,
    curriculum_id,
    nstp_type,
  } = req.body;

  try {
    if (
      !department_section_id ||
      !active_school_year_id ||
      !curriculum_id ||
      !nstp_type
    ) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const sql = `
      UPDATE enrolled_subject
      SET component = ?
      WHERE student_number IN (
        SELECT student_number FROM enrolled_subject
        WHERE department_section_id = ? AND active_school_year_id = ? AND curriculum_id = ?
      ) AND course_id IN (
        SELECT course_id FROM course_table WHERE course_code IN ('NSTPROG1', 'NSTPROG2')
      )
    `;

    await db3.execute(sql, [
      nstp_type,
      department_section_id,
      active_school_year_id,
      curriculum_id,
    ]);
    res.json({
      message: "NSTP components updated successfully for the section",
    });
  } catch (err) {
    console.error("Error updating NSTP components:", err);
    res.status(500).json({ error: "Failed to update NSTP components" });
  }
});

router.put("/enroll_nstp_component/:student_number", async (req, res) => {
  const { student_number } = req.params;
  const {
    department_section_id,
    active_school_year_id,
    curriculum_id,
    nstp_type,
  } = req.body;
  console.log(
    "Received params - Student Number:",
    student_number,
    "Department Section ID:",
    department_section_id,
    "Active School Year ID:",
    active_school_year_id,
    "Curriculum ID:",
    curriculum_id,
    "NSTP Type:",
    nstp_type,
  );
  try {
    if (
      !student_number ||
      !department_section_id ||
      !active_school_year_id ||
      !curriculum_id ||
      !nstp_type
    ) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const sql = `
      UPDATE enrolled_subject
      SET component = ?
      WHERE student_number = ? AND department_section_id = ? AND active_school_year_id = ? AND curriculum_id = ? AND course_id IN (
        SELECT course_id FROM course_table WHERE course_code IN ('NSTPROG1', 'NSTPROG2')
      )
    `;

    await db3.execute(sql, [
      nstp_type,
      student_number,
      department_section_id,
      active_school_year_id,
      curriculum_id,
    ]);
    res.json({
      message: "NSTP component updated successfully for the student",
    });
  } catch (err) {
    console.error("Error updating NSTP component for student:", err);
    res
      .status(500)
      .json({ error: "Failed to update NSTP component for the student" });
  }
});

router.put("/unenroll_nstp_component", async (req, res) => {
  const { department_section_id, active_school_year_id, curriculum_id } =
    req.body;

  try {
    if (!department_section_id || !active_school_year_id || !curriculum_id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const sql = `
      UPDATE enrolled_subject
      SET component = 0
      WHERE department_section_id = ? AND active_school_year_id = ? AND curriculum_id = ? AND course_id IN (
        SELECT course_id FROM course_table WHERE course_code IN ('NSTPROG1', 'NSTPROG2')
      )
    `;

    await db3.execute(sql, [
      department_section_id,
      active_school_year_id,
      curriculum_id,
    ]);
    res.json({
      message: "NSTP components unenrolled successfully for the section",
    });
  } catch (err) {
    console.error("Error unenrolling NSTP components:", err);
    res.status(500).json({ error: "Failed to unenroll NSTP components" });
  }
});

router.put("/unenroll_nstp_component/:student_number", async (req, res) => {
  const { student_number } = req.params;
  const { department_section_id, active_school_year_id, curriculum_id } =
    req.body;

  try {
    if (
      !student_number ||
      !department_section_id ||
      !active_school_year_id ||
      !curriculum_id
    ) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const sql = `
      UPDATE enrolled_subject
      SET component = 0
      WHERE student_number = ? AND department_section_id = ? AND active_school_year_id = ? AND curriculum_id = ? AND course_id IN (
        SELECT course_id FROM course_table WHERE course_code IN ('NSTPROG1', 'NSTPROG2')
      )
    `;

    await db3.execute(sql, [
      student_number,
      department_section_id,
      active_school_year_id,
      curriculum_id,
    ]);
    res.json({
      message: "NSTP component unenrolled successfully for the student",
    });
  } catch (err) {
    console.error("Error unenrolling NSTP component for student:", err);
    res
      .status(500)
      .json({ error: "Failed to unenroll NSTP component for the student" });
  }
});

module.exports = router;