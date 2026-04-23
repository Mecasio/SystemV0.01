const express = require("express");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { db, db3 } = require("../database/database");
require("dotenv").config();
const router = express.Router();



const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


router.get("/student_list", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const requestedLimit = Number(req.query.limit) || 100;
    const limit = Math.min(Math.max(requestedLimit, 1), 200);
    const search = req.query.search?.trim() || "";

    const offset = (page - 1) * limit;

    let whereClause = "";
    let params = [];

    // ✅ FAST SEARCH (index-friendly)
    if (search) {
      whereClause = `
        WHERE 
          snt.student_number LIKE ? OR
          pt.last_name LIKE ? OR
          pt.first_name LIKE ?
      `;

      const searchValue = `${search}%`; // ✅ removed leading %
      params = [searchValue, searchValue, searchValue];
    }

    // ✅ MAIN QUERY (FILTER FIRST, LESS JOINS)
    const listSql = `
      SELECT
        snt.student_number,
        pt.campus,
        pt.person_id,
        pt.last_name,
        pt.first_name,
        pt.middle_name,
        pt.emailAddress
      FROM student_numbering_table snt
      INNER JOIN person_table pt
        ON snt.person_id = pt.person_id
      ${whereClause}
      ORDER BY snt.student_number ASC
      LIMIT ? OFFSET ?
    `;

    const [students] = await db3.query(listSql, [...params, limit, offset]);
    let rows = students;

    if (students.length > 0) {
      const studentNumbers = students.map((student) => student.student_number);
      const placeholders = studentNumbers.map(() => "?").join(", ");

      const metadataSql = `
        SELECT
          latest.student_number,
          pgt.program_code,
          pgt.program_id,
          pgt.program_description,
          pgt.major,
          dt.dprtmnt_name,
          dt.dprtmnt_id
        FROM (
          SELECT
            es.student_number,
            MAX(es.id) AS enrolled_subject_id
          FROM enrolled_subject es
          WHERE es.student_number IN (${placeholders})
          GROUP BY es.student_number
        ) latest
        INNER JOIN enrolled_subject es
          ON es.id = latest.enrolled_subject_id
        LEFT JOIN curriculum_table ct
          ON es.curriculum_id = ct.curriculum_id
        LEFT JOIN program_table pgt
          ON ct.program_id = pgt.program_id
        LEFT JOIN dprtmnt_curriculum_table dct
          ON ct.curriculum_id = dct.curriculum_id
        LEFT JOIN dprtmnt_table dt
          ON dct.dprtmnt_id = dt.dprtmnt_id
      `;

      const [metadataRows] = await db3.query(metadataSql, studentNumbers);
      const metadataByStudentNumber = new Map(
        metadataRows.map((row) => [row.student_number, row]),
      );

      rows = students.map((student) => {
        const metadata = metadataByStudentNumber.get(student.student_number);
        return {
          ...student,
          program_code: metadata?.program_code || null,
          program_id: metadata?.program_id || null,
          program_description: metadata?.program_description || null,
          major: metadata?.major || null,
          dprtmnt_name: metadata?.dprtmnt_name || null,
          dprtmnt_id: metadata?.dprtmnt_id || null,
        };
      });
    }

    // ✅ LIGHTWEIGHT COUNT (no heavy joins)
    let countSql = `
      SELECT COUNT(*) as total
      FROM student_numbering_table snt
      INNER JOIN person_table pt 
        ON snt.person_id = pt.person_id
      ${whereClause}
    `;

    const [countRows] = await db3.query(countSql, params);

    res.json({
      data: rows,
      total: countRows[0].total,
      page,
      totalPages: Math.ceil(countRows[0].total / limit),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});


router.get("/student_list/:student_number", async (req, res) => {

  const { student_number } =
    req.params;

  try {

    const sql = `
SELECT
    snt.student_number,
    pt.person_id,
    pt.last_name,
    pt.first_name,
    pt.middle_name,
    pt.emailAddress,
    pgt.program_code,
    pgt.program_description,
    dt.dprtmnt_name,
    ylt.year_level_description

FROM student_numbering_table snt

INNER JOIN person_table pt
ON snt.person_id = pt.person_id

LEFT JOIN enrolled_subject es
ON es.id = (
    SELECT MAX(es2.id)
    FROM enrolled_subject es2
    WHERE es2.student_number = snt.student_number
)

LEFT JOIN curriculum_table ct
ON es.curriculum_id = ct.curriculum_id

LEFT JOIN program_table pgt
ON ct.program_id = pgt.program_id

LEFT JOIN dprtmnt_curriculum_table dct
ON ct.curriculum_id = dct.curriculum_id

LEFT JOIN dprtmnt_table dt
ON dct.dprtmnt_id = dt.dprtmnt_id

LEFT JOIN student_status_table sts
ON sts.id = (
    SELECT MAX(sst.id)
    FROM student_status_table sst
    WHERE sst.student_number = snt.student_number
)

LEFT JOIN year_level_table ylt
ON sts.year_level_id = ylt.year_level_id

WHERE snt.student_number = ?
LIMIT 1
`;

    const [rows] =
      await db3.query(sql, [
        student_number
      ]);

    res.json(rows);

  } catch (error) {
    console.error("FULL ERROR:", error);
    console.error("RESPONSE:", error.response?.data);

    res.status(500).json({
      success: false
    });
  }
});



router.post("/notify_student", async (req, res) => {
  const { person_id, email, password } = req.body;

  let conn;

  try {
    if (!person_id || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    conn = await db3.getConnection();

    const [student] = await conn.query(
      `
  SELECT 
    pt.person_id,
    pt.first_name,
    pt.last_name,
    pt.middle_name,
    snt.student_number,
    dt.dprtmnt_id
  FROM person_table pt
  LEFT JOIN student_numbering_table snt
    ON pt.person_id = snt.person_id
  LEFT JOIN student_curriculum_table sct
    ON snt.id = sct.student_numbering_id
  LEFT JOIN curriculum_table ct
    ON sct.curriculum_id = ct.curriculum_id
  LEFT JOIN dprtmnt_curriculum_table dct
    ON ct.curriculum_id = dct.curriculum_id
  LEFT JOIN dprtmnt_table dt
    ON dct.dprtmnt_id = dt.dprtmnt_id
  WHERE pt.person_id = ?
  `,
      [person_id]
    );

    if (student.length === 0) {
      return res.json({
        success: false,
        message: "Student not found"
      });
    }

    const dprtmnt_id = student[0].dprtmnt_id;

    if (!person_id || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // ✅ hash frontend password
    const hashedPassword = await bcrypt.hash(password, 10);


    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE person_table
      SET emailAddress = ?
      WHERE person_id = ?
      `,
      [email, person_id]
    );

    const [existingUser] =
      await conn.query(
        `
        SELECT id 
        FROM user_accounts
        WHERE person_id = ?
        `,
        [person_id]
      );

    if (existingUser.length === 0) {
      await conn.query(
        `
        INSERT INTO user_accounts (
          person_id,
          employee_id,
          last_name,
          middle_name,
          first_name,
          email,
          password,
          access_level,
          status,
          dprtmnt_id,
          require_otp,
          role
        )
        VALUES (
          ?,
          NULL,
          NULL,
          NULL,
          NULL,
          ?,
          ?,
          NULL,
          1,
          ?,
          0,
          'student'
        )
        `,
        [
          person_id,
          email,
          hashedPassword,
          dprtmnt_id
        ]
      );
    }

    const frontendUrl = process.env.FRONTEND_URL;

    // Get company settings
    const [companyRows] = await db.query(`
  SELECT company_name, short_term
  FROM company_settings
  LIMIT 1
`);

    const company_name =
      companyRows.length > 0
        ? companyRows[0].company_name
        : "Company";

    const short_term =
      companyRows.length > 0
        ? companyRows[0].short_term
        : "System";

    const emailSubject =
      `${short_term} - Student Account Creation`;

    await transporter.sendMail({
      from: `"${short_term} - Student Account Creation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailSubject,
      html: `
    <h3>${company_name} Student Portal Account</h3>

    <p>Hello <b>${student[0].last_name}, ${student[0].first_name} ${student[0].middle_name}</b>,</p>

    <p>
      Your account has been successfully created.
      You may now log in to the system.
    </p>

    <h4>Login Credentials</h4>

    <p>
      <b>Username:</b> ${email} / ${student[0].student_number || "N/A"}<br/>
   <b>Password:</b> ${password}
    </p>

    <p style="color:red;">
      Please change your password after your first login.
    </p>

    <p>
      Login Link:<br/>
      <a href="${frontendUrl}/login">
        ${frontendUrl}/login
      </a>
    </p>
  `
    });


    await conn.commit();

    res.json({
      success: true,
      message: "Student notified successfully"
    });
  } catch (error) {
    if (conn) await conn.rollback();

    console.error("EMAIL ERROR:", error.message);
    console.error("FULL ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;

