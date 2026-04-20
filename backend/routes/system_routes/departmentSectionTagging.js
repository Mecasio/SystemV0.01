const express = require("express");
const { db3 } = require("../database/database");
const router = express.Router();

router.get('/get_student_per_curriculum', async (req, res) => {
  const { curriculum_id, active_school_year_id } = req.query;
  console.log("Received params - Curriculum ID:", curriculum_id, "Active School Year ID:", active_school_year_id);
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
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? and (es.department_section_id IS NULL or es.department_section_id = 0)
            GROUP BY es.student_number
            `,
            [curriculum_id, active_school_year_id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "No students found for the given curriculum and school year" });
        }

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch student data" });
    }
});

router.get('/get_student_already_tagged', async (req, res) => {
  const { curriculum_id, active_school_year_id } = req.query;
  console.log("Received params - Curriculum ID:", curriculum_id, "Active School Year ID:", active_school_year_id);
    try {
        const [rows] = await db3.query(
            `SELECT
            es.student_number, p.first_name, p.last_name,
            pgt.program_code, pgt.program_id, pgt.program_description,
            s.student_number
            FROM enrolled_subject es
            JOIN student_numbering_table s ON es.student_number = s.student_number
            JOIN person_table p ON s.person_id = p.person_id
            JOIN curriculum_table ct ON es.curriculum_id = ct.curriculum_id
            JOIN program_table pgt ON ct.program_id = pgt.program_id
            WHERE es.curriculum_id = ? AND es.active_school_year_id = ? AND (es.department_section_id IS NOT NULL AND es.department_section_id != 0)
            GROUP BY es.student_number
            `,
            [curriculum_id, active_school_year_id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "No students found for the given curriculum and school year" });
        }
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch student data" });
    }
});

//for bulk enroll
router.put('/enrolled_student_in_section', async (req, res) => {
    const { curriculum_id, active_school_year_id, department_section_id } = req.body;

    if (!curriculum_id || !active_school_year_id || !department_section_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const [result] = await db3.query(
            `
            UPDATE enrolled_subject
            SET department_section_id = ?
            WHERE curriculum_id = ? AND active_school_year_id = ? AND (department_section_id IS NULL OR department_section_id = 0)
            `,
            [department_section_id, curriculum_id, active_school_year_id]
        );

        res.json({
            message: `The students was successfully enrolled in the section`,
            affectedRows: result.affectedRows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to enroll students in section" });
    }
});

router.put('/enrolled_student_in_section/:student_number', async (req, res) => {
  const { student_number } = req.params;
  const { curriculum_id, department_section_id, active_school_year_id } = req.body;

  console.log("Received params - Student Number:", student_number, "Curriculum ID:", curriculum_id, "Department Section ID:", department_section_id, "Active School Year ID:", active_school_year_id);
    if (!curriculum_id || !department_section_id || !active_school_year_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const [result] = await db3.query(
            `
            UPDATE enrolled_subject
            SET department_section_id = ?
            WHERE student_number = ? AND curriculum_id = ? AND active_school_year_id = ?
            `,
            [department_section_id, student_number, curriculum_id, active_school_year_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found or already enrolled in a section" });
        }
        res.json({ message: "Student enrolled in section successfully" });
    } catch (err) {
        console.error(err);        
        res.status(500).json({ error: "Failed to enroll student in section" });
    }   
});
//BULK UNENROLL STUDENTS FROM SECTION
router.put('/unenrolled_student_in_section', async (req, res) => {
  const { curriculum_id, active_school_year_id, department_section_id } = req.body;
    if (!curriculum_id || !active_school_year_id || !department_section_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const [result] = await db3.query(
            `
            UPDATE enrolled_subject
            SET department_section_id = NULL
            WHERE curriculum_id = ? AND active_school_year_id = ? AND department_section_id = ?
            `,
            [curriculum_id, active_school_year_id, department_section_id]
        );
        res.json({ message: "Students unenrolled from section successfully", affectedRows: result.affectedRows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to unenroll students from section" });
    }
});

//UNENROLL STUDENT FROM SECTION
router.put('/unenrolled_student_in_section/:student_number', async (req, res) => {
  const { student_number } = req.params;
  const { curriculum_id, department_section_id, active_school_year_id } = req.body;
    if (!curriculum_id || !department_section_id || !active_school_year_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const [result] = await db3.query(
            `
            UPDATE enrolled_subject
            SET department_section_id = NULL
            WHERE student_number = ? AND curriculum_id = ? AND active_school_year_id = ? AND department_section_id = ?
            `,
            [student_number, curriculum_id, active_school_year_id, department_section_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found or not enrolled in the specified section" });
        }
        res.json({ message: "Student unenrolled from section successfully" });
    } catch (err) {
        console.error(err);        
        res.status(500).json({ error: "Failed to unenroll student from section" });
    }   
});

module.exports = router;
