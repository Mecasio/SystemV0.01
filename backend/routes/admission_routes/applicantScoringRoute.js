const express = require("express");
const jwt = require("jsonwebtoken");
const { db, db3 } = require("../database/database");

const router = express.Router();

// -----------------------------
// 🔐 VERIFY TOKEN MIDDLEWARE
// -----------------------------
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.log("❌ No Authorization header");
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "your_secret_key");
    req.user = decoded;
  } catch (err) {
    console.log("❌ Invalid token");
    req.user = null;
  }

  next();
}

// -----------------------------
// 🧠 PASSING LOGIC
// -----------------------------
const PASSING_SCORE = 75;

function getStatus(score) {
  if (score === null || score === undefined) return null;
  return score >= PASSING_SCORE ? "Passed" : "Failed";
}

// -----------------------------
// INSERT AUDIT LOG
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
        severity || "INFO",
      ]
    );
  } catch (err) {
    console.error("❌ Audit log insert failed:", err);
  }
}

// -----------------------------
// SAVE EXAM ROUTE
// -----------------------------
router.post("/api/exam/save", verifyToken, async (req, res) => {
  console.log(" /api/exam/save HIT", req.body);

  try {
    const {
      applicant_number,
      english = null,
      science = null,
      filipino = null,
      math = null,
      abstract = null,
      final_rating = null,
      status = "",
    } = req.body;

    if (!applicant_number) {
      return res.status(400).json({ error: "applicant_number is required" });
    }

    // -----------------------------
    // 🔥 GET USER (SAFE)
    // -----------------------------
    let actor = {
      email: "unknown",
      role: "unknown",
    };

    if (req.user?.email) {
      const [userRows] = await db3.query(
        "SELECT email, role FROM user_accounts WHERE email = ? LIMIT 1",
        [req.user.email]
      );

      if (userRows.length) {
        actor = userRows[0];
      }
    }

    // -----------------------------
    // applicant_number -> person_id
    // -----------------------------
    const [rows] = await db.query(
      "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ? LIMIT 1",
      [applicant_number]
    );

    if (!rows.length) {
      return res.status(400).json({ error: "Applicant number not found" });
    }

    const personId = rows[0].person_id;

    // -----------------------------
    // GET OLD DATA (include status)
    // -----------------------------
    const [oldRows] = await db.query(
      `SELECT English, Science, Filipino, Math, Abstract, status
       FROM admission_exam
       WHERE person_id = ?
       LIMIT 1`,
      [personId]
    );

    const oldData = oldRows[0] || null;

    const toNumberOrNull = (val) =>
      val === undefined || val === null || val === "" ? null : Number(val);

    const e = toNumberOrNull(english);
    const s = toNumberOrNull(science);
    const f = toNumberOrNull(filipino);
    const m = toNumberOrNull(math);
    const a = toNumberOrNull(abstract);
    const fr = toNumberOrNull(final_rating);
    const newStatus = status === "" ? null : status;

    // -----------------------------
    // INSERT / UPDATE
    // -----------------------------
    await db.query(
      `INSERT INTO admission_exam
        (person_id, English, Science, Filipino, Math, Abstract, final_rating, status, date_created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        English = COALESCE(VALUES(English), English),
        Science = COALESCE(VALUES(Science), Science),
        Filipino = COALESCE(VALUES(Filipino), Filipino),
        Math = COALESCE(VALUES(Math), Math),
        Abstract = COALESCE(VALUES(Abstract), Abstract),
        final_rating = COALESCE(VALUES(final_rating), final_rating),
        status = COALESCE(VALUES(status), status),
        date_created = NOW()`,
      [personId, e, s, f, m, a, fr, newStatus]
    );

    // -----------------------------
    // 🔥 AUDIT LOGGING
    // -----------------------------
    if (oldData) {
      const subjects = [
        { key: "English", label: "English", newVal: e },
        { key: "Science", label: "Science", newVal: s },
        { key: "Filipino", label: "Filipino", newVal: f },
        { key: "Math", label: "Math", newVal: m },
        { key: "Abstract", label: "Abstract", newVal: a },
      ];

      let changes = [];

      for (const subj of subjects) {
        const oldVal = oldData[subj.key];
        const newVal = subj.newVal;

        if ((oldVal ?? null) != (newVal ?? null)) {
          const oldStatusSub = getStatus(oldVal);
          const newStatusSub = getStatus(newVal);

          changes.push(
            `${subj.label}: ${oldVal ?? 0} (${oldStatusSub ?? "N/A"}) → ${newVal ?? 0} (${newStatusSub ?? "N/A"})`
          );
        }
      }

      // STATUS CHANGE
      const oldStatus = oldData?.status ?? null;

      if ((oldStatus ?? null) != (newStatus ?? null)) {
        changes.push(
          `Status: ${oldStatus ?? "NONE"} → ${newStatus ?? "NONE"}`
        );
      }

      // ✅ INSERT ONLY IF THERE ARE CHANGES
      if (changes.length > 0) {
        const message = `Applicant #${applicant_number} updated:\n${changes.join("\n")}`;

        await insertAuditLog({
          actorId: actor.email,
          role: actor.role,
          action: "EDIT",
          message,
          severity: "INFO",
        });
      }

    } else {
      // FIRST INSERT
      await insertAuditLog({
        actorId: actor.email,
        role: actor.role,
        action: "CREATE",
        message: `Applicant #${applicant_number} exam created`,
        severity: "INFO",
      });
    }

    // -----------------------------
    // RETURN DATA
    // -----------------------------
    const [savedRows] = await db.query(
      "SELECT * FROM admission_exam WHERE person_id = ? LIMIT 1",
      [personId]
    );

    return res.json({
      success: true,
      message: "Exam data saved!",
      saved: savedRows[0],
    });

  } catch (err) {
    console.error("❌ ERROR saving exam:", err);
    return res.status(500).json({
      error: "Failed to save exam data",
      details: String(err.message || err),
    });
  }
});

module.exports = router;