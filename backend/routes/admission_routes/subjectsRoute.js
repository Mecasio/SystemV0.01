const express = require("express");
const { db } = require("../database/database");

const router = express.Router();

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

    await db.query(`
      UPDATE subjects
      SET
        name = ?,
        max_score = ?,
        is_active = ?
      WHERE id = ?
    `, [name, max_score, is_active, id]);

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

    await db.query(`
      UPDATE subjects
      SET is_active = 0
      WHERE id = ?
    `, [id]);

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