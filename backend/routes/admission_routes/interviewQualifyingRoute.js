const express = require("express");
const jwt = require("jsonwebtoken");
const { db, db3 } = require("../database/database");

const router = express.Router();

const JWT_SECRET = "your_secret_key";


// =====================================================
// 🔐 VERIFY TOKEN
// =====================================================

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    console.log("❌ Invalid token");
    req.user = null;
  }

  next();
}


// =====================================================
// 📝 AUDIT LOG
// =====================================================

async function insertAuditLog({
  actorId,
  role,
  action,
  message,
  severity,
}) {
  try {
    await db.query(
      `
      INSERT INTO audit_logs
      (
        actor_id,
        role,
        action,
        message,
        severity
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        actorId || "unknown",
        role || "unknown",
        action || "UNKNOWN",
        message || "No message",
        severity || "INFO",
      ]
    );
  } catch (err) {
    console.error("❌ Audit log insert failed:", err);
  }
}


// =====================================================
// 🧮 HELPERS
// =====================================================

const toNumberOrNull = (val) => {
  if (
    val === undefined ||
    val === null ||
    val === ""
  ) {
    return null;
  }

  const num = Number(val);

  return isNaN(num) ? null : num;
};


const isDifferent = (oldVal, newVal) => {
  return (oldVal ?? null) != (newVal ?? null);
};


// =====================================================
// 🚀 SAVE INTERVIEW (FINAL SAFE VERSION)
// =====================================================

// Assign Max Slots
router.put("/api/interview_applicants/assign-max", async (req, res) => {
  try {
    const { dprtmnt_id, schoolYear, semester } = req.body;

    if (!dprtmnt_id || !schoolYear || !semester) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get top applicants for that dept, year, sem
    const [topApplicants] = await db.query(
      `SELECT ea.applicant_id
       FROM exam_applicants ea
       WHERE ea.dprtmnt_id = ? AND ea.school_year = ? AND ea.semester = ?
       ORDER BY ea.total_score DESC, ea.exam_date ASC`,
      [dprtmnt_id, schoolYear, semester],
    );

    if (!topApplicants.length) {
      return res.json({ success: false, message: "No applicants found" });
    }

    // Insert/update into interview_applicants with action = 1
    for (const applicant of topApplicants) {
      await db.query(
        `INSERT INTO interview_applicants (applicant_id, action, email_sent)
         VALUES (?, 1, 0)
         ON DUPLICATE KEY UPDATE action = 1`,
        [applicant.applicant_id],
      );
    }

    res.json({ success: true, count: topApplicants.length });
  } catch (err) {
    console.error("Error in assign-max:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Assign Custom Slots
router.put("/api/interview_applicants/assign-custom", async (req, res) => {
  try {
    const { dprtmnt_id, schoolYear, semester, count } = req.body;

    if (!dprtmnt_id || !schoolYear || !semester || !count) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get top N applicants
    const [topApplicants] = await db.query(
      `SELECT ea.applicant_id
       FROM exam_applicants ea
       WHERE ea.dprtmnt_id = ? AND ea.school_year = ? AND ea.semester = ?
       ORDER BY ea.total_score DESC, ea.exam_date ASC
       LIMIT ?`,
      [dprtmnt_id, schoolYear, semester, Number(count)],
    );

    if (!topApplicants.length) {
      return res.json({ success: false, message: "No applicants found" });
    }

    // Insert/update into interview_applicants with action = 1
    for (const applicant of topApplicants) {
      await db.query(
        `INSERT INTO interview_applicants (applicant_id, action, email_sent)
         VALUES (?, 1, 0)
         ON DUPLICATE KEY UPDATE action = 1`,
        [applicant.applicant_id],
      );
    }

    res.json({ success: true, count: topApplicants.length });
  } catch (err) {
    console.error("Error in assign-custom:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post(
  "/api/interview/save",
  verifyToken,
  async (req, res) => {
    try {
      const {
        applicant_number,
        qualifying_exam_score,
        qualifying_interview_score,
        status,
      } = req.body;

      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!applicant_number) {
        return res.status(400).json({
          error: "Applicant number is required",
        });
      }

      // -------------------------------------------------
      // ACTOR
      // -------------------------------------------------

      let actor = {
        email: "unknown",
        role: "unknown",
      };

      if (req.user?.email) {
        const [userRows] =
          await db3.query(
            `
            SELECT
              email,
              role
            FROM user_accounts
            WHERE email = ?
            LIMIT 1
            `,
            [req.user.email]
          );

        if (userRows.length) {
          actor = userRows[0];
        }
      }

      // -------------------------------------------------
      // GET person_id
      // -------------------------------------------------

      const [rows] = await db.query(
        `
        SELECT person_id
        FROM applicant_numbering_table
        WHERE applicant_number = ?
        LIMIT 1
        `,
        [applicant_number]
      );

      if (!rows.length) {
        return res.status(400).json({
          error: "Applicant not found",
        });
      }

      const personId =
        rows[0].person_id;

      // -------------------------------------------------
      // GET OLD DATA
      // -------------------------------------------------

      const [oldRows] = await db.query(
        `
        SELECT
          qualifying_result,
          interview_result,
          exam_result
        FROM person_status_table
        WHERE person_id = ?
        LIMIT 1
        `,
        [personId]
      );

      const [oldStatusRows] =
        await db.query(
          `
          SELECT status
          FROM interview_applicants
          WHERE applicant_id = ?
          LIMIT 1
          `,
          [applicant_number]
        );

      const oldData =
        oldRows[0] || {};

      const oldStatus =
        oldStatusRows[0]?.status ??
        null;

      // -------------------------------------------------
      // NEW VALUES
      // -------------------------------------------------

      const qExam =
        toNumberOrNull(
          qualifying_exam_score
        );

      const qInterview =
        toNumberOrNull(
          qualifying_interview_score
        );

      const finalAve =
        qExam !== null &&
        qInterview !== null
          ? (
              qExam +
              qInterview
            ) / 2
          : null;

      const newStatus =
        status === ""
          ? null
          : status;

      // -------------------------------------------------
      // CHECK CHANGES FIRST
      // -------------------------------------------------

      let changes = [];

      if (
        isDifferent(
          oldData.qualifying_result,
          qExam
        )
      ) {
        changes.push(
          `Qualifying Exam: ${
            oldData.qualifying_result ??
            "NONE"
          } → ${
            qExam ?? "NONE"
          }`
        );
      }

      if (
        isDifferent(
          oldData.interview_result,
          qInterview
        )
      ) {
        changes.push(
          `Interview Score: ${
            oldData.interview_result ??
            "NONE"
          } → ${
            qInterview ?? "NONE"
          }`
        );
      }

      if (
        isDifferent(
          oldData.exam_result,
          finalAve
        )
      ) {
        changes.push(
          `Final Average: ${
            oldData.exam_result ??
            "NONE"
          } → ${
            finalAve ?? "NONE"
          }`
        );
      }

      if (
        isDifferent(
          oldStatus,
          newStatus
        )
      ) {
        changes.push(
          `Status: ${
            oldStatus ?? "NONE"
          } → ${
            newStatus ?? "NONE"
          }`
        );
      }

      // -------------------------------------------------
      // 🚫 STOP DUPLICATE SAVE
      // -------------------------------------------------

      if (changes.length === 0) {
        return res.json({
          success: true,
          message:
            "No changes detected",
        });
      }

      // -------------------------------------------------
      // SAVE DATA
      // -------------------------------------------------

      await db.query(
        `
        INSERT INTO person_status_table
        (
          person_id,
          qualifying_result,
          interview_result,
          exam_result
        )
        VALUES (?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE

        qualifying_result =
          COALESCE(
            VALUES(
              qualifying_result
            ),
            qualifying_result
          ),

        interview_result =
          COALESCE(
            VALUES(
              interview_result
            ),
            interview_result
          ),

        exam_result =
          COALESCE(
            VALUES(
              exam_result
            ),
            exam_result
          )
        `,
        [
          personId,
          qExam,
          qInterview,
          finalAve,
        ]
      );

      if (status !== undefined) {
        await db.query(
          `
          UPDATE interview_applicants
          SET status =
            COALESCE(
              ?,
              status
            )
          WHERE applicant_id = ?
          `,
          [
            newStatus,
            applicant_number,
          ]
        );
      }

      // -------------------------------------------------
      // INSERT AUDIT LOG (ONCE)
      // -------------------------------------------------

      const message =
        `Applicant #${applicant_number} updated:\n` +
        changes.join("\n");

      await insertAuditLog({
        actorId:
          actor.email,
        role:
          actor.role,
        action:
          "EDIT",
        message,
        severity:
          "INFO",
      });

      // -------------------------------------------------

      return res.json({
        success: true,
        message:
          "Saved successfully",
      });

    } catch (err) {
      console.error(
        "❌ SAVE ERROR:",
        err
      );

      res.status(500).json({
        error:
          "Failed to save",
        details:
          err.message,
      });
    }
  }
);

module.exports = router;
