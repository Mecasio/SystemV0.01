const express = require("express");
const jwt = require("jsonwebtoken");
const { db, db3 } = require("../database/database");

const router = express.Router();


// -----------------------------
// VERIFY TOKEN
// -----------------------------
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, "your_secret_key");
  } catch (err) {
    req.user = null;
  }

  next();
}


// -----------------------------
// AUDIT LOG
// -----------------------------
async function insertAuditLog({
  actorId,
  role,
  action,
  message,
  severity,
}) {
  try {
    await db.query(
      `INSERT INTO audit_logs
      (actor_id, role, action, message, severity)
      VALUES (?, ?, ?, ?, ?)`,
      [
        actorId || "unknown",
        role || "unknown",
        action || "UNKNOWN",
        message || "No message",
        severity || "INFO"
      ]
    );
  } catch (err) {
    console.error(err);
  }
}


//////////////////////////////////////////////////////////////
// GET ACTIVE SUBJECTS
//////////////////////////////////////////////////////////////
router.get("/api/subjects", async (req, res) => {
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
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});


//////////////////////////////////////////////////////////////
// GET APPLICANT SCORING
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
// GET APPLICANT SCORING
//////////////////////////////////////////////////////////////
router.get("/api-applicant-scoring", async (req, res) => {
  try {

    // ✅ SUBJECTS (dynamic)
    const [subjects] = await db.query(`
      SELECT id, name, max_score
      FROM subjects
      WHERE is_active = 1
      ORDER BY id ASC
    `);

    const [rows] = await db.query(`
      SELECT DISTINCT
        p.person_id,
        p.campus,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.extension,
        a.applicant_number,
        SUBSTRING(a.applicant_number, 5, 1) AS middle_code,
        p.program,
        p.created_at,

        er.id AS exam_result_id,
        er.total_score,
        er.percentage,
        er.final_rating,
        er.status,

        COALESCE(ps.exam_result, 0) AS total_ave,
        COALESCE(ps.qualifying_result, 0) AS qualifying_exam_score,
        COALESCE(ps.interview_result, 0) AS qualifying_interview_score,

        ia.status AS college_approval_status

      FROM person_table p
      INNER JOIN applicant_numbering_table a
        ON p.person_id = a.person_id

      LEFT JOIN exam_results er
        ON p.person_id = er.person_id

      LEFT JOIN person_status_table ps
        ON p.person_id = ps.person_id

      LEFT JOIN interview_applicants ia
        ON ia.applicant_id = a.applicant_number

      LEFT JOIN exam_applicants ea
        ON a.applicant_number = ea.applicant_id

      WHERE ea.email_sent = 1
      ORDER BY p.person_id ASC
    `);

    // ✅ DETAILS (scores per subject)
    const [details] = await db.query(`
      SELECT exam_result_id, subject_id, score
      FROM exam_result_details
    `);

    // ✅ FORMAT RESULT
    const formatted = rows.map(row => {

      const scores = {};

      // initialize all subjects = 0
      subjects.forEach(sub => {
        scores[sub.id] = 0;
      });

      // fill actual scores
      details
        .filter(d => d.exam_result_id === row.exam_result_id)
        .forEach(d => {
          scores[d.subject_id] = Number(d.score);
        });

      // compute total dynamically
      const total = Object.values(scores)
        .reduce((sum, val) => sum + val, 0);

      const maxTotal = subjects.reduce(
        (sum, sub) => sum + Number(sub.max_score || 0),
        0
      );

      // ✅ Guidance Office Formula
      const percentage =
        maxTotal > 0
          ? ((total / maxTotal) * 50) + 50
          : 0;

      // Final rating same as percentage
      const final_rating =
        subjects.length > 0
          ? total / subjects.length
          : 0;
          
      return {
        ...row,
        scores,
        total,
        percentage,
        final_rating
      };
    });

    // ✅ SEND EVERYTHING
    res.json({
      subjects,
      data: formatted
    });

  } catch (err) {
    console.error("Error fetching applicant scoring:", err);

    res.status(500).send("Server error");
  }
});

//////////////////////////////////////////////////////////////
// SAVE EXAM
//////////////////////////////////////////////////////////////
router.post("/api/exam/save", verifyToken, async (req, res) => {
  try {
    const {
      applicant_number,
      scores,
      status
    } = req.body;

    if (!applicant_number) {
      return res.status(400).json({
        error: "Applicant number required"
      });
    }

    if (!Array.isArray(scores)) {
      return res.status(400).json({
        error: "Scores must be array"
      });
    }

    //--------------------------------------
    // GET USER
    //--------------------------------------
    let actor = {
      email: "unknown",
      role: "unknown"
    };

    if (req.user?.email) {
      const [userRows] = await db3.query(
        `SELECT email, role
         FROM user_accounts
         WHERE email = ?
         LIMIT 1`,
        [req.user.email]
      );

      if (userRows.length) {
        actor = userRows[0];
      }
    }

    //--------------------------------------
    // GET PERSON
    //--------------------------------------
    const [personRows] = await db.query(
      `SELECT person_id
       FROM applicant_numbering_table
       WHERE applicant_number = ?
       LIMIT 1`,
      [applicant_number]
    );

    if (!personRows.length) {
      return res.status(404).json({
        error: "Applicant not found"
      });
    }

    const personId = personRows[0].person_id;

    //--------------------------------------
    // COMPUTE TOTAL
    //--------------------------------------
    let totalScore = 0;

    scores.forEach(item => {
      totalScore += Number(item.score || 0);
    });

    //--------------------------------------
    // GET MAX TOTAL
    //--------------------------------------
    //--------------------------------------
    // GET MAX TOTAL
    //--------------------------------------
    const [maxRows] = await db.query(`
      SELECT SUM(max_score) AS max_total
      FROM subjects
      WHERE is_active = 1
    `);

    const maxTotal = Number(maxRows[0].max_total || 0);

    // Guidance Office Formula
    const percentage =
      maxTotal > 0
        ? ((totalScore / maxTotal) * 50) + 50
        : 0;

    // Final rating same as percentage
    const finalRating =
      scores.length > 0
        ? totalScore / scores.length
        : 0;

    //--------------------------------------
    // CHECK EXISTING EXAM RESULT
    //--------------------------------------
    const [existingRows] = await db.query(
      `SELECT id
       FROM exam_results
       WHERE person_id = ?
       LIMIT 1`,
      [personId]
    );

    let examResultId;

    if (existingRows.length) {
      examResultId = existingRows[0].id;

      await db.query(`
        UPDATE exam_results
        SET
          total_score = ?,
          percentage = ?,
          final_rating = ?,
          status = ?,
          date_created = NOW()
        WHERE id = ?
      `, [
        totalScore,
        percentage,
        finalRating,
        status,
        examResultId
      ]);

      await db.query(`
        DELETE FROM exam_result_details
        WHERE exam_result_id = ?
      `, [examResultId]);

    } else {
      const [insertResult] = await db.query(`
        INSERT INTO exam_results
        (
          person_id,
          total_score,
          percentage,
          final_rating,
          status,
          date_created
        )
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [
        personId,
        totalScore,
        percentage,
        finalRating,
        status
      ]);

      examResultId = insertResult.insertId;
    }

    //--------------------------------------
    // INSERT SUBJECT SCORES
    //--------------------------------------
    for (const item of scores) {
      await db.query(`
        INSERT INTO exam_result_details
        (
          exam_result_id,
          subject_id,
          score
        )
        VALUES (?, ?, ?)
      `, [
        examResultId,
        item.subject_id,
        item.score
      ]);
    }

    //--------------------------------------
    // AUDIT LOG
    //--------------------------------------
    await insertAuditLog({
      actorId: actor.email,
      role: actor.role,
      action: "SAVE_EXAM",
      message: `Saved exam result for applicant #${applicant_number}`,
      severity: "INFO"
    });

    res.json({
      success: true,
      message: "Exam saved successfully"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed saving exam"
    });
  }
});


module.exports = router;