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

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const resolveAuditActor = async (req, fallbackActor = {}) => {
  const lookupId =
    req.body?.audit_actor_id ||
    req.headers["x-audit-actor-id"] ||
    req.headers["x-employee-id"] ||
    req.user?.employee_id ||
    req.user?.person_id ||
    fallbackActor.employee_id ||
    fallbackActor.email ||
    "unknown";
  const lookupEmail =
    req.body?.audit_actor_email ||
    req.headers["x-audit-actor-email"] ||
    req.user?.email ||
    fallbackActor.email ||
    "";

  try {
    const [rows] = await db3.query(
      `SELECT
          ua.employee_id,
          ua.email,
          at.access_description
       FROM user_accounts ua
       LEFT JOIN access_table at ON at.access_id = ua.access_level
       WHERE ua.person_id = ? OR ua.employee_id = ? OR ua.email = ?
       LIMIT 1`,
      [lookupId, lookupId, lookupEmail || lookupId],
    );

    if (rows.length) {
      return {
        actorId: rows[0].employee_id || lookupId,
        role:
          req.body?.audit_actor_role ||
          req.headers["x-audit-actor-role"] ||
          rows[0].access_description ||
          fallbackActor.role ||
          "registrar",
        email: rows[0].email || lookupEmail || fallbackActor.email || "",
      };
    }
  } catch (err) {
    console.error("Failed to resolve qualifying/interview audit actor:", err);
  }

  return {
    actorId: lookupId,
    role:
      req.body?.audit_actor_role ||
      req.headers["x-audit-actor-role"] ||
      fallbackActor.role ||
      "registrar",
    email: lookupEmail || fallbackActor.email || "",
  };
};

const getApplicantAuditDetails = async (applicantNumber) => {
  const [rows] = await db.query(
    `SELECT
        ant.applicant_number,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.emailAddress
     FROM applicant_numbering_table ant
     LEFT JOIN person_table pt ON pt.person_id = ant.person_id
     WHERE ant.applicant_number = ?
     LIMIT 1`,
    [applicantNumber],
  );

  return rows[0] || null;
};

router.get("/api/applicants-with-number", async (req, res) => {
  try {

    // ✅ SUBJECTS
    const [subjects] = await db.query(`
      SELECT id, name, max_score
      FROM subjects
      WHERE is_active = 1
      ORDER BY id ASC
    `);

 
    const [rows] = await db.query(`
      SELECT DISTINCT
        p.person_id,
        p.applyingAs,
        p.emailAddress,
        p.campus,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.extension,
        a.applicant_number,
        SUBSTRING(a.applicant_number, 5, 1) AS middle_code,
        p.program,
        p.generalAverage1,
        p.created_at,

        er.id AS exam_result_id,
        er.total_score,
        er.percentage,
        er.final_rating,
        er.status AS exam_status,

        ia.status AS interview_status,
        ia.action,
        ia.email_sent,

        -- From person_status_table
        COALESCE(ps.interview_status, 0) AS applicant_interview_status,
        COALESCE(ps.exam_result, 0) AS total_ave,
        COALESCE(ps.qualifying_result, 0) AS qualifying_exam_score,
        COALESCE(ps.interview_result, 0) AS qualifying_interview_score,

        ia.status AS college_approval_status

      FROM admission.person_table p
      INNER JOIN admission.applicant_numbering_table a
        ON p.person_id = a.person_id

      LEFT JOIN exam_results er
        ON p.person_id = er.person_id

      LEFT JOIN admission.person_status_table ps
        ON p.person_id = ps.person_id

      LEFT JOIN admission.interview_applicants ia
        ON ia.applicant_id = a.applicant_number

      ORDER BY p.person_id ASC
    `);

    // ✅ DETAILS (per subject scores)
    const [details] = await db.query(`
      SELECT exam_result_id, subject_id, score
      FROM exam_result_details
    `);

    // ✅ FORMAT RESULT (same logic as your working API)
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

      const total = Object.values(scores).reduce((sum, val) => sum + val, 0);

      const maxTotal = subjects.reduce(
        (sum, sub) => sum + Number(sub.max_score || 0),
        0
      );

      const percentage =
        row.percentage ??
        (maxTotal > 0 ? (total / maxTotal) * 100 : 0);

      const final_rating =
        row.final_rating ??
        (subjects.length > 0 ? total / subjects.length : 0);

      return {
        ...row,
        scores,
        total,
        percentage,
        final_rating
      };
    });

    // ✅ SEND
    res.json({
      subjects,
      data: formatted
    });

  } catch (err) {
    console.error("Error fetching applicants with number:", err);
    res.status(500).send("Server error");
  }
});



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

      actor = await resolveAuditActor(req, actor);

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
      const applicantDetails = await getApplicantAuditDetails(applicant_number);
      const applicantName = [
        applicantDetails?.first_name,
        applicantDetails?.middle_name,
        applicantDetails?.last_name,
      ]
        .filter(Boolean)
        .join(" ");
      const applicantEmail = applicantDetails?.emailAddress || "No email";

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
          } -> ${
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
          } -> ${
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
          } -> ${
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
          } -> ${
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

      const roleLabel = formatAuditActorRole(actor.role);
      const message =
        `${roleLabel} (${actor.actorId}) - ${actor.email || "No email"} updated Applicant #${applicant_number}${applicantName ? ` - ${applicantName}` : ""} (${applicantEmail}):\n` +
        changes.join("\n");

      await insertAuditLog({
        actorId:
          actor.actorId,
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
