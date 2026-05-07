const express = require("express");
const router = express.Router();
const { db, db3 } = require("../database/database");

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
                    LEFT JOIN course_table c ON pt.course_id = c.course_id
                    WHERE pt.curriculum_id = ?
                      AND pt.year_level_id = ?
                      AND pt.semester_id = ?
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
                const hasNSTP = subjects.some(s => Number(s.is_nstp) === 1);
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

                //////////////////////////////////////////////////////////
                // TOTALS
                //////////////////////////////////////////////////////////
                const totalTuition = tuitionFee + nstpFee;
                const grandTotal   = totalTuition + miscellaneousFee;

                console.log("Tuition Fee:", tuitionFee);
                console.log("NSTP Fee:", nstpFee);
                console.log("Computer Fee:", computerFee);
                console.log("School ID Fee:", schoolIdFee);
                console.log("Misc Fee:", miscellaneousFee);
                console.log("Grand Total:", grandTotal);

                return {
                    school_year : s.year_description        || "",
                    semester    : s.semester_description    || "First Semester",
                    year_level  : s.year_level_description  || "",
                    subjects,
                    fees: {
                        tuitionFee,
                        nstpFee,
                        computerFee,
                        schoolIdFee,
                        miscellaneousFee,
                        totalTuition,
                        grandTotal,
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