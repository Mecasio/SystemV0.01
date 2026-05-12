const express = require("express");
const { db, db3 } = require("../database/database");

const router = express.Router();

router.get("/payment-status/:studentNumber", async (req, res) => {
  const { studentNumber } = req.params;

  try {
    const [activeRows] = await db3.query(
      "SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1",
    );
    const activeSchoolYearId = activeRows[0]?.id;

    if (!activeSchoolYearId) {
      return res.json({
        success: true,
        saved_unifast: false,
        saved_matriculation: false,
      });
    }

    const [unifastRows] = await db3.query(
      "SELECT status FROM unifast WHERE student_number = ? AND status = 1 AND active_school_year_id = ? LIMIT 1",
      [studentNumber, activeSchoolYearId],
    );
    const [matricRows] = await db3.query(
      "SELECT status FROM matriculation WHERE student_number = ? AND status = 1 AND active_school_year_id = ? LIMIT 1",
      [studentNumber, activeSchoolYearId],
    );

    res.json({
      success: true,
      saved_unifast: unifastRows.length > 0,
      saved_matriculation: matricRows.length > 0,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ message: "Server error while fetching status" });
  }
});

router.post("/save_to_unifast", async (req, res) => {
  const {
    campus_name,
    student_number,
    learner_reference_number,
    last_name,
    given_name,
    middle_initial,
    degree_program,
    year_level,
    sex,
    email_address,
    phone_number,
    laboratory_units,
    computer_units,
    academic_units_enrolled,
    academic_units_nstp_enrolled,
    tuition_fees,
    nstp_fees,
    athletic_fees,
    computer_fees,
    cultural_fees,
    development_fees,
    guidance_fees,
    laboratory_fees,
    library_fees,
    medical_and_dental_fees,
    registration_fees,
    school_id_fees,
    total_tosf,
    remark,
    active_school_year_id,
    status,
  } = req.body;
  
  try {
    if (!student_number || !String(student_number).trim()) {
      return res.status(400).json({
        message: "Student number is required before saving to UNIFAST.",
      });
    }

    const statusValue = Number.isFinite(Number(status)) ? Number(status) : 1;
    const [unifastScholarships] = await db3.query(
      `SELECT id
       FROM scholarship_type
       WHERE UPPER(TRIM(scholarship_name)) LIKE '%UNIFAST%'
         AND scholarship_status = 1
       ORDER BY id ASC
       LIMIT 1`,
    );

    const unifastScholarshipId = unifastScholarships?.[0]?.id ?? null;
    if (!unifastScholarshipId) {
      return res.status(400).json({
        message:
          "Cannot save to UNIFAST because no active scholarship type containing 'UNIFAST' was found.",
      });
    }

    const query = `
      INSERT INTO unifast (
        campus_name, student_number, learner_reference_number, last_name, given_name, middle_initial,
        degree_program, year_level, sex, email_address, phone_number, scholarship_id, laboratory_units, computer_units,
        academic_units_enrolled, academic_units_nstp_enrolled, tuition_fees, nstp_fees, athletic_fees, computer_fees,
        cultural_fees, development_fees, guidance_fees, laboratory_fees, library_fees,
        medical_and_dental_fees, registration_fees, school_id_fees, total_tosf, remark, active_school_year_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      campus_name,
      student_number,
      learner_reference_number,
      last_name,
      given_name,
      middle_initial,
      degree_program,
      year_level,
      sex,
      email_address,
      phone_number,
      unifastScholarshipId,
      laboratory_units,
      computer_units,
      academic_units_enrolled,
      academic_units_nstp_enrolled,
      tuition_fees,
      nstp_fees,
      athletic_fees,
      computer_fees,
      cultural_fees,
      development_fees,
      guidance_fees,
      laboratory_fees,
      library_fees,
      medical_and_dental_fees,
      registration_fees,
      school_id_fees,
      total_tosf,
      remark,
      active_school_year_id,
      statusValue,
    ];

    const [result] = await db3.query(query, values);
    const unifast_id = result.insertId;

    res.json({
      success: true,
      unifast_id,
      message: "Data successfully saved to UNIFAST",
    });
  } catch (error) {
    console.error("Error saving to UNIFAST:", error);
    res.status(500).json({ message: "Server error while saving data" });
  }
});

router.post("/save_to_matriculation", async (req, res) => {
  const {
    campus_name,
    student_number,
    learner_reference_number,
    last_name,
    given_name,
    middle_initial,
    degree_program,
    year_level,
    sex,
    email_address,
    phone_number,
    laboratory_units,
    computer_units,
    academic_units_enrolled,
    academic_units_nstp_enrolled,
    tuition_fees,
    nstp_fees,
    athletic_fees,
    computer_fees,
    cultural_fees,
    development_fees,
    guidance_fees,
    laboratory_fees,
    library_fees,
    medical_and_dental_fees,
    registration_fees,
    school_id_fees,
    total_misc,
    total_tosf,
    scholarship_id,
    remark,
    matriculation_remark,
    active_school_year_id,
    status,
  } = req.body;

  try {
    if (!student_number || !String(student_number).trim()) {
      return res.status(400).json({
        message: "Student number is required before saving to MATRICULATION.",
      });
    }

    const statusValue = Number.isFinite(Number(status)) ? Number(status) : 1;
    const query = `
      INSERT INTO matriculation (
        campus_name, student_number, learner_reference_number, last_name, given_name, middle_initial,
        degree_program, year_level, sex, email_address, phone_number, laboratory_units, computer_units,
        academic_units_enrolled, academic_units_nstp_enrolled, tuition_fees, nstp_fees, athletic_fees, computer_fees,
        cultural_fees, development_fees, guidance_fees, laboratory_fees, library_fees,
        medical_and_dental_fees, registration_fees, school_id_fees, total_misc, total_tosf, scholarship_id, remark, matriculation_remark, active_school_year_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      campus_name,
      student_number,
      learner_reference_number,
      last_name,
      given_name,
      middle_initial,
      degree_program,
      year_level,
      sex,
      email_address,
      phone_number,
      laboratory_units,
      computer_units,
      academic_units_enrolled,
      academic_units_nstp_enrolled,
      tuition_fees,
      nstp_fees,
      athletic_fees,
      computer_fees,
      cultural_fees,
      development_fees,
      guidance_fees,
      laboratory_fees,
      library_fees,
      medical_and_dental_fees,
      registration_fees,
      school_id_fees,
      total_misc,
      total_tosf,
      scholarship_id ?? null,
      remark,
      matriculation_remark || null,
      active_school_year_id,
      statusValue,
    ];

    const [result] = await db3.query(query, values);

    const matriculation_id = result.insertId;

    res.json({
      success: true,
      matriculation_id,
      message: "Data successfully saved to MATRICULATION",
    });
  } catch (error) {
    console.error("Error saving to MATRICULATION:", error);
    res.status(500).json({ message: "Server error while saving data" });
  }
});

module.exports = router
