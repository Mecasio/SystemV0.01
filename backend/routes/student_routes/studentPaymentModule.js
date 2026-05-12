const express = require("express");
const router = express.Router();
const { db, db3 } = require("../database/database");

const isNstpRelatedCourse = (subject) => {
    const code = String(subject?.course_code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const description = String(subject?.course_description || "").toUpperCase();

    return (
        /^NSTP/.test(code) ||
        /^NST/.test(code) ||
        code.includes("CWTS") ||
        code.includes("CTWS") ||
        code.includes("LTS") ||
        code.includes("MTS") ||
        description.includes("NATIONAL SERVICE TRAINING") ||
        description.includes("CIVIC WELFARE TRAINING") ||
        description.includes("LITERACY TRAINING SERVICE") ||
        description.includes("RESERVE OFFICERS TRAINING")
    );
};

router.get("/api/student-assessment/:person_id", async (req, res) => {

    const { person_id } = req.params;

    try {
        console.log("Person ID: ", person_id);

        const [studentRows] = await db3.query(`
            SELECT
                p.person_id,
                sn.student_number,
                p.first_name,
                p.middle_name,
                p.last_name
            FROM student_numbering_table sn
            LEFT JOIN person_table p ON sn.person_id = p.person_id
            WHERE sn.person_id = ?
        `, [person_id]);

        const student = studentRows?.[0];

        if (!student) {
            return res.status(404).json({ success: false, error: "Student not found" });
        }

        //////////////////////////////////////////////////////////
        // ALL STATUS ROWS
        //////////////////////////////////////////////////////////
        const [statusRows] = await db3.query(`
            SELECT
                ss.*,
                yt.year_description,
                sem.semester_id,
                sem.semester_description,
                yl.year_level_description
            FROM student_status_table ss
            LEFT JOIN year_level_table yl ON ss.year_level_id = yl.year_level_id
            LEFT JOIN active_school_year_table sy ON ss.active_school_year_id = sy.id
            LEFT JOIN semester_table sem ON sy.semester_id = sem.semester_id
            LEFT JOIN year_table yt ON sy.year_id = yt.year_id
            WHERE ss.student_number = ?
            ORDER BY ss.id ASC
        `, [student.student_number]);

        if (!statusRows || statusRows.length === 0) {
            return res.status(404).json({ success: false, error: "Student status not found" });
        }

        //////////////////////////////////////////////////////////
        // FETCH TOSF ONCE
        //////////////////////////////////////////////////////////
        const [tosfRows] = await db3.query(`SELECT * FROM tosf LIMIT 1`);
        const tosf = tosfRows[0] || {};

        //////////////////////////////////////////////////////////
        // LOOP ALL STATUS ROWS
        //////////////////////////////////////////////////////////
        const rows = await Promise.all(
            statusRows.map(async (s) => {
                const semesterId = s.semester_id || 1;
                const [unifastRows] = await db3.query(
                    `SELECT id, total_tosf, scholarship_id, remark, active_school_year_id
                     FROM unifast
                     WHERE student_number = ?
                       AND active_school_year_id = ?
                       AND status = 1
                     ORDER BY id DESC
                     LIMIT 1`,
                    [student.student_number, s.active_school_year_id]
                );

                const [matriculationRows] = await db3.query(
                    `SELECT
                        m.id,
                        m.total_tosf,
                        m.payment,
                        m.balance,
                        m.scholarship_id,
                        m.matriculation_remark,
                        m.remark,
                        st.scholarship_name
                     FROM matriculation m
                     LEFT JOIN scholarship_type st ON st.id = m.scholarship_id
                     WHERE m.student_number = ?
                       AND m.active_school_year_id = ?
                       AND m.status = 1
                     ORDER BY m.id DESC
                     LIMIT 1`,
                    [student.student_number, s.active_school_year_id]
                );

                const unifastPayment = unifastRows[0] || null;
                const matriculationPayment = unifastPayment ? null : (matriculationRows[0] || null);

                const [subjects] = await db3.query(`
                    SELECT
                        c.course_id,
                        c.course_code,
                        c.course_description,
                        c.course_unit,
                        pt.lec_fee,
                        pt.lab_fee,
                        pt.is_nstp,
                        pt.iscomputer_lab,
                        pt.islaboratory_fee
                    FROM program_tagging_table pt
                    INNER JOIN course_table c ON pt.course_id = c.course_id
                    WHERE pt.curriculum_id = ?
                      AND pt.year_level_id = ?
                      AND pt.semester_id = ?
                      AND c.course_id IS NOT NULL
                      AND TRIM(COALESCE(c.course_code, '')) <> ''
                    ORDER BY c.course_code ASC
                `, [s.active_curriculum, s.year_level_id, semesterId]);

                //////////////////////////////////////////////////////////
                // TUITION FEE = lec_fee + lab_fee (matches program tagging)
                //////////////////////////////////////////////////////////
                let tuitionFee = 0;

                subjects.forEach((subject) => {
                    tuitionFee += Number(subject.lec_fee || 0);
                    tuitionFee += Number(subject.lab_fee || 0);
                });

                //////////////////////////////////////////////////////////
                // NSTP FEE = tosf.nstp_fees (matches program tagging)
                //////////////////////////////////////////////////////////
                const hasNSTP = subjects.some((subject) =>
                    Number(subject.is_nstp) === 1 || isNstpRelatedCourse(subject)
                );
                const nstpFee = hasNSTP ? Number(tosf.nstp_fees || 0) : 0;

                //////////////////////////////////////////////////////////
                // COMPUTER FEE = tosf.computer_fees only if has computer lab
                //////////////////////////////////////////////////////////
                const hasComputerLab = subjects.some(s => Number(s.iscomputer_lab) === 1);
                const computerFee = hasComputerLab ? Number(tosf.computer_fees || 0) : 0;

                //////////////////////////////////////////////////////////
                // SCHOOL ID FEE = only for 1st year, 1st semester
                //////////////////////////////////////////////////////////
                const isFirstYearFirstSem =
                    Number(s.year_level_id) === 1 &&
                    Number(semesterId) === 1;
                const schoolIdFee = isFirstYearFirstSem ? Number(tosf.school_id_fees || 0) : 0;

                //////////////////////////////////////////////////////////
                // MISCELLANEOUS FEE = BASE TOSF only
                // (excludes nstp_fees, computer_fees, school_id_fees, laboratory_fees)
                // matches computeMiscFee() in CurriculumCourseMap
                //////////////////////////////////////////////////////////
                const miscellaneousFee =
                    Number(tosf.athletic_fee          || 0) +
                    Number(tosf.cultural_fee          || 0) +
                    Number(tosf.developmental_fee     || 0) +
                    Number(tosf.guidance_fee          || 0) +
                    Number(tosf.library_fee           || 0) +
                    Number(tosf.medical_and_dental_fee|| 0) +
                    Number(tosf.registration_fee      || 0) +
                    schoolIdFee                             +
                    computerFee;

                const miscellaneousBreakdown = [
                    { label: "Athletic Fee", amount: Number(tosf.athletic_fee || 0) },
                    { label: "Cultural Fee", amount: Number(tosf.cultural_fee || 0) },
                    { label: "Developmental Fee", amount: Number(tosf.developmental_fee || 0) },
                    { label: "Guidance Fee", amount: Number(tosf.guidance_fee || 0) },
                    { label: "Library Fee", amount: Number(tosf.library_fee || 0) },
                    { label: "Medical & Dental Fee", amount: Number(tosf.medical_and_dental_fee || 0) },
                    { label: "Registration Fee", amount: Number(tosf.registration_fee || 0) },
                    { label: "School ID Fee", amount: schoolIdFee },
                    { label: "Computer Fee", amount: computerFee },
                ].filter((fee) => Number(fee.amount) > 0);

                //////////////////////////////////////////////////////////
                // TOTALS
                //////////////////////////////////////////////////////////
                const totalTuition = tuitionFee + nstpFee;
                const grandTotal   = totalTuition + miscellaneousFee;
                const storedAssessment = Number(
                    matriculationPayment?.total_tosf ??
                    unifastPayment?.total_tosf ??
                    grandTotal
                );
                const storedPayment = unifastPayment
                    ? storedAssessment
                    : Number(matriculationPayment?.payment || 0);
                const discountAmount = Math.max(grandTotal - storedAssessment, 0);
                const storedBalance = unifastPayment
                    ? 0
                    : Math.max(storedAssessment - storedPayment, 0);
                const paymentType = unifastPayment
                    ? "UNIFAST"
                    : matriculationPayment
                        ? "Matriculation"
                        : "";

                console.log("Tuition Fee:", tuitionFee);
                console.log("NSTP Fee:", nstpFee);
                console.log("Computer Fee:", computerFee);
                console.log("School ID Fee:", schoolIdFee);
                console.log("Misc Fee:", miscellaneousFee);
                console.log("Grand Total:", grandTotal);

                return {
                    active_school_year_id: s.active_school_year_id,
                    curriculum_id: s.active_curriculum,
                    year_level_id: s.year_level_id,
                    semester_id: semesterId,
                    school_year : s.year_description        || "",
                    semester    : s.semester_description    || "First Semester",
                    year_level  : s.year_level_description  || "",
                    payment_type: paymentType,
                    payment_status: unifastPayment
                        ? "Fully Paid"
                        : storedBalance > 0
                            ? "With Balance"
                            : matriculationPayment
                                ? "Fully Paid"
                                : "No Payment Record",
                    scholarship: unifastPayment
                        ? "UNIFAST"
                        : matriculationPayment?.scholarship_name ||
                          matriculationPayment?.matriculation_remark ||
                          "",
                    payment: storedPayment,
                    balance: storedBalance,
                    assessment: storedAssessment,
                    subjects,
                    fees: {
                        tuitionFee,
                        nstpFee,
                        computerFee,
                        schoolIdFee,
                        miscellaneousFee,
                        miscellaneousBreakdown,
                        totalTuition,
                        originalGrandTotal: grandTotal,
                        discountAmount,
                        grandTotal: storedAssessment,
                    },
                };
            })
        );

        //////////////////////////////////////////////////////////
        // RESPONSE
        //////////////////////////////////////////////////////////
        return res.json({
            success: true,
            student,
            rows,
        });

    } catch (error) {
        console.error("ASSESSMENT ERROR:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch assessment" });
    }
});

module.exports = router;
