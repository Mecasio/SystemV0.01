const express = require('express');
const { db, db3 } = require('../database/database');
const {CanCreate, CanEdit, CanDelete} = require('../../middleware/pagePermissions');
const router = express.Router();

/* ===================== GET COURSE LIST ===================== */
router.get("/course_list", async (req, res) => {
  const query = "SELECT * FROM course_table ORDER BY course_code ASC";

  try {
    const [result] = await db3.query(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({
      error: "Query failed",
      details: err.message,
    });
  }
});

router.post("/adding_course", CanCreate, async (req, res) => {
  const {
    course_code,
    course_description,
    course_unit,
    lec_unit,
    lab_unit,
    prereq,
    corequisite,
    is_included,
    include_summa,
    include_magna,
    include_cum,
  } = req.body;

  try {
    const normalizeCode = (code) =>
    (code || "")
      .replace(/[^A-Za-z0-9-_\. ]/g, "") 
      .replace(/(\S) +(\S)/g, "$1 $2")    
      .replace(/^ +| +$/g, "")          
      .toUpperCase();

    const normalizeDescription = (desc) => (desc || "").trim();

    const normalized_code = normalizeCode(course_code);
    const normalized_desc = normalizeDescription(course_description);

    const unit = parseFloat(course_unit) || 0;
    const lec = parseFloat(lec_unit) || 0;
    const lab = parseFloat(lab_unit) || 0;

    if (!normalized_code) {
      return res.status(400).json({ message: "Course code is required" });
    }

    if (!normalized_desc) {
      return res.status(400).json({ message: "Course description is required" });
    }

    const [rows] = await db3.query(
      `SELECT course_id FROM course_table 
   WHERE course_code = ?
   AND course_description = ?
   AND course_unit = ?
   AND lec_unit = ?
   AND lab_unit = ?
   AND (prereq <=> ?)
   AND (corequisite <=> ?)
   AND (is_included <=> ?)
   AND (include_summa <=> ?)
   AND (include_magna <=> ?)
   AND (include_cum <=> ?)`,
      [
        normalized_code,
        normalized_desc,
        unit,
        lec,
        lab,
        prereq || null,
        corequisite || null,
        is_included ?? 1,
        include_summa ?? 1,
        include_magna ?? 1,
        include_cum ?? 1
      ]
    );

    
    if (rows.length > 0) {
      return res.status(400).json({
        message: "❌ Exact duplicate course already exists",
      });
    }

    await db3.query(
      `INSERT INTO course_table
  (course_code, course_description, course_unit, lec_unit, lab_unit, prereq, corequisite, is_included, include_summa, include_magna, include_cum)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized_code,
        normalized_desc,
        unit,
        lec,
        lab,
        prereq || null,
        corequisite || null,
        is_included ?? 1,
        include_summa ?? 1,
        include_magna ?? 1,
        include_cum ?? 1
      ]
    );


    res.status(200).json({ message: "✅ Course added successfully" });

  } catch (error) {
    console.error("❌ Error adding course:", error);
    res.status(500).json({ message: "Failed to add course" });
  }
});

router.put("/update_course/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const {
    course_code,
    course_description,
    course_unit,
    lec_unit,
    lab_unit,
    prereq,
    corequisite,
    is_included,
    include_summa,
    include_magna,
    include_cum
  } = req.body;

  try {
    const [currentRows] = await db3.query(
      "SELECT * FROM course_table WHERE course_id = ?",
      [id]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    const current = currentRows[0];

    // Same normalization as adding
    const normalizeCode = (code) =>
    (code || "")
      .replace(/[^A-Za-z0-9-_\. ]/g, "")
      .replace(/(\S) +(\S)/g, "$1 $2") 
      .replace(/^ +| +$/g, "")           
      .toUpperCase();

    const normalizeDescription = (desc) => (desc || "").trim();

    const final_course_code = course_code
      ? normalizeCode(course_code)
      : normalizeCode(current.course_code);

    const final_course_desc = course_description
      ? normalizeDescription(course_description)
      : normalizeDescription(current.course_description);

    const [rows] = await db3.query(
      `SELECT course_id FROM course_table 
   WHERE course_code = ?
   AND course_description = ?
   AND course_unit = ?
   AND lec_unit = ?
   AND lab_unit = ?
   AND (prereq <=> ?)
   AND (corequisite <=> ?)
   AND (is_included <=> ?)
   AND (include_summa <=> ?)
   AND (include_magna <=> ?)
   AND (include_cum <=> ?)
   AND course_id != ?`,
      [
        final_course_code,
        final_course_desc,
        course_unit ?? current.course_unit,
        lec_unit ?? current.lec_unit,
        lab_unit ?? current.lab_unit,
        prereq ?? current.prereq,
        corequisite ?? current.corequisite,
        is_included ?? current.is_included,
        include_summa ?? current.include_summa,
        include_magna ?? current.include_magna,
        include_cum ?? current.include_cum,
        id
      ]
    );

    if (rows.length > 0) {
      return res.status(400).json({ message: "The course already exists" });
    }

    await db3.query(
      `UPDATE course_table SET
    course_code = ?,
    course_description = ?,
    course_unit = ?,
    lec_unit = ?,
    lab_unit = ?,
    prereq = ?,
    corequisite = ?,
    is_included = ?,
    include_summa = ?,
    include_magna = ?,
    include_cum = ?
  WHERE course_id = ?`,
      [
        final_course_code,
        final_course_desc,
        course_unit !== undefined && course_unit !== ""
          ? parseFloat(course_unit)
          : current.course_unit,
        lec_unit !== undefined ? parseFloat(lec_unit) : current.lec_unit,
        lab_unit !== undefined ? parseFloat(lab_unit) : current.lab_unit,
        prereq !== undefined ? prereq : current.prereq,
        corequisite !== undefined ? corequisite : current.corequisite,
        is_included !== undefined ? Number(is_included) : current.is_included,
        include_summa !== undefined ? Number(include_summa) : current.include_summa,
        include_magna !== undefined ? Number(include_magna) : current.include_magna,
        include_cum !== undefined ? Number(include_cum) : current.include_cum,
        id,
      ]
    );

    res.json({ message: "✅ Course updated successfully" });
  } catch (error) {
    console.error("❌ Error updating course:", error);
    res.status(500).json({ message: "Failed to update course" });
  }
});

router.delete("/delete_course/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db3.query(
      "DELETE FROM course_table WHERE course_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ message: "✅ Course deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting course:", error);
    res.status(500).json({ message: "Failed to delete course" });
  }
});

module.exports = router;
