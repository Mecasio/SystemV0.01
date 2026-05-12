const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const webtoken = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const bodyparser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const puppeteer = require("puppeteer");
const {
  getGradeConversions,
  getStoredNumericGrade,
} = require("./utils/gradeConversion");
const {
  insertAuditLogAdmission,
  insertAuditLogEnrollment,
} = require("./utils/auditLogger");
const nodemailer = require("nodemailer");
const { error } = require("console");

require("dotenv").config();
const app = express();
const http = require("http").createServer(app);

const { initSocket } = require("./utils/socket");
const registerSocketHandlers = require("./utils/registerSocketHandlers");

app.use(express.json({ limit: "50mb" }));
app.use(bodyparser.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/Applicant1by1",
  express.static(path.join(__dirname, "uploads", "Applicant1by1")),
);
app.use(
  "/ApplicantOnlineDocuments",
  express.static(
    path.join(__dirname, "uploads", "ApplicantOnlineDocuments")
  )
);
app.use(
  "/StudentOnlineDocuments",
  express.static(
    path.join(__dirname, "uploads", "StudentOnlineDocuments")
  )
);
app.use("/assets", express.static(path.join(__dirname, "assets")));

const applicantDocsDir = path.join(
  __dirname,
  "uploads",
  "applicant_documents"
);

const allowedOrigins = [
  "http://localhost:5173",
  "http://192.168.0.180:5173",
  "http://192.168.50.55:5173",
  "http://192.168.50.211:5173",
  "http://136.239.248.62:5173",
  "http://192.168.0.180:5173",
  "http://192.168.1.9:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

const io = initSocket(http, allowedOrigins);
app.set("io", io);

const signatureDir = path.join(__dirname, "uploads", "signature");
const authRoute = require("./routes/auth_routes/authRoutes");
const applicantFormRoute = require("./routes/applicant_routes/applicantFormRoute");
const examPermit = require("./routes/applicant_routes/examPermitRoute");
const requirementsUploaderRoute = require("./routes/applicant_routes/requirementsUploaderRoute");
const studentRoute = require("./routes/student_routes/studentRoute");
const adminRoute = require("./routes/admin_routes/registrarRoute");
const signature = require("./routes/admin_routes/signature");
const facultyRoute = require("./routes/faculty_routes/facultyRoute");
const programTagging = require("./routes/system_routes/programTaggingRoute");
const coursePanel = require("./routes/system_routes/coursePanelRoute");
const tosfPanel = require("./routes/system_routes/tosfRoute");
const paymentExporting = require("./routes/system_routes/paymentExportingRoute");
const corExporting = require("./routes/system_routes/corExportingRoute");
const entranceExamSchedule = require("./routes/admission_routes/entranceExamSchedule");
const applicantScoringRoute = require("./routes/admission_routes/applicantScoringRoute");
const subjectsRoute = require("./routes/admission_routes/subjectsRoute");
const interviewQualifyingRoute = require("./routes/admission_routes/interviewQualifyingRoute");
const verifyDocumentSchedule = require("./routes/admission_routes/verifyDocumentSchedule");
const QualifyingInterviewExam = require("./routes/admission_routes/QualifyingInterviewExam");
const medicalExamRoute = require("./routes/admission_routes/medicalExamRoute");
const qrCodeForStudents = require("./routes/qrCodeForStudents");
const studentPayment = require("./routes/payment/studentScholarship");
const receiptCounter = require("./routes/payment/receiptCounter");
const matriculationPayment = require("./routes/payment/matriculation");
const programRoute = require("./routes/system_routes/programRoute");
const requirementsRoute = require("./routes/system_routes/requirementsRoute");
const applicantRoutesResetPassword = require("./routes/reset_password_routes/applicantresetpasswordRoutes");
const studentRoutesResetPassword = require("./routes/reset_password_routes/studentresetpasswordRoutes");
const facultyRoutesResetPassword = require("./routes/reset_password_routes/facultyresetpasswordRoutes");
const registrarRoutesResetPassword = require("./routes/reset_password_routes/registrarresetpasswordRoutes");
const announcementRoute = require("./routes/system_routes/announcement");
const programSlots = require("./routes/system_routes/programSlots");
const departmentRoute = require("./routes/system_routes/dprmntRoute");
const roomRegistrationRoute = require("./routes/system_routes/roomRegistrationRoute");
const departmentRoomRoute = require("./routes/system_routes/departmentRoom");
const departmentSectionRoute = require("./routes/system_routes/departmentSection");
const courseTaggingRoute = require("./routes/system_routes/courseTagging");
const settingsRoute = require("./routes/system_routes/settingsRoute");
const importRoutes = require("./routes/import");
const templateRoute = require("./routes/system_routes/template");
const accessRoutes = require("./routes/auth_routes/accessRoute");
const userPageAccess = require("./routes/auth_routes/userPageAccessRoute");
const dprtmntCurriculum = require("./routes/system_routes/dprtmntCurriculum");
const section = require("./routes/system_routes/section");
const emailTemplate = require("./routes/system_routes/emailTemplate");
const changePassword = require("./routes/auth_routes/changePassword");
const facultyDegree = require("./routes/faculty_routes/facultyDegree");
const feeRules = require("./routes/payment/feeRules");
const registerStudent = require("./routes/student_routes/registerStudent");
const studentPaymentModule = require("./routes/student_routes/studentPaymentModule");
const studentAccountRoute = require("./routes/student_routes/studentAccounts");
const curriculum = require("./routes/system_routes/curriculumRoute");
const schoolYear = require("./routes/system_routes/schoolYear");
const statistics = require("./routes/system_routes/statistics");
const payment = require("./routes/payment/payment");
const evaluation = require("./routes/system_routes/evaluation");
const yearLevelRoute = require("./routes/system_routes/yearLevel");
const gradeConversionRoute = require("./routes/system_routes/gradeConversion");
const honorRoutes = require("./routes/system_routes/honorRoutes");
const nstpTagging = require("./routes/system_routes/nstpTagging");
const departmentSectionTagging = require("./routes/system_routes/departmentSectionTagging");
const auditLogsRoute = require("./routes/system_routes/auditLogsRoute");

app.use("/", evaluation);
app.use("/", payment);
app.use("/", statistics);
app.use("/", schoolYear);
app.use("/", curriculum)
app.use("/", registerStudent);
app.use("/", studentPaymentModule);
app.use("/", feeRules);
app.use("/", facultyDegree);
app.use("/", changePassword);
app.use("/", emailTemplate);
app.use("/", userPageAccess);
app.use("/", programRoute);
app.use("/auth/", authRoute);
app.use("/api/", accessRoutes);
app.use("/", signature);
app.use("/form/", applicantFormRoute);
app.use("/exampermit/", examPermit);
app.use("/", requirementsUploaderRoute);
app.use("/", studentRoute);
app.use("/admin/", adminRoute);
app.use("/faculty/", facultyRoute);
app.use("/", programTagging);
app.use("/", coursePanel);
app.use("/", tosfPanel);
app.use("/", paymentExporting);
app.use("/", corExporting);
app.use("/", entranceExamSchedule);
app.use("/", applicantScoringRoute);
app.use("/", subjectsRoute);
app.use("/", interviewQualifyingRoute);
app.use("/", verifyDocumentSchedule);
app.use("/", QualifyingInterviewExam);
app.use("/", medicalExamRoute);
app.use("/", qrCodeForStudents);
app.use("/", receiptCounter);
app.use("/", matriculationPayment);
app.use("/", studentPayment);
app.use("/", importRoutes);
app.use("/", templateRoute);
app.use("/", nstpTagging);
app.use("/", departmentSectionTagging)
app.use("/", auditLogsRoute);
app.use("/", applicantRoutesResetPassword);
app.use("/", studentRoutesResetPassword);
app.use("/", facultyRoutesResetPassword);
app.use("/", registrarRoutesResetPassword);
app.use("/api", announcementRoute);
app.use("/api", programSlots);
app.use("/api", departmentRoomRoute);
app.use("/", departmentRoute);
app.use("/", roomRegistrationRoute);
app.use("/", requirementsRoute);
app.use("/", dprtmntCurriculum);
app.use("/", departmentSectionRoute);
app.use("/", courseTaggingRoute);
app.use("/api", settingsRoute);
app.use("/", section);
app.use("/api", studentAccountRoute);
app.use("/", yearLevelRoute);
app.use("/", gradeConversionRoute);
app.use("/api", honorRoutes);

const uploadPath = path.join(__dirname, "uploads");

app.use("/uploads", express.static(uploadPath));

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

if (!fs.existsSync(signatureDir))
  fs.mkdirSync(signatureDir, { recursive: true });


// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: async function (req, file, cb) {
    const person_id = req.body.person_id;
    const requirements_id = req.body.requirements_id;

    // Get requirement label from DB
    const [reqRows] = await db.query(
      "SELECT description FROM requirements_table WHERE id = ?",
      [requirements_id],
    );
    const description = reqRows[0]?.description || "Unknown";
    const shortLabel = getShortLabel(description);

    // Get applicant_number using person_id
    const [applicantRows] = await db.query(
      "SELECT applicant_number FROM applicant_numbering_table WHERE person_id = ?",
      [person_id],
    );
    const applicant_number =
      applicantRows[0]?.applicant_number || `PID${person_id}`;

    const timestamp = new Date().getFullYear();
    const ext = path.extname(file.originalname);

    const filename = `${applicant_number}_${shortLabel}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

// ---------------- PROFILE UPLOAD (Registrar) ----------------
// Ito
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // ✅ 4MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG, PDF allowed"));
    }

    cb(null, true);
  }
});


const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "uploads");
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, "temp_" + Date.now() + path.extname(file.originalname));
    },
  }),
});




// Middleware to check if user can access a step
const checkStepAccess = (requiredStep) => {
  return async (req, res, next) => {
    const { id } = req.params; // person_id
    try {
      const [rows] = await db.execute(
        "SELECT current_step FROM person_table WHERE person_id = ?",
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Person not found" });
      }

      const currentStep = rows[0].current_step;

      if (currentStep < requiredStep) {
        return res
          .status(403)
          .json({ error: "You cannot access this step yet." });
      }

      next();
    } catch (err) {
      console.error("Step check error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
};

// ---------------- TRANSPORTER ---------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//  Verify transporter at startup
transporter.verify((error, success) => {
  if (error) {
    console.error(" Email transporter error:", error);
  } else {
    console.log(" Email transporter is ready");
  }
});

const getDbHost = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.DB_HOST_PUBLIC;
  } else if (process.env.NODE_ENV === "local") {
    return process.env.DB_HOST_LOCAL;
  } else {
    return "localhost"; // fallback for development
  }
};

//MYSQL CONNECTION FOR ADMISSION
const db = mysql.createPool({
  // host: "localhost",
  host: getDbHost(),
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME1 || "admission",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

//MYSQL CONNECTION FOR ROOM MANAGEMENT AND OTHERS
const db3 = mysql.createPool({
  // host: "localhost",
  host: getDbHost(),
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME2 || "enrollment",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

//----------------------------End Settings----------------------------//

/*---------------------------------START---------------------------------------*/
const ipAddress = getDbHost();
// ----------------- REGISTER -----------------


app.get("/api/employee/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;

    // get all page_ids assigned to this employee
    const [rows] = await db3.query(
      "SELECT page_id FROM page_access WHERE user_id = ?",
      [employee_id],
    );

    const accessList = rows.map((r) => r.page_id);

    res.json({
      success: true,
      accessList,
    });
  } catch (err) {
    console.error("Error fetching employee access:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//  Get user_accounts.id using person_id
app.get("/api/get_user_account_id/:person_id", async (req, res) => {
  const { person_id } = req.params;
  try {
    const [rows] = await db3.query(
      "SELECT id FROM user_accounts WHERE person_id = ? LIMIT 1",
      [person_id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });
    res.json({ user_account_id: rows[0].id });
  } catch (err) {
    console.error(" Error fetching user_account_id:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//GET ADMITTED USERS (UPDATED!)
app.get("/admitted_users", async (req, res) => {
  try {
    const query = "SELECT * FROM user_accounts";
    const [result] = await db.query(query);

    res.status(200).send(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).send({ message: "INTERNAL SERVER ERROR!!" });
  }
});


// Get applicant_number by person_id
app.get("/api/applicant_number/:person_id", async (req, res) => {
  const { person_id } = req.params;

  console.log("Recieved Person Id: ", person_id);

  try {
    const [rows] = await db.query(
      "SELECT applicant_number FROM applicant_numbering_table WHERE person_id = ?",
      [person_id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Applicant number not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching applicant number:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// “ Helper function to fetch actor info
async function getActorInfo(user_person_id) {
  let actorEmail = "earistmis@gmail.com";
  let actorName = "SYSTEM";

  if (user_person_id) {
    const [actorRows] = await db3.query(
      `SELECT email, role, last_name, first_name, middle_name
       FROM user_accounts
       WHERE person_id = ? LIMIT 1`,
      [user_person_id],
    );

    if (actorRows.length > 0) {
      const actor = actorRows[0];
      actorEmail = actor.email || actorEmail;
      actorName = actor.last_name
        ? `${actor.role.toUpperCase()} - ${actor.last_name}, ${actor.first_name || ""} ${actor.middle_name || ""}`.trim()
        : actor.role
          ? actor.role.toUpperCase()
          : actorName;
    }
  }

  return { actorEmail, actorName };
}



//  ADMIN DELETE
app.delete("/admin/uploads/:uploadId", async (req, res) => {
  const { uploadId } = req.params;

  try {
    // 1¸ Get upload row (file + person_id)
    const [uploadRows] = await db.query(
      "SELECT person_id, file_path FROM requirement_uploads WHERE upload_id = ?",
      [uploadId],
    );
    if (!uploadRows.length) {
      return res.status(404).json({ error: "Upload not found." });
    }

    const { person_id: personId, file_path: filePath } = uploadRows[0];

    // 2¸ Applicant info
    const [[appInfo]] = await db.query(
      `
      SELECT ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name
      FROM applicant_numbering_table ant
      JOIN person_table pt ON ant.person_id = pt.person_id
      WHERE ant.person_id = ?
    `,
      [personId],
    );

    const applicant_number = appInfo?.applicant_number || "Unknown";
    const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""} ${appInfo?.middle_name?.charAt(0) || ""}.`;

    // 3¸ Actor (admin performing the action)
    const user_person_id = req.headers["x-person-id"];
    const { actorEmail, actorName } = await getActorInfo(user_person_id);

    // 4¸ Delete physical file
    if (filePath) {
      const fullPath = path.join(applicantDocsDir, filePath);

      try {
        await fs.promises.unlink(fullPath);
        console.log("—‘¸ File deleted:", fullPath);
      } catch (err) {
        if (err.code === "ENOENT") {
          console.warn(" ¸ File already missing:", fullPath);
        } else {
          console.error("File delete error:", err);
        }
      }
    }

    // 5¸ Delete DB record
    await db.query("DELETE FROM requirement_uploads WHERE upload_id = ?", [
      uploadId,
    ]);

    // 6¸ Log notification
    const message = `—‘¸ Deleted document (Applicant #${applicant_number} - ${fullName})`;
    await db.query(
      "INSERT INTO notifications (type, message, applicant_number, actor_email, actor_name, timestamp) VALUES (?, ?, ?, ?, ?, NOW())",
      ["delete", message, applicant_number, actorEmail, actorName],
    );

    io.emit("notification", {
      type: "delete",
      message,
      applicant_number,
      actor_email: actorEmail,
      actor_name: actorName,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({ message: " Upload deleted successfully." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete the upload." });
  }
});

//  Updated: Return uploads joined with requirement details
app.get("/uploads/:personId", async (req, res) => {
  const personId = req.params.personId;
  if (!personId) return res.status(400).json({ error: "Missing person ID" });

  try {
    const [results] = await db.query(
      `
      SELECT
        ru.upload_id,
        ru.requirements_id,
        ru.person_id,
        ru.file_path,
        ru.original_name,
        ru.remarks,
        ru.status,
        rt.description,
        rt.short_label
      FROM requirement_uploads ru
      LEFT JOIN requirements_table rt ON ru.requirements_id = rt.id
      WHERE ru.person_id = ?
      ORDER BY ru.upload_id DESC
    `,
      [personId],
    );

    res.json(results);
  } catch (err) {
    console.error("Fetch uploads failed:", err);
    res.status(500).json({ error: "Failed to fetch uploads" });
  }
});

app.get("/api/requirements/by-status/:status", async (req, res) => {
  const { status } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT * FROM requirements_table WHERE category = 'Main'",
      [status],
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching requirements by status:", err);
    res.status(500).send("Server error");
  }
});


app.put("/api/interview_applicants/:applicant_id/status", async (req, res) => {
  const { applicant_id } = req.params;
  const { status } = req.body;

  try {
    const [result] = await db.query(
      "UPDATE interview_applicants SET status = ? WHERE applicant_id = ?",
      [status, applicant_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Error updating applicant status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//  UPDATE Remarks ONLY (no notification, no io.emit, no evaluator lookup)
//  Update remarks only
app.put("/uploads/remarks/:upload_id", async (req, res) => {
  const { upload_id } = req.params;
  const { remarks, user_id } = req.body;

  try {
    await db.query(
      `UPDATE requirement_uploads
       SET remarks = ?, last_updated_by = ?
       WHERE upload_id = ?`,
      [remarks || null, user_id, upload_id],
    );

    res.json({ message: "Remarks updated successfully." });
  } catch (err) {
    console.error("Error updating remarks:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//  Update status only
app.put("/uploads/status/:upload_id", async (req, res) => {
  const { upload_id } = req.params;
  const { status, user_id, audit_actor_id, audit_actor_role } = req.body;

  try {
    const uploadBefore = await getRequirementUploadAuditInfo(upload_id);
    if (!uploadBefore) {
      return res.status(404).json({ message: "Upload not found" });
    }

    // 1. Update single row status
    await db.query(
      `UPDATE requirement_uploads
       SET status = ?, last_updated_by = ?
       WHERE upload_id = ?`,
      [status, user_id, upload_id]
    );

    const person_id = uploadBefore.person_id;

    // 3. Get all verifiable documents of this applicant
    const [docs] = await db.query(
      `SELECT status
       FROM requirement_uploads ru
       JOIN requirements_table rt ON ru.requirements_id = rt.id
       WHERE ru.person_id = ?
       AND rt.is_verifiable = 1`,
      [person_id]
    );

    // 4. Check if ALL are verified (status = 1)
    const allVerified = docs.length > 0 && docs.every(d => d.status === 1);

    if (allVerified) {
      // 🔥 5. AUTO UPDATE document_status
      await db.query(
        `UPDATE requirement_uploads
         SET document_status = 'Documents Verified & ECAT'
         WHERE person_id = ?`,
        [person_id]
      );

      // 🔥 6. OPTIONAL: ensure ALL status = 1 (safety sync)
      await db.query(
        `UPDATE requirement_uploads
         SET status = 1
         WHERE person_id = ?`,
        [person_id]
      );
    }

    if (String(uploadBefore.status ?? "0") !== String(status ?? "0")) {
      const safeActor = audit_actor_id || user_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role || "registrar");
      await insertRequirementAuditLog({
        actorId: safeActor,
        actorRole: audit_actor_role || "registrar",
        message: `${roleLabel} (${safeActor}) changed document status of Applicant (${applicantAuditLabel(uploadBefore)}) for ${uploadBefore.description || "document"} from ${requirementStatusLabel(uploadBefore.status)} to ${requirementStatusLabel(status)}.`,
      });
    }

    res.json({ message: "Status updated and auto-sync checked." });

  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/document_status/:applicant_number", async (req, res) => {
  const { applicant_number } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT
        COALESCE(ru.document_status, 'On process') AS document_status,
        ua.email AS evaluator_email,
        pr.lname AS evaluator_lname,
        pr.fname AS evaluator_fname,
        pr.mname AS evaluator_mname,
        ru.created_at
      FROM applicant_numbering_table ant
      INNER JOIN person_table pt ON pt.person_id = ant.person_id
      LEFT JOIN requirement_uploads ru ON ru.person_id = pt.person_id
      LEFT JOIN enrollment.user_accounts ua ON ua.person_id = ru.last_updated_by
      LEFT JOIN enrollment.prof_table pr ON pr.person_id = ua.person_id
      WHERE ant.applicant_number = ?
      ORDER BY ru.upload_id DESC
      LIMIT 1
      `,
      [applicant_number],
    );

    const row = rows?.[0] || {};
    res.json({
      document_status: row.document_status || "On process",
      evaluator: row.evaluator_email
        ? {
          evaluator_email: row.evaluator_email,
          evaluator_lname: row.evaluator_lname,
          evaluator_fname: row.evaluator_fname,
          evaluator_mname: row.evaluator_mname,
          created_at: row.created_at,
        }
        : null,
    });
  } catch (err) {
    console.error("Error fetching document status:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/api/document_status/:applicant_number", async (req, res) => {
  const { applicant_number } = req.params;
  const {
    document_status,
    user_id,
    audit_actor_id,
    audit_actor_role,
  } = req.body;

  if (!document_status || !user_id) {
    return res.status(400).json({
      message: "document_status and user_id are required",
    });
  }

  try {
    const applicantBefore = await getApplicantDocumentStatusInfo(applicant_number);

    if (!applicantBefore) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    let statusSyncSql = "";
    const updateParams = [document_status, user_id];

    if (document_status === "Documents Verified & ECAT") {
      statusSyncSql = ", ru.status = ?";
      updateParams.push(1);
    } else if (document_status === "Disapproved / Program Closed") {
      statusSyncSql = ", ru.status = ?";
      updateParams.push(2);
    }

    updateParams.push(applicant_number);

    const [result] = await db.query(
      `
      UPDATE requirement_uploads ru
      INNER JOIN applicant_numbering_table ant ON ant.person_id = ru.person_id
      SET ru.document_status = ?, ru.last_updated_by = ?${statusSyncSql}
      WHERE ant.applicant_number = ?
      `,
      updateParams,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Applicant uploads not found" });
    }

    if (
      String(applicantBefore.document_status || "On process") !==
      String(document_status || "On process")
    ) {
      const safeActor = audit_actor_id || user_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role || "registrar");

      await insertRequirementAuditLog({
        actorId: safeActor,
        actorRole: audit_actor_role || "registrar",
        message: `${roleLabel} (${safeActor}) changed overall document status of Applicant (${applicantAuditLabel(applicantBefore)}) from ${applicantBefore.document_status || "On process"} to ${document_status}.`,
      });
    }

    res.json({
      success: true,
      document_status,
      message: "Document status updated successfully",
    });
  } catch (err) {
    console.error("Error updating document status:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update submitted_documents by upload_id (apply to ALL docs of that applicant)
app.put("/api/submitted-documents/:upload_id", async (req, res) => {
  const { upload_id } = req.params;
  const { submitted_documents, user_person_id } = req.body;

  try {
    // 1. Find person_id
    const [[row]] = await db.query(
      "SELECT person_id FROM admission.requirement_uploads WHERE upload_id = ?",
      [upload_id]
    );

    if (!row) {
      return res.status(404).json({ error: "Upload not found" });
    }

    const person_id = row.person_id;

    // 2. Applicant info
    const [[appInfo]] = await db.query(
      `
      SELECT ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name
      FROM applicant_numbering_table ant
      JOIN person_table pt ON ant.person_id = pt.person_id
      WHERE ant.person_id = ?
      `,
      [person_id]
    );

    const applicant_number = appInfo?.applicant_number || "Unknown";

    const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""
      } ${appInfo?.middle_name?.charAt(0) || ""}.`;

    // 3. Actor info
    let actorEmail = "earistmis@gmail.com";
    let actorName = "SYSTEM";

    if (user_person_id) {
      const [actorRows] = await db3.query(
        `
        SELECT email, role, employee_id, last_name, first_name, middle_name
        FROM user_accounts
        WHERE person_id = ?
        LIMIT 1
        `,
        [user_person_id]
      );

      if (actorRows.length > 0) {
        const u = actorRows[0];

        const role = u.role?.toUpperCase() || "UNKNOWN";
        const empId = u.employee_id || "";
        const lname = u.last_name || "";
        const fname = u.first_name || "";
        const mname = u.middle_name || "";
        const email = u.email || "";

        actorEmail = email;
        actorName = `${role} (${empId}) - ${lname}, ${fname} ${mname}`.trim();
      }
    }

    // 4. Toggle + message
    let type, message;

    if (submitted_documents === 1) {
      await db.query(
        `
        UPDATE admission.requirement_uploads
        SET submitted_documents = 1,
            registrar_status = 1,
            missing_documents = '[]'
        WHERE person_id = ?
        `,
        [person_id]
      );

      type = "submit";
      message = `Requirements submitted by Applicant #${applicant_number} - ${fullName}`;
    } else {
      await db.query(
        `
        UPDATE admission.requirement_uploads
        SET submitted_documents = 0,
            registrar_status = 0,
            missing_documents = NULL
        WHERE person_id = ?
        `,
        [person_id]
      );

      type = "unsubmit";
      message = `Requirements unsubmitted for Applicant #${applicant_number} - ${fullName}`;
    }

    const { actorId, actorRole } = getAdmissionAuditActor(req);
    const roleLabel = formatAdmissionAuditActorRole(actorRole);
    await insertAuditLogAdmission({
      actorId,
      role: actorRole,
      action:
        submitted_documents === 1
          ? "APPLICATION_ORIGINAL_DOCUMENTS_SUBMIT"
          : "APPLICATION_ORIGINAL_DOCUMENTS_UNSUBMIT",
      severity: "INFO",
      message: `${roleLabel} (${actorId}) marked original documents of Applicant (${applicant_number}) as ${submitted_documents === 1 ? "submitted" : "unsubmitted"}.`,
    });

    // 5. Prevent duplicate notifications per day
    await db.query(
      `
      INSERT INTO notifications
      (type, message, applicant_number, actor_email, actor_name, timestamp)
      SELECT ?, ?, ?, ?, ?, NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE applicant_number = ?
          AND message = ?
          AND DATE(timestamp) = CURDATE()
      )
      `,
      [
        type,
        message,
        applicant_number,
        actorEmail,
        actorName,
        applicant_number,
        message,
      ]
    );

    // 6. Emit socket event
    io.emit("notification", {
      type,
      message,
      applicant_number,
      actor_email: actorEmail,
      actor_name: actorName,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message,
    });
  } catch (err) {
    console.error("Error toggling submitted documents:", err);

    res.status(500).json({
      error: "Failed to toggle submitted documents",
    });
  }
});



app.get("/api/verified-exam-applicants", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
          ea.id AS exam_applicant_id,
          ea.applicant_id,
          ant.person_id,
          p.last_name,
          p.first_name,
          p.middle_name,
          p.emailAddress,
          p.program,
          ea.schedule_id
      FROM exam_applicants ea
      JOIN applicant_numbering_table ant
          ON ea.applicant_id = ant.applicant_number
      JOIN person_table p
          ON ant.person_id = p.person_id
      WHERE ea.email_sent = 1 AND ant.person_id IN (
          SELECT ru.person_id
          FROM requirement_uploads ru
          INNER JOIN requirements_table rt
            ON ru.requirements_id = rt.id
          WHERE ru.document_status = 'Documents Verified & ECAT'
            AND rt.category = 'Main'
            AND rt.is_verifiable = 1
          GROUP BY ru.person_id
          HAVING COUNT(DISTINCT ru.requirements_id) >= (
            SELECT COUNT(*)
            FROM requirements_table rt2
            INNER JOIN person_table p2
              ON rt2.applicant_type = p2.applyingAs
            WHERE rt2.category = 'Main'
              AND rt2.is_verifiable = 1
              AND p2.person_id = ru.person_id
          )
      )
      ORDER BY p.last_name ASC, p.first_name ASC
      `,
    );

    res.json(rows);
  } catch (err) {
    console.error(" Error fetching verified exam applicants:", err);
    res.status(500).json({ error: "Failed to fetch verified exam applicants" });
  }
});





// Update requirements when submitted documents are checked
app.put("/api/update-requirements/:person_id", async (req, res) => {
  const { person_id } = req.params;
  const { requirements } = req.body;

  try {
    await db.query(
      "UPDATE admission.person_status_table SET requirements = ? WHERE person_id = ?",
      [requirements, person_id],
    );
    res.json({ success: true, message: "Requirements updated" });
  } catch (error) {
    console.error(" Error updating requirements:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update requirements" });
  }
});

app.put("/uploads/document-status/:upload_id", async (req, res) => {
  const { upload_id } = req.params;
  const { document_status, user_id } = req.body;

  if (!document_status || !user_id) {
    return res
      .status(400)
      .json({ error: "document_status and user_id are required" });
  }

  try {
    const [result] = await db.query(
      "UPDATE requirement_uploads SET document_status = ?, last_updated_by = ? WHERE upload_id = ?",
      [document_status, user_id, upload_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Upload not found" });
    }

    res.json({ success: true, message: "Document status updated" });
  } catch (err) {
    console.error(" Failed to update document status:", err);
    res.status(500).json({ error: "Failed to update document status" });
  }
});

// Update person.document_status directly

//  Fetch all applicant uploads (admin use)
app.get("/uploads/all", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT
        ru.upload_id,
        ru.requirements_id,
        ru.person_id,
        ru.file_path,
        ru.original_name,
        ru.remarks,
        ru.status,
        ru.document_status,
        ru.registrar_status,
        ru.created_at,
        rt.description,
        p.applicant_number,
        p.first_name,
        p.middle_name,
        p.last_name,
       ua.email AS evaluator_email,
       ua.role AS evaluator_role
      FROM requirement_uploads ru
      JOIN requirements_table rt ON ru.requirements_id = rt.id
      JOIN person_table p ON ru.person_id = p.person_id
    `);
    res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching all uploads:", err);
    res.status(500).json({ error: "Failed to fetch uploads" });
  }
});

// Update document_status and store who updated it
app.put("/uploads/document-status/:id", async (req, res) => {
  const { document_status, user_id } = req.body;
  const uploadId = req.params.id;

  try {
    const sql = `
      UPDATE requirement_uploads
      SET document_status = ?, last_updated_by = ?
      WHERE upload_id = ?
    `;
    await db.query(sql, [document_status, user_id, uploadId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating document status:", err);
    res.status(500).json({ message: "Internal Server Error", error: err });
  }
});

//  Get uploads by applicant_number (Admin use)
app.get("/uploads/by-applicant/:applicant_number", async (req, res) => {
  const applicant_number = req.params.applicant_number;

  try {
    const [personResult] = await db.query(
      "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ?",
      [applicant_number],
    );

    if (personResult.length === 0) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    const person_id = personResult[0].person_id;

    const [uploads] = await db.query(
      `
      SELECT
        ru.upload_id,
        ru.requirements_id,
        ru.person_id,
        ru.file_path,
        ru.original_name,
        ru.remarks,
        ru.status,

        CASE
          WHEN ru.status = 1 THEN 'Approved'
          WHEN ru.status = 2 THEN 'Rejected'
          ELSE 'Pending'
        END AS status_label,

        ru.document_status,
        ru.registrar_status,
        ru.created_at,
        rt.description,

        CASE
          WHEN LOWER(rt.description) LIKE '%form 138%' THEN 'Form138'
          WHEN LOWER(rt.description) LIKE '%good moral%' THEN 'GoodMoralCharacter'
          WHEN LOWER(rt.description) LIKE '%birth certificate%' THEN 'BirthCertificate'
          WHEN LOWER(rt.description) LIKE '%graduating class%' THEN 'CertificateOfGraduatingClass'
          WHEN LOWER(rt.description) LIKE '%vaccine card%' THEN 'VaccineCard'
          ELSE 'Unknown'
        END AS short_label,

        ua.email AS evaluator_email,
        ua.role  AS evaluator_role,
        pr.lname AS evaluator_lname,
        pr.fname AS evaluator_fname,
        pr.mname AS evaluator_mname

      FROM requirement_uploads ru
      JOIN requirements_table rt
        ON ru.requirements_id = rt.id
      LEFT JOIN enrollment.user_accounts ua
        ON ru.last_updated_by = ua.person_id
      LEFT JOIN enrollment.prof_table pr
        ON ua.person_id = pr.person_id
      WHERE ru.person_id = ?
      `,
      [person_id],
    );

    res.status(200).json(uploads);
  } catch (err) {
    console.error("Error fetching uploads by applicant number:", err);
    res.status(500).json({ message: "Internal Server Error", error: err });
  }
});

//  Update document status and track who edited
app.put("/uploads/document-status/:uploadId", (req, res) => {
  const { document_status } = req.body;
  const { uploadId } = req.params;

  // ‘‡ Example: take user_id from authenticated user
  const registrarPersonId = req.user.person_id; // middleware should set this from JWT

  if (!document_status || !registrarPersonId) {
    return res
      .status(400)
      .json({ error: "document_status and registrar is required" });
  }

  const sql = `
    UPDATE requirement_uploads
    SET document_status = ?, last_updated_by = ?, registrar_status = 1, created_at = NOW()
    WHERE upload_id = ?
  `;

  db3.query(
    sql,
    [document_status, registrarPersonId, uploadId],
    (err, result) => {
      if (err) {
        console.error(" Failed to update document status:", err);
        return res
          .status(500)
          .json({ error: "Failed to update document status" });
      }
      res.json({ success: true, message: "Document status updated", result });
    },
  );
});

//  Get uploads with evaluator info

// Add to server.js
// “ GET persons and their applicant numbers for AdminRequirementsPanel.jsx
app.get("/api/upload_documents", async (req, res) => {
  try {
    const [persons] = await db.query(`
      SELECT
        pt.person_id,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.profile_img,
        pt.height,
        pt.generalAverage1,
        pt.emailAddress,
        ant.applicant_number,
        pt.applyingAs
      FROM person_table pt
      LEFT JOIN applicant_numbering_table ant ON pt.person_id = ant.person_id
    `);

    res.status(200).json(persons);
  } catch (error) {
    console.error(" Error fetching upload documents:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM notifications ORDER BY timestamp DESC",
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// -------------------------------------------- GET APPLICANT ADMISSION DATA ------------------------------------------------//
app.get("/api/medical-students", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        snt.student_number,
        p.person_id,
        p.last_name,
        p.first_name,
        p.middle_name,
        p.extension,
        p.program,
        pgt.program_code,
        p.emailAddress,
        p.generalAverage,
        p.generalAverage1,
        p.campus,
        p.created_at,
        p.birthOfDate,
        p.gender,
        p.strand,
        a.applicant_number,
        SUBSTRING(a.applicant_number, 5, 1) AS middle_code,
        ea.schedule_id,
        ees.day_description AS exam_day,
        ees.room_description AS exam_room,
        ees.start_time AS exam_start_time,
        ees.end_time AS exam_end_time,

        /* latest prioritized upload id for this person */
        ruprio.upload_id AS upload_id,
        ruprio.submitted_medical,

        /*  allow NULL values to pass through */
        ruprio.submitted_documents,
        ruprio.registrar_status,

        /* collect missing_documents across uploads if you still want to show aggregated missing docs */
        ruagg.all_missing_docs,

        ruprio.document_status,
        ruprio.created_at AS last_updated,
        ps.exam_status,

        /*  NEW: how many required docs are verified */
        COALESCE(vdocs.verified_count, 0) AS required_docs_verified

      FROM admission.person_table AS p
      LEFT JOIN enrollment.user_accounts AS ua
        ON ua.person_id = p.person_id
      LEFT JOIN admission.applicant_numbering_table AS a
        ON p.person_id = a.person_id
      LEFT JOIN admission.exam_applicants AS ea
        ON a.applicant_number = ea.applicant_id
      LEFT JOIN admission.entrance_exam_schedule AS ees
        ON ea.schedule_id = ees.schedule_id
       LEFT JOIN enrollment.program_table AS pgt ON p.program = pgt.program_id
      INNER JOIN enrollment.person_table AS pst ON p.emailAddress = pst.emailAddress
      INNER JOIN enrollment.student_numbering_table AS snt
        ON pst.person_id = snt.person_id

      /* get aggregated missing_documents for display only */
      LEFT JOIN (
        SELECT
          person_id,
          GROUP_CONCAT(missing_documents SEPARATOR '||') AS all_missing_docs
        FROM admission.requirement_uploads
        GROUP BY person_id
      ) AS ruagg ON ruagg.person_id = p.person_id

      /*  get the prioritized row per applicant */
      LEFT JOIN admission.requirement_uploads AS ruprio
        ON ruprio.upload_id = (
          SELECT ru2.upload_id
          FROM admission.requirement_uploads ru2
          WHERE ru2.person_id = p.person_id
          ORDER BY
            CASE
              WHEN ru2.document_status = 'Disapproved' THEN 1
              WHEN ru2.document_status = 'Program Closed' THEN 2
              WHEN ru2.document_status = 'Documents Verified & ECAT' THEN 3
              WHEN ru2.document_status = 'On process' THEN 4
              ELSE 5
            END ASC,
            ru2.upload_id DESC
          LIMIT 1
        )

      LEFT JOIN admission.person_status_table AS ps
        ON p.person_id = ps.person_id

      /*  subquery: count verified docs for this applicant */
      LEFT JOIN (
        SELECT person_id, COUNT(DISTINCT requirements_id) AS verified_count
        FROM admission.requirement_uploads
        WHERE document_status = 'Documents Verified & ECAT'
          AND requirements_id IN (1,2,3,4)
        GROUP BY person_id
      ) AS vdocs ON vdocs.person_id = p.person_id

 
      ORDER BY p.last_name ASC, p.first_name ASC
    `);

    // Parse aggregated missing_documents into array (if present)
    const merged = rows.map((r) => {
      let mergedDocs = [];
      if (r.all_missing_docs) {
        const parts = r.all_missing_docs.split("||");
        const all = parts.flatMap((item) => {
          try {
            if (!item || item === "null") return [];
            return JSON.parse(item);
          } catch {
            return [];
          }
        });
        mergedDocs = [...new Set(all)];
      }
      return {
        ...r,
        missing_documents: mergedDocs,
      };
    });

    res.json(merged);
  } catch (err) {
    console.error(" Error fetching all applicants:", err);
    res.status(500).send("Server error");
  }
});

app.get("/api/all-students", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT DISTINCT
        pt.person_id,
        pt.campus,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.extension,
        pt.birthOfDate,
        pt.gender,
        snt.student_number,
        ct.curriculum_id,
        pgt.program_id,
        pgt.program_description,
        pgt.program_code,
        dpt.dprtmnt_id,
        dpt.dprtmnt_name,
        dpt.dprtmnt_code,
        sst.year_level_id,
        ylt.year_level_description,
        asyt.year_id,
        asyt.semester_id,
        yt.year_description,
        smt.semester_description,
        remark_summary.en_remarks,
        rt.id AS requirements_id,
        rt.description
      FROM student_numbering_table AS snt
      INNER JOIN person_table AS pt
        ON snt.person_id = pt.person_id
      LEFT JOIN student_curriculum_table AS sct
        ON snt.id = sct.student_numbering_id
      LEFT JOIN curriculum_table AS ct
        ON sct.curriculum_id = ct.curriculum_id
      LEFT JOIN program_table AS pgt
        ON ct.program_id = pgt.program_id
      LEFT JOIN dprtmnt_curriculum_table AS dct
        ON ct.curriculum_id = dct.curriculum_id
      LEFT JOIN dprtmnt_table AS dpt
        ON dct.dprtmnt_id = dpt.dprtmnt_id
      LEFT JOIN student_status_table AS sst
        ON snt.student_number = sst.student_number
      LEFT JOIN year_level_table AS ylt
        ON sst.year_level_id = ylt.year_level_id
      LEFT JOIN active_school_year_table AS asyt
        ON sst.active_school_year_id = asyt.id
      LEFT JOIN year_table AS yt
        ON asyt.year_id = yt.year_id
      LEFT JOIN semester_table AS smt
        ON asyt.semester_id = smt.semester_id
      LEFT JOIN (
        SELECT
          student_number,
          active_school_year_id,
          MAX(en_remarks) AS en_remarks
        FROM enrolled_subject
        GROUP BY student_number, active_school_year_id
      ) AS remark_summary
        ON remark_summary.student_number = snt.student_number
       AND remark_summary.active_school_year_id = sst.active_school_year_id
      LEFT JOIN requirement_uploads AS ru
        ON ru.person_id = pt.person_id
      LEFT JOIN requirements_table AS rt
        ON ru.requirements_id = rt.id
      WHERE snt.student_number IS NOT NULL
      ORDER BY
        asyt.year_id ASC,
        asyt.semester_id ASC,
        snt.student_number ASC,
        rt.id ASC
    `);

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching all students:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/list_of_students", async (req, res) => {
  const { departmentId, dprtmnt_id } = req.query;
  const selectedDepartmentId = departmentId || dprtmnt_id;

  if (!selectedDepartmentId) {
    return res.status(400).json({ message: "Department ID is required" });
  }

  try {
    const [rows] = await db3.query(
      `
      SELECT
        es.student_number,
        es.active_school_year_id
      FROM enrolled_subject es
      INNER JOIN dprtmnt_curriculum_table dct
        ON es.curriculum_id = dct.curriculum_id
      INNER JOIN dprtmnt_table dpt
        ON dct.dprtmnt_id = dpt.dprtmnt_id
      WHERE dpt.dprtmnt_id = ?
      GROUP BY es.student_number, es.active_school_year_id
      ORDER BY es.active_school_year_id ASC
      `,
      [selectedDepartmentId],
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching student numbers by department:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/list_of_students/data/:studentNumber/:activeSchoolYearId", async (req, res) => {
  const { studentNumber, activeSchoolYearId } = req.params;

  if (!studentNumber || !activeSchoolYearId) {
    return res
      .status(400)
      .json({ message: "Student number and active school year ID are required" });
  }

  try {
    const [rows] = await db3.query(
      `
      SELECT
        pt.person_id,
        pt.campus,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.extension,
        pt.birthOfDate,
        pt.gender,
        snt.student_number,
        es.active_school_year_id,
        asyt.year_id,
        asyt.semester_id,
        yt.year_description,
        smt.semester_description,
        ct.curriculum_id,
        pgt.program_id,
        pgt.program_description,
        pgt.program_code,
        dpt.dprtmnt_id,
        dpt.dprtmnt_name,
        dpt.dprtmnt_code,
        sst.year_level_id,
        es.en_remarks AS en_remarks,
        es.en_remarks AS remark_summary,
        ylt.year_level_description
      FROM (
        SELECT
          student_number,
          active_school_year_id,
          curriculum_id,
          MAX(en_remarks) AS en_remarks
        FROM enrolled_subject
        WHERE student_number = ?
          AND active_school_year_id = ?
        GROUP BY student_number, active_school_year_id, curriculum_id
      ) es
      INNER JOIN student_numbering_table snt
        ON es.student_number = snt.student_number
      INNER JOIN person_table pt
        ON snt.person_id = pt.person_id
      INNER JOIN curriculum_table ct
        ON es.curriculum_id = ct.curriculum_id
      INNER JOIN program_table pgt
        ON ct.program_id = pgt.program_id
      INNER JOIN dprtmnt_curriculum_table dct
        ON es.curriculum_id = dct.curriculum_id
      INNER JOIN dprtmnt_table dpt
        ON dct.dprtmnt_id = dpt.dprtmnt_id
      INNER JOIN student_status_table sst
        ON es.student_number = sst.student_number
       AND es.active_school_year_id = sst.active_school_year_id
      INNER JOIN year_level_table ylt
        ON sst.year_level_id = ylt.year_level_id
      LEFT JOIN active_school_year_table asyt
        ON es.active_school_year_id = asyt.id
      LEFT JOIN year_table yt
        ON asyt.year_id = yt.year_id
      LEFT JOIN semester_table smt
        ON asyt.semester_id = smt.semester_id
        GROUP BY student_number, active_school_year_id, curriculum_id
      `,
      [studentNumber, activeSchoolYearId],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Student data not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching student data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/list_of_students/documents/:personId", async (req, res) => {
  const { personId } = req.params;

  if (!personId) {
    return res.status(400).json({ message: "Person ID is required" });
  }

  try {
    const [rows] = await db3.query(
      `
      SELECT
        rt.id AS requirements_id,
        rt.description
      FROM requirement_uploads ru
      INNER JOIN requirements_table rt
        ON ru.requirements_id = rt.id
      WHERE ru.person_id = ?
      GROUP BY ru.person_id, rt.id, rt.description
      ORDER BY rt.id ASC
      `,
      [personId],
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching student documents:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/all-applicants", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT
        snt.student_number,
        p.person_id,
        p.applyingAs,
        p.last_name,
        p.first_name,
        p.middle_name,
        p.extension,
        p.program,
        pgt.program_code,
        p.emailAddress,
        p.generalAverage,
        p.generalAverage1,
        p.campus,
        p.created_at,
        p.birthOfDate,
        p.gender,
        p.strand,
        a.applicant_number,
        SUBSTRING(a.applicant_number, 5, 1) AS middle_code,
        ea.schedule_id,
        ees.day_description AS exam_day,
        ees.room_description AS exam_room,
        ees.start_time AS exam_start_time,
        ees.end_time AS exam_end_time,

        /* latest prioritized upload id for this person */
        ruprio.upload_id AS upload_id,
        ruprio.submitted_medical,

        /*  allow NULL values to pass through */
        ruprio.submitted_documents,
        ruprio.registrar_status,

        /* collect missing_documents across uploads if you still want to show aggregated missing docs */
        ruagg.all_missing_docs,

        ruprio.document_status,
        ruprio.created_at AS last_updated,
        ps.exam_status,
        COALESCE(rtot.total_required_docs, 0) AS total_required_docs,

        /*  NEW: how many required docs are verified */
        COALESCE(vdocs.verified_count, 0) AS required_docs_verified

      FROM admission.person_table AS p
      LEFT JOIN enrollment.user_accounts AS ua
        ON ua.person_id = p.person_id
      LEFT JOIN admission.applicant_numbering_table AS a
        ON p.person_id = a.person_id
      LEFT JOIN admission.exam_applicants AS ea
        ON a.applicant_number = ea.applicant_id
      LEFT JOIN admission.entrance_exam_schedule AS ees
        ON ea.schedule_id = ees.schedule_id
       LEFT JOIN enrollment.program_table AS pgt ON p.program = pgt.program_id
      LEFT JOIN enrollment.student_numbering_table AS snt
        ON p.person_id = snt.person_id

      /* get aggregated missing_documents for display only */
      LEFT JOIN (
        SELECT
          person_id,
          GROUP_CONCAT(missing_documents SEPARATOR '||') AS all_missing_docs
        FROM admission.requirement_uploads
        GROUP BY person_id
      ) AS ruagg ON ruagg.person_id = p.person_id

      /*  get the prioritized row per applicant */
      LEFT JOIN admission.requirement_uploads AS ruprio
        ON ruprio.upload_id = (
          SELECT ru2.upload_id
          FROM admission.requirement_uploads ru2
          WHERE ru2.person_id = p.person_id
          ORDER BY
            CASE
              WHEN ru2.document_status = 'Disapproved' THEN 1
              WHEN ru2.document_status = 'Program Closed' THEN 2
              WHEN ru2.document_status = 'Documents Verified & ECAT' THEN 3
              WHEN ru2.document_status = 'On process' THEN 4
              ELSE 5
            END ASC,
            ru2.upload_id DESC
          LIMIT 1
        )

      LEFT JOIN admission.person_status_table AS ps
        ON p.person_id = ps.person_id
      INNER JOIN admission.user_accounts AS aua
        ON p.person_id = aua.person_id

      LEFT JOIN (
        SELECT
          p2.person_id,
          COUNT(rt.id) AS total_required_docs
        FROM admission.person_table p2
        LEFT JOIN admission.requirements_table rt
          ON rt.applicant_type = p2.applyingAs
         AND rt.category = 'Main'
         AND rt.is_verifiable = 1
        GROUP BY p2.person_id
      ) AS rtot ON rtot.person_id = p.person_id

      /*  subquery: count verified docs for this applicant */
      LEFT JOIN (
        SELECT
          ru.person_id,
          COUNT(DISTINCT ru.requirements_id) AS verified_count
        FROM admission.requirement_uploads ru
        INNER JOIN admission.requirements_table rt
          ON ru.requirements_id = rt.id
        INNER JOIN admission.person_table p3
          ON rt.applicant_type = p3.applyingAs
         AND p3.person_id = ru.person_id
        WHERE ru.document_status = 'Documents Verified & ECAT'
          AND rt.category = 'Main'
          AND rt.is_verifiable = 1
        GROUP BY ru.person_id
      ) AS vdocs ON vdocs.person_id = p.person_id

      WHERE COALESCE(aua.is_archived, 0) = 0

      ORDER BY p.last_name ASC, p.first_name ASC
    `);

    // Parse aggregated missing_documents into array (if present)
    const merged = rows.map((r) => {
      let mergedDocs = [];
      if (r.all_missing_docs) {
        const parts = r.all_missing_docs.split("||");
        const all = parts.flatMap((item) => {
          try {
            if (!item || item === "null") return [];
            return JSON.parse(item);
          } catch {
            return [];
          }
        });
        mergedDocs = [...new Set(all)];
      }
      return {
        ...r,
        missing_documents: mergedDocs,
      };
    });

    res.json(merged);
  } catch (err) {
    console.error(" Error fetching all applicants:", err);
    res.status(500).send("Server error");
  }
});



app.get("/api/verified-ecat-applicants", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT
        p.person_id,
        p.last_name,
        p.campus,
        p.first_name,
        p.middle_name,
        p.extension,
        p.emailAddress,
        p.program,
        p.created_at,
        a.applicant_number,
        SUBSTRING(a.applicant_number, 5, 1) AS middle_code,
        ea.schedule_id,
        ea.email_sent,
        ees.day_description,
        ees.room_description,
        ees.start_time,
        ees.end_time,
        ps.exam_status
      FROM admission.person_table AS p
      LEFT JOIN admission.applicant_numbering_table AS a
        ON p.person_id = a.person_id
      LEFT JOIN admission.exam_applicants AS ea
        ON a.applicant_number = ea.applicant_id
      LEFT JOIN admission.entrance_exam_schedule AS ees
        ON ea.schedule_id = ees.schedule_id
      LEFT JOIN admission.person_status_table AS ps
        ON p.person_id = ps.person_id
      WHERE p.person_id IN (
        SELECT ru.person_id
        FROM admission.requirement_uploads ru
        INNER JOIN admission.requirements_table rt
          ON ru.requirements_id = rt.id
        WHERE ru.document_status = 'Documents Verified & ECAT'
          AND rt.category = 'Main'
        GROUP BY ru.person_id
        HAVING COUNT(DISTINCT ru.requirements_id) >= (
          SELECT COUNT(*)
          FROM admission.requirements_table rt2
          INNER JOIN admission.person_table p2
            ON rt2.applicant_type = p2.applyingAs
            OR rt2.applicant_type = 0
          WHERE rt2.category = 'Main'
            AND p2.person_id = ru.person_id  --  correlated to the specific applicant
        )
      )
      AND (ea.email_sent IS NULL OR ea.email_sent = 0)
      ORDER BY p.last_name ASC, p.first_name ASC;
    `);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No verified ECAT applicants found" });
    }

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching verified ECAT applicants:", err);
    res.status(500).send("Server error");
  }
});

// ================= ENTRANCE EXAM SCHEDULE =================

const formatEnrollmentAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getEnrollmentAuditActor = (req) => ({
  actorId:
    req.body?.audit_actor_id ||
    req.headers["x-audit-actor-id"] ||
    req.headers["x-employee-id"] ||
    "unknown",
  actorRole:
    req.body?.audit_actor_role ||
    req.headers["x-audit-actor-role"] ||
    "registrar",
});

const getGradeUpdateCourseLabel = async (courseId) => {
  try {
    const [rows] = await db3.query(
      "SELECT course_code, course_description FROM course_table WHERE course_id = ? LIMIT 1",
      [courseId],
    );
    const course = rows?.[0];
    if (!course) return `course_id ${courseId}`;
    return `${course.course_code || "N/A"} - ${course.course_description || "Untitled Course"}`;
  } catch (err) {
    console.error("Grade audit course lookup failed:", err);
    return `course_id ${courseId}`;
  }
};

// NEW API
app.post("/api/update-grade", async (req, res) => {
  const { course_id, student_number, final_grade } = req.body;
  console.log("Enrolled ID", course_id);
  console.log("Student Number", student_number);
  console.log("Final Grade", final_grade);

  if (!course_id || !student_number || final_grade === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [result] = await db3.execute(
      `UPDATE enrolled_subject
             SET final_grade = ?
             WHERE student_number = ? AND course_id = ?`,
      [final_grade, student_number, course_id],
    );

    if (result.affectedRows > 0) {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      const courseLabel = await getGradeUpdateCourseLabel(course_id);
      await insertAuditLogEnrollment({
        actorId,
        role: actorRole,
        action: "REGISTRAR_GRADE_UPDATE",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) updated grade of Student (${student_number}) in ${courseLabel} to ${final_grade}.`,
      });
    }

    res.json({ success: true, message: "Grade updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update grade" });
  }
});

app.post("/api/cor-export/audit", async (req, res) => {
  const {
    exported_count,
    department_label,
    program_label,
    year_level_label,
  } = req.body;

  try {
    const { actorId, actorRole } = getEnrollmentAuditActor(req);
    const roleLabel = formatEnrollmentAuditActorRole(actorRole);
    const filters = [
      department_label ? `department ${department_label}` : null,
      program_label ? `program ${program_label}` : null,
      year_level_label ? `year level ${year_level_label}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    await insertAuditLogEnrollment({
      actorId,
      role: actorRole,
      action: "COR_EXPORT",
      severity: "INFO",
      message: `${roleLabel} (${actorId}) exported ${Number(exported_count) || 0} Certificate of Registration PDF file(s)${filters ? ` for ${filters}` : ""}.`,
    });

    res.json({ success: true, message: "COR export audit log inserted" });
  } catch (err) {
    console.error("COR export audit log failed:", err);
    res.status(500).json({ message: "Failed to insert COR export audit log" });
  }
});

// “ Import Excel to person_status_table + update interview_applicants.status (optimized)

app.post("/cancel-unscheduled-applicants", async (req, res) => {
  try {
    // 1¸ Get the short_term from company_settings
    const [[settings]] = await db.query(`
      SELECT short_term FROM company_settings WHERE id = 1
    `);
    const shortTerm = settings?.short_term || "EARIST"; // fallback

    // 2¸ Get all applicants with NO exam schedule
    const [rows] = await db.query(`
      SELECT
        ea.applicant_id,
        ant.person_id,
        pt.emailAddress AS email,
        pt.first_name,
        pt.last_name
      FROM exam_applicants ea
      JOIN applicant_numbering_table ant
        ON ant.applicant_number = ea.applicant_id
      JOIN person_table pt
        ON pt.person_id = ant.person_id
      WHERE ea.schedule_id IS NULL
    `);

    console.log("UNSCHEDULED:", rows);

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: "No unscheduled applicants found.",
      });
    }

    let count = 0;

    for (const a of rows) {
      // 3¸ Update admission_exam †’ status = Cancelled
      await db.query(
        `UPDATE admission_exam
         SET status = 'CANCELLED'
         WHERE person_id = ?`,
        [a.person_id],
      );

      // 4¸ Email contents with short_term applied
      const mailOptions = {
        from: `"${shortTerm} - Admission Office" <${process.env.EMAIL_USER}>`,
        to: a.email,
        subject: `${shortTerm} Admission  Application Cancelled`,
        text: `
Good day ${a.first_name} ${a.last_name},

Thank you for applying to ${shortTerm}.

After a thorough evaluation of your submitted documents, we regret to inform you that your application was not selected to proceed to the next stage of the admission process.

We sincerely appreciate your interest in becoming part of ${shortTerm} and encourage you to explore opportunities that may best align with your academic goals.

Thank you once again for applying.

Sincerely,
${shortTerm} - Admission Office
        `,
      };

      // 5¸ Send email
      try {
        await transporter.sendMail(mailOptions);
        console.log("EMAIL SENT TO:", a.email);
      } catch (emailErr) {
        console.error("Email failed:", emailErr);
      }

      count++;
    }

    res.json({
      success: true,
      message: `${count} unscheduled applicants were cancelled and notified.`,
    });
  } catch (error) {
    console.error(" Error cancelling applicants:", error);
    res.status(500).json({ error: "Server error" });
  }
});



// Get full person info + applicant_number
app.get("/api/person_with_applicant/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [[person]] = await db.query(
      `
      SELECT
        pt.*,
        ant.applicant_number
      FROM person_table pt
      JOIN applicant_numbering_table ant ON pt.person_id = ant.person_id
      WHERE pt.person_id = ? OR ant.applicant_number = ?
      LIMIT 1
    `,
      [id, id],
    );

    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // get latest document status + evaluator
    const [rows] = await db.query(
      `
      SELECT
        ru.document_status    AS upload_document_status,
        rt.id                 AS requirement_id,
        ua.email              AS evaluator_email,
        ua.role               AS evaluator_role,
        ua.first_name              AS evaluator_fname,
        ua.middle_name              AS evaluator_mname,
        ua.last_name              AS evaluator_lname,
        ru.created_at,
        ru.last_updated_by
      FROM requirement_uploads AS ru
      LEFT JOIN requirements_table AS rt ON ru.requirements_id = rt.id
      LEFT JOIN enrollment.user_accounts ua ON ru.last_updated_by = ua.person_id
      WHERE ru.person_id = ?
      ORDER BY ru.created_at DESC
    `,
      [person.person_id],
    );

    if (rows.length > 0) {
      person.document_status = rows[0].upload_document_status || "On process";
      person.evaluator = rows[0];
    } else {
      person.document_status = "On process";
      person.evaluator = null;
    }

    res.json(person);
  } catch (err) {
    console.error(" Error fetching person_with_applicant:", err);
    res.status(500).json({ error: "Failed to fetch person" });
  }
});

// Count how many applicants are enrolled

app.post("/api/notify-submission", async (req, res) => {
  const { person_id } = req.body;

  if (!person_id) {
    return res.status(400).json({ message: "Missing person_id" });
  }

  try {
    const [[appInfo]] = await db.query(
      `
      SELECT
        ant.applicant_number,
        pt.last_name,
        pt.first_name,
        pt.middle_name
      FROM applicant_numbering_table ant
      JOIN person_table pt ON ant.person_id = pt.person_id
      WHERE ant.person_id = ?
    `,
      [person_id],
    );

    const applicant_number = appInfo?.applicant_number || "Unknown";
    const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""} ${appInfo?.middle_name?.charAt(0) || ""}.`;

    const message = ` Applicant #${applicant_number} - ${fullName} submitted their form.`;

    // Save to notifications table
    await db.query(
      "INSERT INTO notifications (type, message, applicant_number) VALUES (?, ?, ?)",
      ["submit", message, applicant_number],
    );

    // Emit notification
    io.emit("notification", {
      type: "submit",
      message,
      applicant_number,
      timestamp: new Date().toISOString(),
      by: null, // prevents "Unknown - System" from being shown
    });

    res.json({ message: "Submission notification sent." });
  } catch (err) {
    console.error("Notification error:", err);
    res.status(500).json({ message: "Failed to notify", error: err.message });
  }
});

//  GET person details by person_id
app.get("/api/person/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `
      SELECT pt.*, ant.applicant_number
      FROM applicant_numbering_table AS ant
      LEFT JOIN person_table AS pt ON ant.person_id = pt.person_id
      WHERE pt.person_id = ?
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(" Error fetching person:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// ›¡ ALLOWED FIELDS IN person_table  prevents invalid updates
const allowedFields = new Set([
  "profile_img",
  "campus",
  "academicProgram",
  "classifiedAs",
  "applyingAs",
  "program",
  "program2",
  "program3",
  "yearLevel",
  "last_name",
  "first_name",
  "middle_name",
  "extension",
  "nickname",
  "height",
  "weight",
  "lrnNumber",
  "nolrnNumber",
  "gender",
  "pwdMember",
  "pwdType",
  "pwdId",
  "birthOfDate",
  "age",
  "birthPlace",
  "languageDialectSpoken",
  "citizenship",
  "religion",
  "civilStatus",
  "tribeEthnicGroup",
  "cellphoneNumber",
  "emailAddress",
  "presentStreet",
  "presentBarangay",
  "presentZipCode",
  "presentRegion",
  "presentProvince",
  "presentMunicipality",
  "presentDswdHouseholdNumber",
  "sameAsPresentAddress",
  "permanentStreet",
  "permanentBarangay",
  "permanentZipCode",
  "permanentRegion",
  "permanentProvince",
  "permanentMunicipality",
  "permanentDswdHouseholdNumber",
  "solo_parent",
  "father_deceased",
  "father_family_name",
  "father_given_name",
  "father_middle_name",
  "father_ext",
  "father_nickname",
  "father_education",
  "father_education_level",
  "father_last_school",
  "father_course",
  "father_year_graduated",
  "father_school_address",
  "father_contact",
  "father_occupation",
  "father_employer",
  "father_income",
  "father_email",
  "mother_deceased",
  "mother_family_name",
  "mother_given_name",
  "mother_middle_name",
  "mother_ext",
  "mother_nickname",
  "mother_education",
  "mother_education_level",
  "mother_last_school",
  "mother_course",
  "mother_year_graduated",
  "mother_school_address",
  "mother_contact",
  "mother_occupation",
  "mother_employer",
  "mother_income",
  "mother_email",
  "guardian",
  "guardian_family_name",
  "guardian_given_name",
  "guardian_middle_name",
  "guardian_ext",
  "guardian_nickname",
  "guardian_address",
  "guardian_contact",
  "guardian_email",
  "annual_income",
  "schoolLevel",
  "schoolLastAttended",
  "schoolAddress",
  "courseProgram",
  "honor",
  "generalAverage",
  "yearGraduated",
  "schoolLevel1",
  "schoolLastAttended1",
  "schoolAddress1",
  "courseProgram1",
  "honor1",
  "generalAverage1",
  "yearGraduated1",
  "strand",
  "cough",
  "colds",
  "fever",
  "asthma",
  "faintingSpells",
  "heartDisease",
  "tuberculosis",
  "frequentHeadaches",
  "hernia",
  "chronicCough",
  "headNeckInjury",
  "hiv",
  "highBloodPressure",
  "diabetesMellitus",
  "allergies",
  "cancer",
  "smokingCigarette",
  "alcoholDrinking",
  "hospitalized",
  "hospitalizationDetails",
  "medications",
  "hadCovid",
  "covidDate",
  "vaccine1Brand",
  "vaccine1Date",
  "vaccine2Brand",
  "vaccine2Date",
  "booster1Brand",
  "booster1Date",
  "booster2Brand",
  "booster2Date",
  "chestXray",
  "cbc",
  "urinalysis",
  "otherworkups",
  "symptomsToday",
  "remarks",
  "termsOfAgreement",
  "created_at",
  "current_step",
]);

const applicantCourseFields = ["program", "program2", "program3"];

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getBearerPayload = (req) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) return null;

  try {
    return webtoken.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const formatPersonFullName = (person, fallback = "Unknown person") => {
  const fullName = [
    person?.first_name || person?.fname,
    person?.middle_name || person?.mname,
    person?.last_name || person?.lname,
    person?.extension,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || fallback;
};

const getAuditActorFromRequest = async (req) => {
  const tokenPayload = getBearerPayload(req) || {};
  const actorId =
    tokenPayload.employee_id ||
    req.headers["x-audit-actor-id"] ||
    req.body?.audit_actor_id ||
    tokenPayload.person_id ||
    req.headers["x-employee-id"] ||
    "unknown";
  const actorRole =
    tokenPayload.role ||
    req.headers["x-audit-actor-role"] ||
    req.body?.audit_actor_role ||
    "registrar";

  let actorName = tokenPayload.email || req.headers["x-audit-actor-name"] || actorId;

  try {
    const [rows] = await db3.query(
      `
      SELECT
        ua.email,
        ua.employee_id,
        ua.person_id,
        ua.role,
        COALESCE(pt.first_name, pr.fname) AS first_name,
        COALESCE(pt.middle_name, pr.mname) AS middle_name,
        COALESCE(pt.last_name, pr.lname) AS last_name
      FROM user_accounts ua
      LEFT JOIN person_table pt ON pt.person_id = ua.person_id
      LEFT JOIN prof_table pr ON pr.person_id = ua.person_id OR pr.employee_id = ua.employee_id
      WHERE ua.employee_id = ? OR ua.person_id = ? OR ua.email = ?
      LIMIT 1
      `,
      [actorId, tokenPayload.person_id || actorId, tokenPayload.email || actorId],
    );

    if (rows?.[0]) {
      actorName = formatPersonFullName(rows[0], rows[0].email || actorName);
    }
  } catch (error) {
    console.error("Audit actor lookup failed:", error);
  }

  return {
    actorId,
    actorRole,
    actorName,
  };
};

const auditSectionLabels = {
  personal_information: "personal information",
  family_information: "family information",
  educational_attainment: "educational attainment data",
  health_information: "health information",
};

const getAuditChangeSection = (req) => {
  const section = String(req.headers["x-audit-change-section"] || "").trim();
  return auditSectionLabels[section] ? section : "";
};

const insertProfileChangeAuditLog = async ({
  req,
  target,
  targetType,
  targetNumber,
  auditLogger,
}) => {
  const section = getAuditChangeSection(req);
  if (!section) return;

  const { actorId, actorRole, actorName } = await getAuditActorFromRequest(req);
  const sectionLabel = auditSectionLabels[section];
  const targetLabel = targetType === "student" ? "student" : "applicant";
  const targetName = formatPersonFullName(target, `Unknown ${targetLabel}`);
  const safeNumber = targetNumber || "N/A";

  await auditLogger({
    actorId,
    role: actorRole,
    action: "PROFILE_UPDATE",
    severity: "INFO",
    message: `${actorName} (${actorId}) changed the ${sectionLabel} of the ${targetLabel} ${targetName} (${safeNumber})`,
  });
};

const getNotificationActorFromRequest = async (req) => {
  const tokenPayload = getBearerPayload(req) || {};
  const lookupId =
    req.body?.actor_person_id ||
    tokenPayload.person_id ||
    req.headers["x-audit-actor-person-id"] ||
    req.headers["x-audit-actor-id"] ||
    tokenPayload.employee_id ||
    req.body?.actor_employee_id ||
    "unknown";
  const lookupEmail = tokenPayload.email || req.headers["x-audit-actor-email"] || "";

  try {
    const [rows] = await db3.query(
      `
      SELECT
        ua.employee_id,
        ua.email,
        ua.first_name,
        ua.middle_name,
        ua.last_name,
        at.access_description
      FROM user_accounts ua
      LEFT JOIN access_table at ON at.access_id = ua.access_level
      WHERE ua.person_id = ? OR ua.employee_id = ? OR ua.email = ?
      LIMIT 1
      `,
      [lookupId, lookupId, lookupEmail || lookupId],
    );

    if (rows?.[0]) {
      const actor = rows[0];
      return {
        id: actor.employee_id || lookupId,
        email: actor.email || lookupEmail || "unknown",
        name: formatPersonFullName(actor, actor.email || lookupId),
        accessDescription: actor.access_description || "",
      };
    }
  } catch (error) {
    console.error("Notification audit actor lookup failed:", error);
  }

  return {
    id: req.body?.actor_employee_id || lookupId,
    email: lookupEmail || "unknown",
    name: req.headers["x-audit-actor-name"] || lookupEmail || lookupId,
    accessDescription: req.headers["x-audit-actor-role"] || "",
  };
};

const getFacultyNotificationActor = async (profId) => {
  try {
    const [rows] = await db3.query(
      "SELECT prof_id, employee_id, email, fname, mname, lname FROM prof_table WHERE prof_id = ? LIMIT 1",
      [profId],
    );

    if (rows?.[0]) {
      const professor = rows[0];
      return {
        id: professor.employee_id || professor.prof_id,
        notificationId: professor.prof_id,
        email: professor.email || "unknown",
        name: `${professor.lname || ""}, ${professor.fname || ""} ${professor.mname || ""}`.trim(),
      };
    }
  } catch (error) {
    console.error("Faculty notification audit actor lookup failed:", error);
  }

  return {
    id: profId || "unknown",
    notificationId: profId || "unknown",
    email: "unknown",
    name: profId || "unknown",
  };
};

const buildNotificationAuditMessage = async (req) => {
  const eventType = String(req.body?.event_type || "").trim();
  const details = req.body?.details || {};
  const actor = eventType.startsWith("faculty_")
    ? await getFacultyNotificationActor(details.prof_id)
    : await getNotificationActorFromRequest(req);
  const employeePrefix = `${actor.accessDescription || "Employee ID"} #${actor.id} - ${actor.email || actor.name}`;
  const userPrefix = `User #${actor.id} - ${actor.name}`;

  const gradeEntry = `${details.min_score}-${details.max_score} = ${details.equivalent_grade}`;
  const gradingSheetProfessor = details.professor_name || `Prof. ${actor.name || "Unknown Faculty"}`;
  const gradingSheetEmployeeId = details.employee_id || actor.id || "N/A";
  const gradingSheetStudent = details.student_name || "Unknown Student";
  const gradingSheetStudentNumber = details.student_number || "N/A";
  const gradingSheetSubject = details.subject_name || details.course_description || "N/A";
  const gradingSheetSubjectCode = details.subject_code ? ` (${details.subject_code})` : "";
  const gradingSheetSection = details.section_name
    ? ` - ${details.program_code ? `${details.program_code}-` : ""}${details.section_name}`
    : "";
  const gradingSheetFile = details.file_name || "N/A";
  const gradingSheetStudentCount = details.student_count
    ? ` (${details.student_count} student/s)`
    : "";
  const gradingSheetImportCount = details.imported_count
    ? ` Imported: ${details.imported_count}.`
    : "";
  const gradingSheetError = details.error_message ? ` Reason: ${details.error_message}` : "";
  const gradingSheetMidterm = details.midterm_equivalent_grade || details.midterm_grade || "N/A";
  const gradingSheetFinalterm = details.finalterm_equivalent_grade || details.finalterm_grade || "N/A";
  const gradingSheetFinalGrade = details.final_equivalent_grade || details.final_grade || "N/A";
  const schedulePage = details.page_name === "College Schedule Checker"
    ? "College Schedule Checker"
    : "Schedule Checker";
  const scheduleType = details.schedule_type === "honorarium" ? "honorarium" : "regular";

  const events = {
    grade_conversion_saved: {
      type: details.is_update ? "update" : "insert",
      message: `${employeePrefix} successfully ${details.is_update ? "updated" : "created"} grade conversion entry (${gradeEntry})`,
    },
    grade_conversion_deleted: {
      type: "delete",
      message: `${employeePrefix} successfully deleted grade conversion entry (${gradeEntry})`,
    },
    honors_rule_saved: {
      type: details.is_update ? "update" : "insert",
      message: `${employeePrefix} successfully ${details.is_update ? "updated" : "created"} honors rule (${details.title || "Untitled"})`,
    },
    honors_rule_deleted: {
      type: "delete",
      message: `${employeePrefix} successfully deleted honors rule (${details.title || "Untitled"})`,
    },
    grading_period_activated: {
      type: "update",
      message: `${employeePrefix} successfully activated grading period (${details.description || details.id || "N/A"})`,
    },
    enrolled_subjects_imported: {
      type: "import",
      message: `${employeePrefix} successfully imported enrolled subjects from XLSX${details.imported_count ? ` (${details.imported_count} record/s)` : ""}${details.skipped_count ? ` with ${details.skipped_count} skipped row/s` : ""}`,
    },
    payment_saved: {
      type: "insert",
      message: `${employeePrefix} successfully saved student #${details.student_number || "N/A"} payment to ${details.payment_target || "N/A"}`,
    },
    payment_transferred: {
      type: "insert",
      message: `${employeePrefix} successfully transferred student #${details.student_number || "N/A"} payment to ${details.payment_target || "N/A"}`,
    },
    schedule_inserted: {
      type: "insert",
      message: `${employeePrefix} successfully inserted ${scheduleType} schedule in ${schedulePage}`,
    },
    schedule_designation_inserted: {
      type: "insert",
      message: `${employeePrefix} successfully inserted designation schedule in ${schedulePage}`,
    },
    schedule_deleted: {
      type: "delete",
      message: `${employeePrefix} successfully deleted schedule in ${schedulePage}`,
    },
    program_evaluation_grade_submitted: {
      type: "submit",
      message: `${userPrefix} successfully submitted student grades in Program Evaluation`,
    },
    faculty_grading_sheet_grade_submitted: {
      type: "submit",
      message: `${gradingSheetProfessor} (${gradingSheetEmployeeId}) graded the student ${gradingSheetStudent} (${gradingSheetStudentNumber}) in ${gradingSheetSubject}${gradingSheetSubjectCode}.\nMidterm Grade: ${gradingSheetMidterm}\nFinalterm Grade: ${gradingSheetFinalterm}\nFinal Grade: ${gradingSheetFinalGrade}`,
    },
    faculty_grading_sheet_exported: {
      type: "export",
      message: `${gradingSheetProfessor} (${gradingSheetEmployeeId}) exported the Grading Sheet for ${gradingSheetSubject}${gradingSheetSubjectCode}${gradingSheetSection}${gradingSheetStudentCount}. File: ${gradingSheetFile}`,
    },
    faculty_grading_sheet_upload_succeeded: {
      type: "upload",
      message: `${gradingSheetProfessor} (${gradingSheetEmployeeId}) successfully imported grades in Grading Sheet for ${gradingSheetSubject}${gradingSheetSubjectCode}${gradingSheetSection}. File: ${gradingSheetFile}.${gradingSheetImportCount}`,
    },
    faculty_grading_sheet_upload_tried: {
      type: "upload",
      message: `${gradingSheetProfessor} (${gradingSheetEmployeeId}) tried to import grades in Grading Sheet for ${gradingSheetSubject}${gradingSheetSubjectCode}${gradingSheetSection}. File: ${gradingSheetFile}.${gradingSheetError}`,
    },
    faculty_grading_sheet_upload_failed: {
      type: "upload",
      message: `${gradingSheetProfessor} (${gradingSheetEmployeeId}) failed to import grades in Grading Sheet for ${gradingSheetSubject}${gradingSheetSubjectCode}${gradingSheetSection}. File: ${gradingSheetFile}.${gradingSheetError}`,
    },
    faculty_grading_sheet_save_all: {
      type: "submit",
      message: `${userPrefix} executed Save All in Grading Sheet. Success: ${Number(details.success_count || 0)}, Failed: ${Number(details.fail_count || 0)}`,
    },
    faculty_evaluation_printed: {
      type: "Printing",
      message: `${userPrefix} printed Faculty Evaluation Report`,
    },
  };

  const event = events[eventType];
  if (!event) return null;

  return {
    ...event,
    eventType,
    actor,
    notificationId: actor.notificationId || actor.id,
  };
};

app.post("/api/audit/event", async (req, res) => {
  try {
    const auditEvent = await buildNotificationAuditMessage(req);
    if (!auditEvent) {
      return res.status(400).json({ message: "Unsupported audit event" });
    }

    await db.query(
      `INSERT INTO notifications (type, message, applicant_number, actor_email, actor_name, timestamp)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        auditEvent.type,
        auditEvent.message,
        auditEvent.notificationId,
        auditEvent.actor.email,
        auditEvent.actor.name,
      ],
    );

    await insertAuditLogEnrollment({
      actorId: auditEvent.actor.id,
      role: req.headers["x-audit-actor-role"] || req.body?.audit_actor_role || "faculty",
      action: auditEvent.eventType,
      severity: "INFO",
      message: auditEvent.message,
    });

    res.json({ success: true, message: "Log inserted" });
  } catch (error) {
    console.error("Error inserting audit event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const getApplicantCurriculumLabel = async (curriculumId) => {
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
  const roleLabel = formatAuditActorRole(actorRole);
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
    message: `${roleLabel} (${safeActor}) changed course of Applicant (${applicantLabel}) ${changeText}.`,
  });
};

const requirementStatusLabel = (status) => {
  if (Number(status) === 1) return "Verified";
  if (Number(status) === 2) return "Rejected";
  return "Pending";
};

const getRequirementUploadAuditInfo = async (uploadId) => {
  const [rows] = await db.query(
    `
    SELECT
      ru.upload_id,
      ru.person_id,
      ru.status,
      ru.document_status,
      rt.description,
      ant.applicant_number,
      pt.first_name,
      pt.middle_name,
      pt.last_name,
      pt.emailAddress
    FROM requirement_uploads ru
    LEFT JOIN requirements_table rt ON rt.id = ru.requirements_id
    LEFT JOIN person_table pt ON pt.person_id = ru.person_id
    LEFT JOIN applicant_numbering_table ant ON ant.person_id = ru.person_id
    WHERE ru.upload_id = ?
    LIMIT 1
    `,
    [uploadId],
  );

  return rows?.[0] || null;
};

const getApplicantDocumentStatusInfo = async (applicantNumber) => {
  const [rows] = await db.query(
    `
    SELECT
      ant.applicant_number,
      pt.person_id,
      pt.first_name,
      pt.middle_name,
      pt.last_name,
      pt.emailAddress,
      ru.document_status
    FROM applicant_numbering_table ant
    INNER JOIN person_table pt ON pt.person_id = ant.person_id
    LEFT JOIN requirement_uploads ru ON ru.person_id = pt.person_id
    WHERE ant.applicant_number = ?
    ORDER BY ru.upload_id DESC
    LIMIT 1
    `,
    [applicantNumber],
  );

  return rows?.[0] || null;
};

const applicantAuditLabel = (applicant) => {
  const applicantName = [
    applicant?.last_name,
    applicant?.first_name,
    applicant?.middle_name,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    applicant?.applicant_number ||
    applicantName ||
    applicant?.emailAddress ||
    `person_id ${applicant?.person_id || "unknown"}`
  );
};

const insertRequirementAuditLog = async ({
  actorId,
  actorRole,
  message,
  severity = "INFO",
}) => {
  await insertAuditLogAdmission({
    actorId: actorId || "unknown",
    role: actorRole || "registrar",
    action: "APPLICANT_REQUIREMENTS",
    severity,
    message,
  });
};

//  PUT update person details by person_id (SAFE VERSION)
app.put("/api/person/:id", async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "No fields provided for update" });
    }

    //  Clean + FILTER only allowed columns
    const cleanedEntries = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.has(key)) // — ignores applicant_number
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, value === "" ? null : value]);

    if (cleanedEntries.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const courseUpdateFields = cleanedEntries
      .filter(([key]) => applicantCourseFields.includes(key))
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
      return res
        .status(404)
        .json({ error: "Person not found or no changes made" });
    }

    if (getAuditChangeSection(req)) {
      const [targetRows] = await db.query(
        `
        SELECT pt.*, ant.applicant_number
        FROM person_table pt
        LEFT JOIN applicant_numbering_table ant ON ant.person_id = pt.person_id
        WHERE pt.person_id = ?
        LIMIT 1
        `,
        [id],
      );

      await insertProfileChangeAuditLog({
        req,
        target: targetRows?.[0],
        targetType: "applicant",
        targetNumber: targetRows?.[0]?.applicant_number,
        auditLogger: insertAuditLogAdmission,
      });
    }

    if (applicantBefore && courseUpdateFields.length > 0) {
      const cleanedData = Object.fromEntries(cleanedEntries);
      const changes = [];

      for (const field of courseUpdateFields) {
        const oldValue = applicantBefore[field] ?? null;
        const newValue = cleanedData[field] ?? null;

        if (String(oldValue || "") !== String(newValue || "")) {
          const [fromLabel, toLabel] = await Promise.all([
            getApplicantCurriculumLabel(oldValue),
            getApplicantCurriculumLabel(newValue),
          ]);

          changes.push({
            label: field === "program" ? "course applied" : field,
            fromLabel,
            toLabel,
          });
        }
      }

      const courseAuditActor = await getAuditActorFromRequest(req);

      await insertApplicantCourseChangeAuditLog({
        actorId: courseAuditActor.actorId,
        actorRole: courseAuditActor.actorRole,
        applicant: applicantBefore,
        changes,
      });
    }

    res.json({ message: " Person updated successfully" });
  } catch (error) {
    console.error(" Error updating person:", error);
    res.status(500).json({
      error: "Database error during update",
      details: error.message,
    });
  }
});

//  Fetch full record
app.get("/api/person/enrollment_data/:person_id", async (req, res) => {
  const { person_id } = req.params;
  const [rows] = await db3.query(
    `
    SELECT p.*, s.student_number
    FROM person_table p
    LEFT JOIN student_numbering_table s ON p.person_id = s.person_id
    WHERE p.person_id = ?
  `,
    [person_id],
  );
  if (!rows.length)
    return res.status(404).json({ message: "Person not found" });
  res.json(rows[0]);
});

//  Update person in ENROLLMENT DB (db3)
app.put("/api/enrollment/person/:person_id", async (req, res) => {
  const { person_id } = req.params;
  const updatedData = req.body;

  try {
    const [result] = await db3.query(
      "UPDATE person_table SET ? WHERE person_id = ?",
      [updatedData, person_id],
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Person not found in ENROLLMENT" });

    if (getAuditChangeSection(req)) {
      const [targetRows] = await db3.query(
        `
        SELECT p.*, s.student_number
        FROM person_table p
        LEFT JOIN student_numbering_table s ON s.person_id = p.person_id
        WHERE p.person_id = ?
        LIMIT 1
        `,
        [person_id],
      );

      await insertProfileChangeAuditLog({
        req,
        target: targetRows?.[0],
        targetType: "student",
        targetNumber: targetRows?.[0]?.student_number,
        auditLogger: insertAuditLogEnrollment,
      });
    }

    res.json({
      success: true,
      message: "Person updated successfully in ENROLLMENT DB3",
    });
  } catch (err) {
    console.error(" Error updating person in ENROLLMENT DB:", err);
    res.status(500).json({ error: "Failed to update person in ENROLLMENT DB" });
  }
});

app.post(
  "/api/enrollment/upload-profile-picture",
  upload.single("profile_picture"),
  async (req, res) => {
    const { person_id } = req.body;

    if (!person_id || !req.file) {
      return res.status(400).json({ message: "Missing person_id or file." });
    }

    try {
      // ✅ Get applicant_number FROM DB3
      const [rows] = await db3.query(
        "SELECT student_number FROM student_numbering_table WHERE person_id = ?",
        [person_id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Student number not found for person_id " + person_id,
        });
      }

      const student_number = rows[0].student_number;

      const ext = path.extname(req.file.originalname).toLowerCase();
      const year = new Date().getFullYear();
      const filename = `${student_number}_1by1_${year}${ext}`;

      const uploadDir = path.join(__dirname, "uploads/Student1by1");
      const finalPath = path.join(uploadDir, filename);

      // ✅ delete old file
      const files = await fs.promises.readdir(uploadDir);
      for (const file of files) {
        if (file.startsWith(`${student_number}_1by1_`)) {
          await fs.promises.unlink(path.join(uploadDir, file));
        }
      }

      // ✅ save new file
      await fs.promises.writeFile(finalPath, req.file.buffer);

      // ✅ UPDATE USING DB3
      await db3.query(
        "UPDATE person_table SET profile_img = ? WHERE person_id = ?",
        [filename, person_id]
      );

      res.status(200).json({
        message: "Uploaded successfully",
        filename,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({
        message: "Failed to upload image.",
        error: err.message,
      });
    }
  }
);

// ===========================================================
//  STUDENT  can update ONLY their own personal information
//     (db3 ENROLLMENT person_table)
// ===========================================================

// GET for Dashboard1
app.get("/api/dashboard1/:id", checkStepAccess(1), async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM person_table WHERE person_id = ?",
    [id],
  );
  res.json(rows[0]);
});

// GET for Dashboard2
app.get("/api/dashboard2/:id", checkStepAccess(2), async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM person_table WHERE person_id = ?",
    [id],
  );
  res.json(rows[0]);
});

// GET for Dashboard3
app.get("/api/dashboard3/:id", checkStepAccess(3), async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM person_table WHERE person_id = ?",
    [id],
  );
  res.json(rows[0]);
});

// GET for Dashboard4
app.get("/api/dashboard4/:id", checkStepAccess(4), async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM person_table WHERE person_id = ?",
    [id],
  );
  res.json(rows[0]);
});

// GET for Dashboard5
app.get("/api/dashboard5/:id", checkStepAccess(5), async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.execute(
    "SELECT * FROM person_table WHERE person_id = ?",
    [id],
  );
  res.json(rows[0]);
});

app.put("/api/person/:id/progress", async (req, res) => {
  const { id } = req.params;
  const { nextStep } = req.body;

  try {
    await db.execute(
      "UPDATE person_table SET current_step = ? WHERE person_id = ?",
      [nextStep, id],
    );
    res.json({ message: "Progress updated" });
  } catch (err) {
    console.error("Error updating progress:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// For Major
app.get("/api/programs", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT
        program_id,
        program_code,
        program_description,
        major
      FROM program_table
      ORDER BY program_description
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching programs:", err);
    res.status(500).json({ message: "Failed to fetch programs" });
  }
});

app.post(
  "/api/upload-profile-picture",
  upload.single("profile_picture"),
  async (req, res) => {
    const { person_id } = req.body;
    if (!person_id || !req.file) {
      return res.status(400).send("Missing person_id or file.");
    }

    try {
      //  Get applicant_number from person_id
      const [rows] = await db.query(
        "SELECT applicant_number FROM applicant_numbering_table WHERE person_id = ?",
        [person_id],
      );
      if (!rows.length) {
        return res.status(404).json({
          message: "Applicant number not found for person_id " + person_id,
        });
      }

      const applicant_number = rows[0].applicant_number;

      const ext = path.extname(req.file.originalname).toLowerCase();
      const year = new Date().getFullYear();
      const filename = `${applicant_number}_1by1_${year}${ext}`; //  Use applicant number here
      const finalPath = path.join(__dirname, "uploads", filename);

      //  Save file
      await fs.promises.writeFile(finalPath, req.file.buffer);

      //  Save to DB (still use person_id here)
      await db3.query(
        "UPDATE person_table SET profile_img = ? WHERE person_id = ?",
        [filename, person_id],
      );

      res.status(200).json({ message: "Uploaded successfully", filename });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).send("Failed to upload image.");
    }
  },
);

//  2. Get person details by person_id
app.get("/api/person/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      "SELECT * FROM person_table WHERE person_id=?",
      [id],
    );

    if (!rows.length)
      return res.status(404).json({ error: "Person not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching person:", error);
    res.status(500).json({ error: "Database error" });
  }
});

//  4. Upload & update profile_img
app.post(
  "/api/person/:id/upload-profile",
  upload.single("profile_img"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const filePath = req.file?.filename;

      if (!filePath) return res.status(400).json({ error: "No file uploaded" });

      // Remove old image if exists
      const [rows] = await db.execute(
        "SELECT profile_img FROM person_table WHERE person_id=?",
        [id],
      );
      const oldImg = rows[0]?.profile_img;

      if (oldImg) {
        const oldPath = path.join(__dirname, "uploads", oldImg);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await db.execute(
        "UPDATE person_table SET profile_img=? WHERE person_id=?",
        [filePath, id],
      );
      res.json({ message: "Profile image updated", profile_img: filePath });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Database error" });
    }
  },
);

//  5. Get applied programs list (sample, adjust db name/table)
// server.js
app.get("/api/applied_program", async (req, res) => {
  try {
    const [rows] = await db3.execute(`
      SELECT
        ct.curriculum_id,
        ct.year_id,
        yt.year_description,
        yt.year_description AS current_year,
        yt.year_description + 1 AS next_year,
        pt.program_id,
        pt.program_code,
        pt.program_description,
        pt.major,
        pt.components,
        pt.academic_program,
        d.dprtmnt_id,
        d.dprtmnt_name
      FROM curriculum_table AS ct
      INNER JOIN program_table AS pt ON pt.program_id = ct.program_id
      INNER JOIN dprtmnt_curriculum_table AS dc ON ct.curriculum_id = dc.curriculum_id
      INNER JOIN year_table AS yt ON ct.year_id = yt.year_id
      INNER JOIN dprtmnt_table AS d ON dc.dprtmnt_id = d.dprtmnt_id 
      WHERE ct.lock_status = 1
    `);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No curriculum data found" });
    }

    res.json(rows);
  } catch (error) {
    console.error("Error fetching curriculum data:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/search-person", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        p.*,
        a.applicant_number
      FROM person_table p
      LEFT JOIN applicant_numbering_table a ON p.person_id = a.person_id
      WHERE a.applicant_number LIKE ?
         OR p.first_name LIKE ?
         OR p.last_name LIKE ?
         OR p.emailAddress LIKE ?
      LIMIT 1
    `,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No matching applicant found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error searching person:", error);
    res.status(500).json({ error: "Server error" });
  }
});

//  Update document_status for a person
// Update document_status for all uploads of a person
app.put("/api/uploads/person/:id/document-status", async (req, res) => {
  const { id } = req.params;
  const { document_status } = req.body;

  try {
    const [result] = await db.query(
      "UPDATE requirement_uploads SET document_status = ? WHERE person_id = ?",
      [document_status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Uploads for person not found" });
    }

    res.json({ success: true, document_status });
  } catch (err) {
    console.error("Error updating document_status:", err);
    res.status(500).json({ error: "Failed to update document_status" });
  }
});

// server.js
app.post("/api/requirement-uploads", async (req, res) => {
  const {
    requirements_id,
    person_id,
    file_path,
    original_name,
    status,
    document_status,
    missing_documents,
    remarks,
  } = req.body;

  try {
    await db.query(
      `INSERT INTO requirement_uploads
        (requirements_id, person_id, file_path, original_name, status, document_status, missing_documents, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        file_path = VALUES(file_path),
        original_name = VALUES(original_name),
        status = VALUES(status),
        document_status = VALUES(document_status),
        missing_documents = VALUES(missing_documents),
        remarks = VALUES(remarks),
        last_updated_by = VALUES(last_updated_by)`,
      [
        requirements_id,
        person_id,
        file_path,
        original_name,
        status,
        document_status,
        missing_documents,
        remarks,
      ],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving requirement:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//  Update missing_documents for all rows of this person
app.put("/api/missing-documents/:person_id", async (req, res) => {
  const { person_id } = req.params;
  let { missing_documents, user_id } = req.body;

  try {
    if (!Array.isArray(missing_documents)) {
      missing_documents = [];
    }

    const jsonDocs = JSON.stringify(missing_documents);

    await db.query(
      `UPDATE admission.requirement_uploads
       SET missing_documents = ?, last_updated_by = ?
       WHERE person_id = ?`,
      [jsonDocs, user_id || null, person_id],
    );

    res.json({ success: true, message: "Missing documents updated" });
  } catch (err) {
    console.error(" Error updating missing_documents:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update missing_documents" });
  }
});

// Update requirement upload (submitted + missing documents)
app.post("/api/update-requirement", async (req, res) => {
  const { person_id, requirements_id, submitted_documents } = req.body;
  let { missing_documents } = req.body;

  try {
    if (Array.isArray(missing_documents)) {
      missing_documents = JSON.stringify(missing_documents);
    } else if (typeof missing_documents !== "string") {
      missing_documents = "[]";
    }

    await db.query(
      `UPDATE requirement_uploads
       SET submitted_documents = ?, missing_documents = ?
       WHERE person_id = ? AND requirements_id = ?`,
      [submitted_documents, missing_documents, person_id, requirements_id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating requirement:", err);
    res.status(500).json({ error: "Failed to update requirement" });
  }
});

// ----------------- VERIFY PASSWORD -----------------
app.post("/api/verify-password", async (req, res) => {
  const { person_id, password } = req.body;

  if (!person_id || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Person ID and password required" });
  }

  try {
    const [rows] = await db3.query(
      "SELECT * FROM user_accounts WHERE person_id = ?",
      [person_id],
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("verify-password error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during password verification",
    });
  }
});

registerSocketHandlers({
  app,
  io,
  db,
  db3,
  transporter,
  bcrypt,
  webtoken,
  fs,
  path,
  QRCode,
  applicantDocsDir,
  getGradeConversions,
  getStoredNumericGrade,
  profileUpload,
  upload,
  baseDir: __dirname,
});


app.post("/api/generate-cor-pdf", async (req, res) => {
  let browser;

  try {
    const { html, student_number } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    console.log("Received HTML length:", html.length);

    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    page.on("console", (msg) => {
      console.log("PAGE LOG:", msg.text());
    });

    page.on("pageerror", (err) => {
      console.log("PAGE ERROR:", err.message);
    });

    page.on("requestfailed", (request) => {
      console.log(
        "REQUEST FAILED:",
        request.url(),
        request.failure()?.errorText,
      );
    });

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await page.evaluate(async () => {
      const images = Array.from(document.images);

      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();

          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }),
      );
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 0.9,
      margin: {
        right: "10mm",

        left: "10mm",
      },
    });

    console.log("PDF buffer size:", pdfBuffer.length);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const { actorId, actorRole } = getEnrollmentAuditActor(req);
    const roleLabel = formatEnrollmentAuditActorRole(actorRole);
    await insertAuditLogEnrollment({
      actorId,
      role: actorRole,
      action: "STUDENT_SCHOLARSHIP_COR_EXPORT",
      severity: "INFO",
      message: `${roleLabel} (${actorId}) exported Certificate of Registration PDF${student_number ? ` for Student (${student_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=certificate.pdf",
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR:", err);

    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.get("/api/submitted-status/:person_id", async (req, res) => {
  const { person_id } = req.params;

  try {
    const [[row]] = await db.query(
      `
      SELECT COALESCE(MAX(submitted_documents), 0) AS submitted_documents
      FROM requirement_uploads
      WHERE person_id = ?
      `,
      [person_id]
    );

    res.json({ submitted_documents: row.submitted_documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submitted status" });
  }
});

const PORT = process.env.WEB_PORT || 5000;
const HOST = getDbHost();
http.listen(PORT, "0.0.0.0", () => {
  const localIP = getDbHost();
  console.log(` Server running on:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}`);
});
