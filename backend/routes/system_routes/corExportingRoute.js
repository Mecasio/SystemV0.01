const express = require("express");
const { db, db3 } = require("../database/database");

const router = express.Router();

router.get("/get_student_number", async (req, res) => {
  try {
    const [rows] = await db3.query(`
        SELECT DISTINCT
            sts.student_number,
            pt.person_id,
            sts.year_level_id,
            pt.campus,
            ct.curriculum_id,
            sy.id AS active_school_year_id,
            sy.year_id,
            sy.semester_id
        FROM student_status_table sts
            JOIN student_numbering_table snt ON sts.student_number = snt.student_number
            JOIN person_table pt ON snt.person_id = pt.person_id
            JOIN curriculum_table ct ON sts.active_curriculum = ct.curriculum_id
            JOIN dprtmnt_curriculum_table dct ON ct.curriculum_id = dct.curriculum_id
            JOIN dprtmnt_table dt ON dct.dprtmnt_id = dt.dprtmnt_id
            JOIN active_school_year_table sy ON sts.active_school_year_id = sy.id
        WHERE enrolled_status = 1;
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching data" });
  }
});

module.exports = router;
