const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db, db3 } = require('../database/database');
const bcrypt = require("bcrypt");
const router = express.Router();
const QRCode = require("qrcode");
const {
  formatAuditTimestamp,
  insertAuditLogAdmission,
} = require("../../utils/auditLogger");
const upload = multer({ storage: multer.memoryStorage() });

const uploadProfile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // ✅ 2MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG allowed"));
    }
    cb(null, true);
  },
});


const allowedFields = new Set([
  "profile_img", "campus", "academicProgram", "classifiedAs", "applyingAs",
  "program", "program2", "program3", "yearLevel", "last_name", "first_name",
  "middle_name", "extension", "nickname", "height", "weight", "lrnNumber",
  "nolrnNumber", "gender", "pwdMember", "pwdType", "pwdId", "birthOfDate",
  "age", "birthPlace", "languageDialectSpoken", "citizenship", "religion",
  "civilStatus", "tribeEthnicGroup", "cellphoneNumber", "emailAddress",
  "presentStreet", "presentBarangay", "presentZipCode", "presentRegion",
  "presentProvince", "presentMunicipality", "presentDswdHouseholdNumber",
  "sameAsPresentAddress", "permanentStreet", "permanentBarangay",
  "permanentZipCode", "permanentRegion", "permanentProvince",
  "permanentMunicipality", "permanentDswdHouseholdNumber", "solo_parent",
  "father_deceased", "father_family_name", "father_given_name",
  "father_middle_name", "father_ext", "father_nickname", "father_education",
  "father_education_level", "father_last_school", "father_course",
  "father_year_graduated", "father_school_address", "father_contact",
  "father_occupation", "father_employer", "father_income", "father_email",
  "mother_deceased", "mother_family_name", "mother_given_name",
  "mother_middle_name", "mother_ext", "mother_nickname", "mother_education",
  "mother_education_level", "mother_last_school", "mother_course",
  "mother_year_graduated", "mother_school_address", "mother_contact",
  "mother_occupation", "mother_employer", "mother_income", "mother_email",
  "guardian", "guardian_family_name", "guardian_given_name",
  "guardian_middle_name", "guardian_ext", "guardian_nickname",
  "guardian_address", "guardian_contact", "guardian_email", "annual_income",
  "schoolLevel", "schoolLastAttended", "schoolAddress", "courseProgram",
  "honor", "generalAverage", "yearGraduated", "schoolLevel1",
  "schoolLastAttended1", "schoolAddress1", "courseProgram1", "honor1",
  "generalAverage1", "yearGraduated1", "strand", "cough", "colds", "fever",
  "asthma", "faintingSpells", "heartDisease", "tuberculosis",
  "frequentHeadaches", "hernia", "chronicCough", "headNeckInjury", "hiv",
  "highBloodPressure", "diabetesMellitus", "allergies", "cancer",
  "smokingCigarette", "alcoholDrinking", "hospitalized",
  "hospitalizationDetails", "medications", "hadCovid", "covidDate",
  "vaccine1Brand", "vaccine1Date", "vaccine2Brand", "vaccine2Date",
  "booster1Brand", "booster1Date", "booster2Brand", "booster2Date",
  "chestXray", "cbc", "urinalysis", "otherworkups", "symptomsToday",
  "remarks", "termsOfAgreement", "created_at", "current_step"
]);

const courseFields = ["program", "program2", "program3"];

const formatActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getCurriculumLabel = async (curriculumId) => {
  if (!curriculumId) return "None";

  try {
    const [rows] = await db3.query(
      `
      SELECT
        pt.program_code,
        pt.program_description,
        pt.major,
        yt.year_description,
        yt2.year_description AS next_year
      FROM curriculum_table ct
      LEFT JOIN program_table pt ON ct.program_id = pt.program_id
      LEFT JOIN year_table yt ON ct.year_id = yt.year_id
      LEFT JOIN year_table yt2 ON yt2.year_id = yt.year_id + 1
      WHERE ct.curriculum_id = ?
      LIMIT 1
      `,
      [curriculumId],
    );

    const curriculum = rows?.[0];
    if (!curriculum) return `Curriculum ${curriculumId}`;

    const programCode = curriculum.program_code || "N/A";
    const description = curriculum.program_description || "Unknown Program";
    const major = curriculum.major ? ` (${curriculum.major})` : "";
    const year = curriculum.year_description
      ? ` ${curriculum.year_description}${curriculum.next_year ? `-${curriculum.next_year}` : ""}`
      : "";

    return `(${programCode}) ${description}${major}${year}`;
  } catch (error) {
    console.error("Curriculum label lookup failed:", error);
    return `Curriculum ${curriculumId}`;
  }
};

const insertApplicantCourseChangeAuditLog = async ({
  actorId,
  actorRole,
  applicant,
  changes,
}) => {
  if (!changes.length) return;

  const safeActor = actorId || "unknown";
  const roleLabel = formatActorRole(actorRole);
  const applicantName = [
    applicant?.last_name,
    applicant?.first_name,
    applicant?.middle_name,
  ]
    .filter(Boolean)
    .join(", ");
  const applicantLabel =
    applicant?.applicant_number ||
    applicantName ||
    applicant?.emailAddress ||
    `person_id ${applicant?.person_id || "unknown"}`;
  const changeText = changes
    .map((change) => `${change.label} from ${change.fromLabel} to ${change.toLabel}`)
    .join("; ");

  await insertAuditLogAdmission({
    actorId: safeActor,
    role: actorRole || "registrar",
    action: "APPLICANT_COURSE_CHANGE",
    severity: "INFO",
    message: `${roleLabel} (${safeActor}) changed course of Applicant (${applicantLabel}) ${changeText} at ${formatAuditTimestamp()}.`,
  });
};

router.get("/person/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(`
      SELECT pt.*, ant.applicant_number 
      FROM applicant_numbering_table AS ant
      LEFT JOIN person_table AS pt ON ant.person_id = pt.person_id
      WHERE pt.person_id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error fetching person:", error);
    res.status(500).json({ error: "Database error" });
  }
});

router.put("/person/:id", async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "No fields provided for update" });
    }

    // 🧼 Clean + FILTER only allowed columns
    const cleanedEntries = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.has(key))
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, value === "" ? null : value]);

    console.log("Entry: ", Object.fromEntries(cleanedEntries));

    if (cleanedEntries.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const courseUpdateFields = cleanedEntries
      .filter(([key]) => courseFields.includes(key))
      .map(([key]) => key);
    let applicantBefore = null;

    if (courseUpdateFields.length > 0) {
      const [beforeRows] = await db.query(
        `
        SELECT pt.*, ant.applicant_number
        FROM person_table pt
        LEFT JOIN applicant_numbering_table ant ON ant.person_id = pt.person_id
        WHERE pt.person_id = ?
        LIMIT 1
        `,
        [id],
      );
      applicantBefore = beforeRows?.[0] || null;
    }

    const setClause = cleanedEntries.map(([key]) => `${key}=?`).join(", ");
    const values = cleanedEntries.map(([_, val]) => val);
    values.push(id);

    const sql = `UPDATE person_table SET ${setClause} WHERE person_id=?`;
    const [result] = await db.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Person not found or no changes made" });
    }

    if (applicantBefore && courseUpdateFields.length > 0) {
      const cleanedData = Object.fromEntries(cleanedEntries);
      const changes = [];

      for (const field of courseUpdateFields) {
        const oldValue = applicantBefore[field] ?? null;
        const newValue = cleanedData[field] ?? null;

        if (String(oldValue || "") !== String(newValue || "")) {
          const [fromLabel, toLabel] = await Promise.all([
            getCurriculumLabel(oldValue),
            getCurriculumLabel(newValue),
          ]);

          changes.push({
            label: field === "program" ? "course applied" : field,
            fromLabel,
            toLabel,
          });
        }
      }

      await insertApplicantCourseChangeAuditLog({
        actorId:
          req.body.audit_actor_id ||
          req.body.actor_id ||
          req.body.employee_id ||
          "unknown",
        actorRole: req.body.audit_actor_role || req.body.role || "registrar",
        applicant: applicantBefore,
        changes,
      });
    }
    res.json({ message: "✅ Person updated successfully" });
  } catch (error) {
    console.error("❌ Error updating person:", error);
    res.status(500).json({
      error: "Database error during update",
      details: error.message
    });
  }
});

router.post("/upload-profile-picture", uploadProfile.single("profile_picture"), async (req, res) => {
  const { person_id } = req.body;
  if (!person_id || !req.file) {
    return res.status(400).send("Missing person_id or file.");
  }

  try {
    // ✅ Get applicant_number from person_id
    const [rows] = await db.query(
      "SELECT applicant_number FROM applicant_numbering_table WHERE person_id = ?",
      [person_id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Applicant number not found for person_id " + person_id });
    }

    const applicant_number = rows[0].applicant_number;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const year = new Date().getFullYear();
    const filename = `${applicant_number}_1by1_${year}${ext}`;
    const uploadDir = path.join(__dirname, "../../uploads/Applicant1by1");
    const finalPath = path.join(uploadDir, filename);

    const files = await fs.promises.readdir(uploadDir);
    for (const file of files) {
      if (file.startsWith(`${applicant_number}_1by1_`)) {
        await fs.promises.unlink(path.join(uploadDir, file));
      }
    }

    await fs.promises.writeFile(finalPath, req.file.buffer);

    await db.query("UPDATE person_table SET profile_img = ? WHERE person_id = ?", [filename, person_id]);

    res.status(200).json({ message: "Uploaded successfully", filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Failed to upload image.");
  }
});

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "Profile picture must be 2MB or less.",
    });
  }

  if (err.message === "Only JPG, JPEG, PNG allowed") {
    return res.status(400).json({
      error: err.message,
    });
  }

  next(err);
});

router.post("/add-applicant", async (req, res) => {
  const {
    email,
    password,
    campus,
    first_name,
    middle_name,
    last_name,
    birthOfDate,
    academicProgram,
    applyingAs
  } = req.body;

  let person_id = null;

  try {

    if (!email || !password || !first_name || !last_name || !birthOfDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [existingUser] = await db.query(
      "SELECT * FROM user_accounts WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }



    // ⭐ INSERT PERSON
    const [personResult] = await db.query(
      `INSERT INTO person_table
      (campus, emailAddress, first_name, middle_name, last_name, birthOfDate, academicProgram, applyingAs, termsOfAgreement, current_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        campus || 1,
        email.trim().toLowerCase(),
        first_name.trim(),
        middle_name || null,
        last_name.trim(),
        birthOfDate,
        academicProgram,
        applyingAs
      ]
    );

    person_id = personResult.insertId;

    // ⭐ USER ACCOUNT
    await db.query(
      `INSERT INTO user_accounts (person_id, email, password, role, status)
       VALUES (?, ?, ?, 'applicant', 1)`,
      [person_id, email.trim().toLowerCase(), hashedPassword]
    );

    // ------------------
    // Applicant Numbering
    // ------------------

    const [activeYearResult] = await db3.query(`
      SELECT yt.year_description, st.semester_id
      FROM active_school_year_table sy
      JOIN year_table yt ON yt.year_id = sy.year_id
      JOIN semester_table st ON st.semester_id = sy.semester_id
      WHERE sy.astatus = 1
      LIMIT 1
    `);

    const year = String(activeYearResult[0].year_description).split("-")[0];
    const semCode = activeYearResult[0].semester_id;

    const [countRes] = await db.query(
      "SELECT COUNT(*) AS count FROM applicant_numbering_table"
    );

    const padded = String(countRes[0].count + 1).padStart(5, "0");
    const applicant_number = `${year}${semCode}${padded}`;

    await db.query(
      "INSERT INTO applicant_numbering_table (applicant_number, person_id) VALUES (?, ?)",
      [applicant_number, person_id]
    );

    // ------------------
    // Applicant Status
    // ------------------




    await db.query(
      `INSERT INTO person_status_table 
       (person_id, applicant_id, exam_status, requirements, residency, student_registration_status, exam_result, hs_ave, qualifying_result, interview_result)
       VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`,
      [person_id, applicant_number]
    );

    await db.query(
      `INSERT INTO interview_applicants (schedule_id, applicant_id, email_sent, status)
       VALUES (?, ?, 0, 'Waiting List')`,
      [null, applicant_number]
    );

    // ------------------
    // QR Code Generation
    // ------------------

    const qrData = `${process.env.DB_HOST_LOCAL}:5173/examination_profile/${applicant_number}`;
    const qrData2 = `${process.env.DB_HOST_LOCAL}:5173/applicant_profile/${applicant_number}`;

    const qrFilename = `${applicant_number}_qrcode.png`;
    const qrFilename2 = `${applicant_number}_qrcode2.png`;

    const qrPath = path.join(__dirname, "../../uploads/QrCodeGenerated", qrFilename);
    const qrPath2 = path.join(__dirname, "../../uploads/QrCodeGenerated", qrFilename2);

    // generate QR codes
    await QRCode.toFile(qrPath, qrData, {
      color: { dark: "#000", light: "#FFF" },
      width: 300,
    });

    await QRCode.toFile(qrPath2, qrData2, {
      color: { dark: "#000", light: "#FFF" },
      width: 300,
    });

    // save QR filename
    await db.query(
      "UPDATE applicant_numbering_table SET qr_code = ? WHERE applicant_number = ?",
      [qrFilename, applicant_number]
    );

    res.json({
      success: true,
      message: "Applicant created successfully",
      person_id,
      applicant_number
    });

  } catch (error) {

    if (person_id) {
      await db.query("DELETE FROM person_table WHERE person_id = ?", [person_id]);
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});




module.exports = router;
