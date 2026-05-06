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



// ─── Student: Password Reset Reminder ───────────────────────────────────────
router.post("/notify_student", async (req, res) => {
  const { person_id, email, password } = req.body;

  let conn;

  try {
    if (!person_id || !email || !password) {
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
        snt.student_number
      FROM person_table pt
      LEFT JOIN student_numbering_table snt
        ON pt.person_id = snt.person_id
      WHERE pt.person_id = ?
      `,
      [person_id]
    );

    if (student.length === 0) {
      return res.json({ success: false, message: "Student not found" });
    }

    const [companyRows] = await db.query(`
      SELECT company_name, short_term FROM company_settings LIMIT 1
    `);

    const company_name = companyRows[0]?.company_name || "Company";
    const short_term   = companyRows[0]?.short_term   || "System";
    const frontendUrl  = process.env.FRONTEND_URL;

    const { first_name, last_name, middle_name, student_number } = student[0];
    const fullName = `${last_name}, ${first_name} ${middle_name || ""}`.trim();

    await transporter.sendMail({
      from:    `"${short_term} — Password Security" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: `${short_term} — Action Required: Change Your Password`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #222;">
          <h2 style="margin-bottom: 4px;">${company_name} Student Portal</h2>
          <p style="color: #777; margin-top: 0; font-size: 13px;">Password change reminder</p>

          <p>Hello <strong>${fullName}</strong>,</p>

          <p style="color: #555;">
            This is a reminder that your account is currently using a
            <strong style="color: #222;">temporary password</strong>.
            For the security of your account, you are required to update
            your password as soon as possible.
          </p>

          <table style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px;
                         width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px 16px; font-weight: bold; font-size: 14px;"
                  colspan="2">Account details</td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; width: 40%; font-size: 13px;">Username</td>
              <td style="padding: 6px 16px; font-size: 13px;">
                ${email} / ${student_number || "N/A"}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; font-size: 13px;">Temporary password</td>
              <td style="padding: 6px 16px; font-family: monospace; font-size: 13px;">${password}</td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; font-size: 13px;">Account type</td>
              <td style="padding: 6px 16px; font-size: 13px;">Student</td>
            </tr>
            <tr>
              <td style="padding: 6px 16px; color: #777; font-size: 13px;">Status</td>
              <td style="padding: 6px 16px; font-size: 13px;">
                <span style="background: #fff8e1; color: #856404; font-size: 12px;
                              padding: 2px 10px; border-radius: 4px;">
                  Requires password change
                </span>
              </td>
            </tr>
          </table>

          <p style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">
            Steps to change your password
          </p>
          <ol style="color: #555; font-size: 13px; line-height: 2;">
            <li>Go to the login page using the link below</li>
            <li>Log in with your username and temporary password</li>
            <li>You will be prompted to set a new password immediately</li>
            <li>Choose a strong password (min. 8 characters, with letters, numbers, and symbols)</li>
          </ol>

          <div style="border-left: 3px solid #dc3545; padding-left: 12px; margin: 16px 0;">
            <p style="color: #dc3545; font-size: 13px; margin: 0; line-height: 1.6;">
              Do not share your password with anyone. This system will never ask
              for your password via email or phone.
            </p>
          </div>

          <p style="font-size: 13px;">
            Login link:<br/>
            <a href="${frontendUrl}/login" style="color: #0d6efd;">${frontendUrl}/login</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #aaa;">
            If you did not request this or believe this was sent in error, please
            contact the system administrator immediately. Do not reply to this email.
          </p>
        </div>
      `
    });

    res.json({ success: true, message: "Student password reset reminder sent" });

  } catch (error) {
    console.error("EMAIL ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;

