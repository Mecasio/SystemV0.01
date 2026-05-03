const express = require("express");
const { db, db3 } = require("../database/database");

const router = express.Router();

router.get("/api/applicant-stats", async (req, res) => {
  try {
    const { gender, department_id, program_id, school_year, semester } =
      req.query;

    // ---------------------------
    // Build dynamic WHERE filters
    // ---------------------------
    let where = "WHERE 1=1";
    const params = [];

    if (gender !== undefined && gender !== "all") {
      where += " AND pt.gender = ?";
      params.push(gender);
    }

    if (program_id) {
      where += " AND pt.program = ?";
      params.push(program_id);
    }

    if (department_id) {
      where += `
        AND EXISTS (
          SELECT 1 FROM program_table p
          JOIN dprtmnt_curriculum_table dct
            ON p.curriculum_id = dct.curriculum_id
          WHERE p.curriculum_id = pt.program
            AND dct.dprtmnt_id = ?
        )
      `;
      params.push(department_id);
    }

    if (school_year) {
      where += " AND YEAR(pt.created_at) = ?";
      params.push(school_year);
    }

    if (semester) {
      where += " AND pt.middle_code = ?";
      params.push(semester);
    }

    // ---------------------------
    // Fetch Total
    // ---------------------------
    const [totalRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM person_table pt
      ${where}
    `,
      params,
    );

    // ---------------------------
    // Fetch Gender Counts
    // ---------------------------
    const [rawGender] = await db.query(
      `
      SELECT pt.gender, COUNT(*) AS total
      FROM person_table pt
      ${where}
      GROUP BY pt.gender
    `,
      params,
    );

    const genderCounts = rawGender.map((row) => ({
      gender:
        row.gender === 0 ? "Male" : row.gender === 1 ? "Female" : "Unknown",
      total: row.total,
    }));

    // ---------------------------
    // Terms Of Agreement
    // ---------------------------
    const [agreementRows] = await db.query(
      `
      SELECT COALESCE(pt.termsOfAgreement,0) AS status, COUNT(*) AS total
      FROM person_table pt
      ${where}
      GROUP BY COALESCE(pt.termsOfAgreement,0)
    `,
      params,
    );

    res.json({
      totalApplicants: totalRows[0].total,
      genderCounts,
      statusCounts: agreementRows,
    });
  } catch (err) {
    console.error("ERROR /api/applicant-stats:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.get("/api/applicants-per-month", async (req, res) => {
  try {
    const sql = `
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS total
      FROM person_table
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `;

    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (error) {
    console.error("Error in /api/applicants-per-month:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// router.get("/api/applicants-per-month", async (req, res) => {
//   try {
//     const [rows] = await db.query(`
//       WITH months AS (
//         SELECT DATE_FORMAT(MAKEDATE(YEAR(CURDATE()), 1) + INTERVAL (n-1) MONTH, '%Y-%m') AS month
//         FROM (
//           SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
//           UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
//           UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
//         ) numbers
//       )
//       SELECT
//         m.month,
//         COALESCE(COUNT(p.person_id), 0) AS total
//       FROM months m
//       LEFT JOIN admission.person_table p
//         ON DATE_FORMAT(p.created_at, '%Y-%m') = m.month
//         AND YEAR(p.created_at) = YEAR(CURDATE())
//       GROUP BY m.month
//       ORDER BY m.month ASC;
//     `);

//     res.json(rows);
//   } catch (err) {
//     console.error("âŒ Error fetching applicants per month:", err);
//     res.status(500).json({ error: "Failed to fetch applicants per month" });
//   }
// });

router.get("/api/applicants/total", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM person_table
      WHERE termsOfAgreement = 1
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/week", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM person_table
      WHERE termsOfAgreement = 1
        AND YEARWEEK(created_at, 1) = YEARWEEK(NOW(), 1)
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/month", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM person_table
      WHERE termsOfAgreement = 1
        AND YEAR(created_at) = YEAR(NOW())
        AND MONTH(created_at) = MONTH(NOW())
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/year", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM person_table
      WHERE termsOfAgreement = 1
        AND YEAR(created_at) = YEAR(NOW())
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/department/total", async (req, res) => {
  const { department_id } = req.query;

  try {
    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM person_table pt
      JOIN program_table prog
        ON pt.program = prog.curriculum_id
      JOIN dprtmnt_curriculum_table dct
        ON prog.curriculum_id = dct.curriculum_id
      WHERE pt.termsOfAgreement = 1
        AND dct.dprtmnt_id = ?
    `,
      [department_id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/department/week", async (req, res) => {
  const { department_id } = req.query;

  try {
    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM person_table pt
      JOIN program_table prog
        ON pt.program = prog.curriculum_id
      JOIN dprtmnt_curriculum_table dct
        ON prog.curriculum_id = dct.curriculum_id
      WHERE pt.termsOfAgreement = 1
        AND dct.dprtmnt_id = ?
        AND YEARWEEK(pt.created_at, 1) = YEARWEEK(NOW(), 1)
    `,
      [department_id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/department/month", async (req, res) => {
  const { department_id } = req.query;

  try {
    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM person_table pt
      JOIN program_table prog
        ON pt.program = prog.curriculum_id
      JOIN dprtmnt_curriculum_table dct
        ON prog.curriculum_id = dct.curriculum_id
      WHERE pt.termsOfAgreement = 1
        AND dct.dprtmnt_id = ?
        AND YEAR(pt.created_at) = YEAR(NOW())
        AND MONTH(pt.created_at) = MONTH(NOW())
    `,
      [department_id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/department/year", async (req, res) => {
  const { department_id } = req.query;

  try {
    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM person_table pt
      JOIN program_table prog
        ON pt.program = prog.curriculum_id
      JOIN dprtmnt_curriculum_table dct
        ON prog.curriculum_id = dct.curriculum_id
      WHERE pt.termsOfAgreement = 1
        AND dct.dprtmnt_id = ?
        AND YEAR(pt.created_at) = YEAR(NOW())
    `,
      [department_id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/applicants/program/stats", async (req, res) => {
  const { program_id } = req.query;

  if (!program_id) {
    return res.status(400).json({ error: "Missing program_id" });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        COUNT(pt.person_id) AS total_applicants,
        SUM(CASE WHEN pt.created_at BETWEEN DATE_SUB(NOW(), INTERVAL 7 DAY) AND NOW() THEN 1 ELSE 0 END) AS applicants_week,
        SUM(CASE WHEN pt.created_at BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND NOW() THEN 1 ELSE 0 END) AS applicants_month
      FROM admission.person_status_table pst
      INNER JOIN admission.person_table pt ON pst.person_id = pt.person_id
      INNER JOIN enrollment.curriculum_table ct ON pt.program = ct.curriculum_id
      WHERE ct.program_id = ?
    `,
      [program_id],
    );

    res.json(
      rows[0] || {
        total_applicants: 0,
        applicants_week: 0,
        applicants_month: 0,
      },
    );
  } catch (err) {
    console.error("Program stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/api/applicants/filter", async (req, res) => {
  let { department_id, program_code } = req.query;

  // Normalize empty strings to null
  if (!department_id) department_id = null;
  if (!program_code) program_code = null;

  try {
    const [rows] = await db.query(
      `
      SELECT
        p.*,
        ct.curriculum_id,
        pt.program_code,
        pt.program_description,
        dc.dprtmnt_id
      FROM person_table p
      LEFT JOIN db3.curriculum_table ct
        ON p.program = ct.curriculum_id
      LEFT JOIN db3.program_table pt
        ON ct.program_id = pt.program_id
      LEFT JOIN db3.dprtmnt_curriculum_table dc
        ON ct.curriculum_id = dc.curriculum_id
      WHERE
        (${department_id} IS NULL OR dc.dprtmnt_id = ?)
        AND (${program_code} IS NULL OR pt.program_code = ?)
    `,
      [department_id, program_code],
    );

    res.json(rows);
  } catch (err) {
    console.error("Filter applicants failed:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/exam/completed-count", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS total FROM exam_results`,
    );
    console.log("Exam count from DB:", rows[0].total); // Debug

    res.json({ total: rows[0].total });
  } catch (err) {
    console.error("Error fetching exam count:", err);
    res.status(500).send("Server error");
  }
});

router.get("/api/ecat-summary", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        SUM(CASE WHEN pt.termsOfAgreement = 1 THEN 1 ELSE 0 END) AS total_applied,
        SUM(CASE WHEN ea.schedule_id IS NOT NULL THEN 1 ELSE 0 END) AS total_scheduled,
        SUM(CASE WHEN ea.schedule_id IS NULL THEN 1 ELSE 0 END) AS total_pending,
        SUM(CASE WHEN ae.status IN ('PASSED','FAILED') THEN 1 ELSE 0 END) AS total_finished
      FROM exam_applicants AS ea
      LEFT JOIN applicant_numbering_table AS ant ON ea.applicant_id = ant.applicant_number
      LEFT JOIN person_table AS pt ON ant.person_id = pt.person_id
      LEFT JOIN person_status_table AS pst ON pt.person_id = pst.person_id
      LEFT JOIN exam_results AS ae ON pt.person_id = ae.person_id
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get_enrollment_statistic", async (req, res) => {
  try {
    const { year } = req.query; // Get year from query string

    let query = `
      SELECT
        SUM(CASE WHEN academicProgram = 2 THEN 1 ELSE 0 END) AS Techvoc,
        SUM(CASE WHEN academicProgram = 1 THEN 1 ELSE 0 END) AS Graduate,
        SUM(CASE WHEN academicProgram = 0 THEN 1 ELSE 0 END) AS Undergraduate,
        SUM(CASE WHEN classifiedAs = 'Returnee' THEN 1 ELSE 0 END) AS Returnee,
        SUM(CASE WHEN classifiedAs = 'Shiftee' THEN 1 ELSE 0 END) AS Shiftee,
        SUM(CASE WHEN classifiedAs = 'Foreign Student' THEN 1 ELSE 0 END) AS ForeignStudent,
        SUM(CASE WHEN classifiedAs = 'Transferee' THEN 1 ELSE 0 END) AS Transferee
      FROM person_table 
    `;

    const params = [];

    if (year) {
      query += " WHERE YEAR(created_at) = ?";
      params.push(year);
    }

    const [rows] = await db3.execute(query, params);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// backend: server.js or routes file
router.get("/api/get-scheduled-applicants", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT applicant_id, schedule_id, email_sent
      FROM exam_applicants
      WHERE schedule_id IS NOT NULL
        AND email_sent = 1
    `);

    console.log("Scheduled applicants:", rows); // should log 1 row
    res.json({ total: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/get_enrollment_statistic", async (req, res) => {
  try {
    const { year } = req.query; // Get year from query string

    let query = `
      SELECT
        SUM(CASE WHEN academicProgram = 2 THEN 1 ELSE 0 END) AS Techvoc,
        SUM(CASE WHEN academicProgram = 1 THEN 1 ELSE 0 END) AS Graduate,
        SUM(CASE WHEN academicProgram = 0 THEN 1 ELSE 0 END) AS Undergraduate,
        SUM(CASE WHEN classifiedAs = 'Returnee' THEN 1 ELSE 0 END) AS Returnee,
        SUM(CASE WHEN classifiedAs = 'Shiftee' THEN 1 ELSE 0 END) AS Shiftee,
        SUM(CASE WHEN classifiedAs = 'Foreign Student' THEN 1 ELSE 0 END) AS ForeignStudent,
        SUM(CASE WHEN classifiedAs = 'Transferee' THEN 1 ELSE 0 END) AS Transferee
      FROM person_table 
    `;

    const params = [];

    if (year) {
      query += " WHERE YEAR(created_at) = ?";
      params.push(year);
    }

    const [rows] = await db3.execute(query, params);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get(
  "/get_enrollment_statistic/college/:yearDescription/:userDep",
  async (req, res) => {
    try {
      const { yearDescription, userDep } = req.params;

      if (!yearDescription || !userDep) {
        return res
          .status(400)
          .json({ error: "Missing required parameters: year, dprtmnt_id" });
      }

      const query = `
      SELECT
        SUM(CASE WHEN academicProgram = 2 THEN 1 ELSE 0 END) AS Techvoc,
        SUM(CASE WHEN academicProgram = 1 THEN 1 ELSE 0 END) AS Graduate,
        SUM(CASE WHEN academicProgram = 0 THEN 1 ELSE 0 END) AS Undergraduate,
        SUM(CASE WHEN classifiedAs = 'Returnee' THEN 1 ELSE 0 END) AS Returnee,
        SUM(CASE WHEN classifiedAs = 'Shiftee' THEN 1 ELSE 0 END) AS Shiftee,
        SUM(CASE WHEN classifiedAs = 'Foreign Student' THEN 1 ELSE 0 END) AS ForeignStudent,
        SUM(CASE WHEN classifiedAs = 'Transferee' THEN 1 ELSE 0 END) AS Transferee
      FROM person_table 
      INNER JOIN dprtmnt_curriculum_table 
        ON person_table.program = dprtmnt_curriculum_table.curriculum_id
      WHERE dprtmnt_curriculum_table.dprtmnt_id = ? AND YEAR(person_table.created_at) = ?
    `;

      const [rows] = await db3.query(query, [userDep, yearDescription]);

      res.json(rows[0]);
      console.log("DATA: ", rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

router.get("/api/enrolled-count", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT COUNT(*) AS total FROM person_table WHERE classifiedAs = 'Freshman (First Year)' OR classifiedAs = 'Transferee' OR classifiedAs = 'Returnee'",
    );
    res.json({ total: rows[0].total });
  } catch (error) {
    console.error("Error fetching enrolled count:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// âœ… Count how many registrar roles exist
router.get("/api/registrar_count", async (req, res) => {
  try {
    const [rows] = await db3.query(
      "SELECT COUNT(*) AS count FROM user_accounts WHERE role = 'registrar'",
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error("Error fetching registrar count:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching registrar count" });
  }
});

router.get("/api/course_count/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db3.execute(
      `
      SELECT
        COUNT(es.course_id) AS initial_course,
        CASE
          WHEN SUM(CASE WHEN es.fe_status = 1 THEN 1 ELSE 0 END) = COUNT(es.course_id)
          THEN SUM(CASE WHEN es.en_remarks = 1 THEN 1 ELSE 0 END)
          ELSE 0
        END AS passed_course,
        CASE
          WHEN SUM(CASE WHEN es.fe_status = 1 THEN 1 ELSE 0 END) = COUNT(es.course_id)
          THEN SUM(CASE WHEN es.en_remarks = 2 THEN 1 ELSE 0 END)
          ELSE 0
        END AS failed_course,
        CASE
          WHEN SUM(CASE WHEN es.fe_status = 1 THEN 1 ELSE 0 END) = COUNT(es.course_id)
          THEN SUM(CASE WHEN es.en_remarks = 3 THEN 1 ELSE 0 END)
          ELSE 0
        END AS inc_course
      FROM enrolled_subject AS es
      JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
      JOIN person_table AS pt ON snt.person_id = pt.person_id
      WHERE pt.person_id = ?
    `,
      [id],
    );

    res.json(rows[0] || { initial_course: 0 });
    console.log(rows);
  } catch (error) {
    console.error("Error fetching course count:", error);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/api/accepted-students-count", async (req, res) => {
  try {
    const [rows] = await db3.execute(`
      SELECT COUNT(*) AS total
      FROM person_table p
      JOIN person_status_table ps ON p.person_id = ps.person_id
      WHERE ps.student_registration_status = 1
    `);

    res.json(rows[0]); // { total: 25 }
  } catch (err) {
    console.error("Error fetching accepted students count:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router