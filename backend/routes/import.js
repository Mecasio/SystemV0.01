const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { db, db3 } = require("./database/database");
const { CanCreate } = require("../middleware/pagePermissions");
const {
  getGradeConversions,
  getStoredNumericGrade,
  deriveRemarkAndStatusFromNumeric,
} = require("../utils/gradeConversion");
const {
  XLSX_IMPORT_LIMITS,
  validateSpreadsheetUpload,
  readWorkbookSafely,
  getSheetRowsWithLimits,
  hasFormulaCell,
  removeFormulaLikeRows,
  filterRowsWithMandatoryColumns,
  prepareRowsForInsert,
  processInBatches,
  withTransaction,
} = require("./system_routes/xlsxImportUtils");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const normalizeText = (value) => String(value ?? "").trim();

const toNullableNumber = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
};

const pickValue = (row, candidates) => {
  for (const key of candidates) {
    if (row[key] !== undefined && normalizeText(row[key]) !== "") {
      return row[key];
    }
  }
  return "";
};

const parseStudentName = (fullName) => {
  const text = normalizeText(fullName);
  if (!text) {
    return { lastName: "", firstName: "", middleName: "" };
  }

  const [lastPart = "", restPart = ""] = text
    .split(",")
    .map((part) => part.trim());
  if (!restPart) {
    return { lastName: lastPart, firstName: "", middleName: "" };
  }

  const nameParts = restPart.split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || "";
  const middleName = nameParts.join(" ");

  return { lastName: lastPart, firstName, middleName };
};

const parseProgramDescription = (programDescription) => {
  const text = normalizeText(programDescription);
  if (!text) {
    return { programCode: "", yearDescription: "" };
  }

  const match = text.match(/^(.*)-(\d{4})$/);
  if (match) {
    return {
      programCode: normalizeText(match[1]),
      yearDescription: normalizeText(match[2]),
    };
  }

  return { programCode: text, yearDescription: "" };
};

const parseAcademicYear = (academicYearText) => {
  const text = normalizeText(academicYearText);
  if (!text) {
    return { yearDescription: "", semesterDescription: "" };
  }

  const [yearRaw = "", semesterRaw = ""] = text
    .split(",")
    .map((part) => part.trim());
  const yearMatch = normalizeText(yearRaw).match(/^(\d{4})\s*-\s*\d{4}$/);
  const normalizedYear = yearMatch ? yearMatch[1] : normalizeText(yearRaw);

  return {
    yearDescription: normalizedYear,
    semesterDescription: normalizeText(semesterRaw),
  };
};

const mapRemarkToNumeric = (remark) => {
  const value = normalizeText(remark).toUpperCase();
  if (!value) return 0;
  if (value === "PASSED") return 1;
  if (value === "ONGOING" || value === "CURRENTLY ENROLLED") return 0;
  if (value === "FAILED") return 2;
  if (value === "INC" || value === "INCOMPLETE") return 3;
  if (value === "DROP" || value === "DROPPED" || value === "DRP") return 4;
  return 0;
};

const normalizeAcademicYearValue = (yearText) => {
  const text = normalizeText(yearText);
  if (!text) return "";

  const rangeMatch = text.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (rangeMatch) return rangeMatch[1];

  const yearMatch = text.match(/^(\d{4})$/);
  if (yearMatch) return yearMatch[1];

  return text;
};

const branchCache = {
  expiresAt: 0,
  map: new Map(),
};

const normalizeCampusKey = (value) =>
  normalizeText(value)
    .toUpperCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\bCAMPUS\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getBranchComponentMap = async () => {
  const now = Date.now();
  if (branchCache.expiresAt > now && branchCache.map.size > 0) {
    return branchCache.map;
  }

  const map = new Map();

  try {
    const [rows] = await db.query(
      `SELECT branches
       FROM company_settings
       WHERE id = 1
       LIMIT 1`,
    );

    const rawBranches = rows?.[0]?.branches;
    if (rawBranches) {
      const parsedBranches =
        typeof rawBranches === "string" ? JSON.parse(rawBranches) : rawBranches;

      if (Array.isArray(parsedBranches)) {
        for (const branch of parsedBranches) {
          const branchId = Number(branch?.id);
          const branchNameKey = normalizeCampusKey(branch?.branch);
          if (Number.isInteger(branchId) && branchNameKey) {
            map.set(branchNameKey, branchId);
            const aliasKey = normalizeCampusKey(`${branch?.branch} CAMPUS`);
            if (aliasKey) {
              map.set(aliasKey, branchId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(
      "[IMPORT] Failed to load branch map from company_settings:",
      error.message,
    );
  }

  branchCache.map = map;
  branchCache.expiresAt = now + 5 * 60 * 1000;
  return map;
};

const normalizeCampusComponent = (value, branchComponentMap = new Map()) => {
  const text = normalizeCampusKey(value);
  if (!text) return null;
  console.log("[IMPORT] Normalizing campus value", {
    original: value,
    normalized: text,
  });
  const numericValue = Number(text);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  if (branchComponentMap.has(text)) {
    return branchComponentMap.get(text);
  }

  return null;
};

const getUploadedRows = (req, res) => {
  const fileValidation = validateSpreadsheetUpload(req.file);
  if (!fileValidation.valid) {
    res
      .status(fileValidation.status)
      .json({ success: false, error: fileValidation.error });
    return null;
  }

  const workbook = readWorkbookSafely(req.file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    res
      .status(400)
      .json({ success: false, error: "Spreadsheet has no worksheet" });
    return null;
  }
  if (hasFormulaCell(sheet)) {
    res
      .status(400)
      .json({ success: false, error: "Formulas are not allowed in uploads" });
    return null;
  }

  const { rows: parsedRows, truncatedByMaxRows } = getSheetRowsWithLimits(
    sheet,
    {
      sheetToJsonOptions: { defval: "" },
    },
  );
  const { cleanRows, flaggedRows } = removeFormulaLikeRows(parsedRows);
  const { rowsToInsert } = prepareRowsForInsert(cleanRows, req.file.size || 0);
  req.xlsxWarnings = {
    truncatedByMaxRows,
    formulaRowsRemoved: flaggedRows,
  };

  if (!rowsToInsert.length) {
    res.status(400).json({ success: false, error: "Excel file is empty" });
    return null;
  }

  return rowsToInsert;
};

const runInTransaction = async (work) => {
  const connection = await db3.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const buildImportResponse = (message, importedCount, skippedItems) => ({
  success: true,
  message,
  importedCount,
  skippedCount: skippedItems.length,
  skippedItems: skippedItems.slice(0, 100),
});

// Dynamic grade conversion now comes from the grade_conversion table.

const normalizeCourseCodeForMatching = (courseCode) =>
  normalizeText(courseCode)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const normalizeImportedCourseCode = (courseCode) =>
  normalizeText(courseCode).toUpperCase();

const deriveLegacyImportOutcome = (numericInput, gradeConversions) => {
  const storedNumericGrade = getStoredNumericGrade(
    numericInput,
    gradeConversions,
  );
  const { enRemark, status } = deriveRemarkAndStatusFromNumeric(
    numericInput,
    gradeConversions,
  );

  return {
    storedNumericGrade,
    enRemark,
    status,
  };
};

/* PROBLEMS
- The normalization logic for NSTP course codes is somewhat ad-hoc and may not cover all possible variations or edge cases. It specifically looks for "NSTP" and then tries to canonicalize certain patterns, but there could be other unexpected formats that it doesn't handle well.
- The function assumes that any course code containing "NSTP" should be normalized in a specific way, which may not always be the case. There could be course codes that include "NSTP" as part of a larger code that shouldn't be normalized to the NSTP component format.
- Some nstp course code variations sometimes have not the word NSTP but only the component such as CWTSPROG1, LTS1, etc. 
*/

const normalizeNstpSourceCode = (courseCode) => {
  const normalized = normalizeCourseCodeForMatching(courseCode);
  if (!normalized.includes("NSTP")) return normalized;

  // Canonicalize common NSTP PROG variants like NSTP_PROG1/NSTP-PROG1/NSTP PROG1.
  if (/^NSTPPROG[12]$/.test(normalized)) {
    return normalized.replace(/^NSTPPROG/, "NSTPROG");
  }

  return normalized;
};

const getNstpComponentFromCode = (normalizedCourseCode) => {
  if (!normalizedCourseCode) return 0;
  if (/^NSTP(CWTS|CTWS)\d*$/.test(normalizedCourseCode)) return 1;
  if (/^NSTPLTS\d*$/.test(normalizedCourseCode)) return 2;
  if (/^NSTPMTS\d*$/.test(normalizedCourseCode)) return 3;
  return 0;
};

const hasKnownNstpComponentKeyword = (normalizedCourseCode) =>
  /NSTP(CWTS|CTWS|LTS|MTS)/.test(normalizedCourseCode || "");

const hasUnknownNstpComponentKeyword = (normalizedCourseCode) => {
  const code = normalizedCourseCode || "";
  if (!code.includes("NSTP")) return false;
  if (hasKnownNstpComponentKeyword(code)) return false;
  if (/^NSTP[12]?$/.test(code)) return false;
  if (/^NSTPROG[12]?$/.test(code)) return false;
  if (!/\d/.test(code)) return false;
  return /^NSTP[A-Z]+\d*$/.test(code);
};

const transformNstpSubject = (courseCode, semesterDescription) => {
  const normalizedSource = normalizeNstpSourceCode(courseCode);
  if (!normalizedSource.includes("NSTP")) {
    return {
      courseCode: normalizeImportedCourseCode(courseCode),
      component: 0,
      normalizedSource,
      isNstp: false,
    };
  }

  let normalizedCourseCode = "NSTPROG";
  if (/NSTPROG1|NSTPCWTS1/.test(normalizedSource))
    normalizedCourseCode = "NSTPROG1";
  else if (/NSTPROG2|NSTPCWTS2/.test(normalizedSource))
    normalizedCourseCode = "NSTPROG2";
  else if (/FIRST\s+SEMESTER/i.test(semesterDescription || ""))
    normalizedCourseCode = "NSTPROG1";
  else if (/SECOND\s+SEMESTER/i.test(semesterDescription || ""))
    normalizedCourseCode = "NSTPROG2";

  return {
    courseCode: normalizedCourseCode,
    component: getNstpComponentFromCode(normalizedSource),
    normalizedSource,
    isNstp: true,
    hasKnownComponentKeyword: hasKnownNstpComponentKeyword(normalizedSource),
    hasUnknownComponentKeyword:
      hasUnknownNstpComponentKeyword(normalizedSource),
  };
};

/* PROBLEM LIST 
- Student name parsing is very naive and may not handle edge cases well (e.g. multiple commas, missing parts, suffixes like Jr./III, non-Western name formats). It just splits on the first comma and assumes the rest is "First Middle". This could lead to incorrect parsing for names that don't fit this pattern.
- The function does not handle cases where the full name might be in a different format (e.g. "First Middle Last" without a comma, or names with multiple commas). It also does not account for suffixes (Jr., Sr., III) or prefixes (Dr., Mr.) that might be present in the full name.
- If the first name have 2 or multiple words, it will consider the first word as the first name and the rest as middle name. This may not be accurate for all naming conventions or cultural contexts.
*/
function parseStudentNameLegacy(fullName) {
  if (!fullName) {
    return { lastName: null, firstName: null, middleName: null };
  }

  const [last, rest] = fullName.split(",").map((p) => p.trim());

  if (!rest) {
    return { lastName: last, firstName: null, middleName: null };
  }

  // Split first and middle names
  const nameParts = rest.split(/\s+/);

  const firstName = nameParts.shift(); // first word
  const middleName = nameParts.length ? nameParts.join(" ") : null;

  return {
    lastName: last,
    firstName,
    middleName,
  };
}

// -------------------------------------------- FOR FILE UPLOAD IN ENROLLED SUBJECT --------------------------------- //
router.post(
  "/import-xlsx-into-enrolled-subject",
  upload.single("file"),
  async (req, res) => {
    const campus = normalizeText(req.body.campus) || null;

    try {
      console.log("[IMPORT] Starting import-xlsx-into-enrolled-subject", {
        campus,
        hasFile: !!req.file,
        originalName: req.file?.originalname,
        size: req.file?.size,
      });

      const rawRows = getUploadedRows(req, res);
      if (!rawRows) return;

      const rows = rawRows.filter((row) => {
        const studentNumber = normalizeText(
          pickValue(row, ["Student Number", "StudentNumber", "student_number"]),
        );
        const courseCode = normalizeText(
          pickValue(row, ["Course ", "Course", "Course Code", "course_code"]),
        );
        return studentNumber || courseCode;
      });

      if (!rows.length) {
        return res
          .status(400)
          .json({ success: false, error: "No valid rows found" });
      }

      console.log("[IMPORT] Parsed Excel rows", {
        rawRowCount: rawRows.length,
        validRowCount: rows.length,
      });

      // Step 1: Group by student number + academic year.
      const groupedMap = new Map();
      for (const row of rows) {
        const studentNumber = normalizeText(
          pickValue(row, ["Student Number", "StudentNumber", "student_number"]),
        );
        const academicYear = normalizeText(
          pickValue(row, ["Academic Year", "AcademicYear", "academic_year"]),
        );

        if (!studentNumber || !academicYear) continue;

        const key = `${studentNumber}__${academicYear}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, { studentNumber, academicYear, rows: [] });
        }
        groupedMap.get(key).rows.push(row);
      }

      if (!groupedMap.size) {
        return res.status(400).json({
          success: false,
          error:
            "No rows with both Student Number and Academic Year were found",
        });
      }

      console.log("[IMPORT] Grouped rows", {
        groupedRecords: groupedMap.size,
      });

      const connection = await db3.getConnection();
      let createdPersons = 0;
      let processedStudents = 0;
      let insertedSubjects = 0;
      let updatedSubjects = 0;
      const skippedItems = [];
      const seenRowSignatures = new Set();

      try {
        await connection.beginTransaction();

        for (const group of groupedMap.values()) {
          const firstRow = group.rows[0];
          const studentNumber = group.studentNumber;
          const studentName = pickValue(firstRow, [
            "Student Name",
            "StudentName",
            "student_name",
          ]);
          const programDescription = pickValue(firstRow, [
            "Program Description",
            "ProgramDescription",
            "program_description",
          ]);
          const yearLevelDescription = normalizeText(
            pickValue(firstRow, [
              "Year Level",
              "YearLevel",
              "year_level_description",
            ]),
          );

          const {
            yearDescription: schoolYearDescription,
            semesterDescription,
          } = parseAcademicYear(group.academicYear);
          const { programCode, yearDescription: curriculumYearDescription } =
            parseProgramDescription(programDescription);
          const { firstName, middleName, lastName } =
            parseStudentName(studentName);

          console.log("[IMPORT][GROUP] Extracted metadata", {
            studentNumber,
            studentName,
            parsedName: { lastName, firstName, middleName },
            programDescription,
            parsedProgram: { programCode, curriculumYearDescription },
            yearLevelDescription,
            academicYearRaw: group.academicYear,
            parsedAcademicYear: { schoolYearDescription, semesterDescription },
            rowsInGroup: group.rows.length,
          });

          if (
            !studentNumber ||
            !programCode ||
            !curriculumYearDescription ||
            !yearLevelDescription ||
            !schoolYearDescription ||
            !semesterDescription
          ) {
            skippedItems.push({
              studentNumber,
              reason:
                "Missing required student metadata (program/year level/school year/semester)",
            });
            continue;
          }

          // Step 5 + 6: Resolve curriculum from program code + curriculum year description.
          const [programRows] = await connection.query(
            `SELECT program_id FROM program_table WHERE UPPER(TRIM(program_code)) = UPPER(TRIM(?)) LIMIT 1`,
            [programCode],
          );

          if (!programRows.length) {
            console.log("[IMPORT][GROUP] Program not found", {
              studentNumber,
              programCode,
            });
            skippedItems.push({
              studentNumber,
              reason: `Program not found: ${programCode}`,
            });
            continue;
          }

          const [currYearRows] = await connection.query(
            `SELECT year_id FROM year_table WHERE TRIM(year_description) = TRIM(?) LIMIT 1`,
            [curriculumYearDescription],
          );

          if (!currYearRows.length) {
            console.log("[IMPORT][GROUP] Curriculum year not found", {
              studentNumber,
              curriculumYearDescription,
            });
            skippedItems.push({
              studentNumber,
              reason: `Curriculum year not found: ${curriculumYearDescription}`,
            });
            continue;
          }

          const [curriculumRows] = await connection.query(
            `SELECT curriculum_id
           FROM curriculum_table
           WHERE year_id = ? AND program_id = ?
           LIMIT 1`,
            [currYearRows[0].year_id, programRows[0].program_id],
          );
          if (!curriculumRows.length) {
            console.log("[IMPORT][GROUP] Curriculum not found", {
              studentNumber,
              programCode,
              curriculumYearDescription,
            });
            skippedItems.push({
              studentNumber,
              reason: `Curriculum not found for program=${programCode} year=${curriculumYearDescription}`,
            });
            continue;
          }

          const curriculumId = curriculumRows[0].curriculum_id;
          console.log("[IMPORT][GROUP] Resolved curriculum", {
            studentNumber,
            programId: programRows[0].program_id,
            curriculumYearId: currYearRows[0].year_id,
            curriculumId,
          });

          // Step 7: Resolve year level id.
          const [yearLevelRows] = await connection.query(
            `SELECT year_level_id
           FROM year_level_table
           WHERE UPPER(TRIM(year_level_description)) = UPPER(TRIM(?))
           LIMIT 1`,
            [yearLevelDescription],
          );
          if (!yearLevelRows.length) {
            console.log("[IMPORT][GROUP] Year level not found", {
              studentNumber,
              yearLevelDescription,
            });
            skippedItems.push({
              studentNumber,
              reason: `Year level not found: ${yearLevelDescription}`,
            });
            continue;
          }

          const yearLevelId = yearLevelRows[0].year_level_id;
          console.log("[IMPORT][GROUP] Resolved year level", {
            studentNumber,
            yearLevelDescription,
            yearLevelId,
          });

          // Step 8: Resolve active school year id using year + semester description.
          const [schoolYearRows] = await connection.query(
            `SELECT year_id FROM year_table WHERE TRIM(year_description) = TRIM(?) LIMIT 1`,
            [schoolYearDescription],
          );
          if (!schoolYearRows.length) {
            console.log("[IMPORT][GROUP] School year not found", {
              studentNumber,
              schoolYearDescription,
            });
            skippedItems.push({
              studentNumber,
              reason: `School year not found: ${schoolYearDescription}`,
            });
            continue;
          }

          const [semesterRows] = await connection.query(
            `SELECT semester_id
           FROM semester_table
           WHERE UPPER(TRIM(semester_description)) = UPPER(TRIM(?))
           LIMIT 1`,
            [semesterDescription],
          );
          if (!semesterRows.length) {
            console.log("[IMPORT][GROUP] Semester not found", {
              studentNumber,
              semesterDescription,
            });
            skippedItems.push({
              studentNumber,
              reason: `Semester not found: ${semesterDescription}`,
            });
            continue;
          }

          const [activeSchoolYearRows] = await connection.query(
            `SELECT id
           FROM active_school_year_table
           WHERE year_id = ? AND semester_id = ?
           LIMIT 1`,
            [schoolYearRows[0].year_id, semesterRows[0].semester_id],
          );
          if (!activeSchoolYearRows.length) {
            console.log("[IMPORT][GROUP] Active school year not found", {
              studentNumber,
              schoolYearDescription,
              semesterDescription,
            });
            skippedItems.push({
              studentNumber,
              reason: `Active school year not found for ${schoolYearDescription}, ${semesterDescription}`,
            });
            continue;
          }

          const activeSchoolYearId = activeSchoolYearRows[0].id;
          console.log("[IMPORT][GROUP] Resolved active school year", {
            studentNumber,
            schoolYearId: schoolYearRows[0].year_id,
            semesterId: semesterRows[0].semester_id,
            activeSchoolYearId,
          });

          // Step 10/11/12: Resolve section, course, remarks, and pre-check duplicates first.
          const rowsToInsert = [];
          for (const row of group.rows) {
            const sectionDescription = normalizeText(
              pickValue(row, ["Section", "section", "Section Description"]),
            );
            const courseCode = normalizeText(
              pickValue(row, [
                "Course ",
                "Course",
                "Course Code",
                "course_code",
              ]),
            );

            if (!sectionDescription || !courseCode) {
              console.log("[IMPORT][ROW] Missing section/course", {
                studentNumber,
                sectionDescription,
                courseCode,
              });
              skippedItems.push({
                studentNumber,
                reason: "Missing section or course code in row",
              });
              continue;
            }

            const [sectionRows] = await connection.query(
              `SELECT id FROM section_table WHERE UPPER(TRIM(description)) = UPPER(TRIM(?)) LIMIT 1`,
              [sectionDescription],
            );
            if (!sectionRows.length) {
              console.log("[IMPORT][ROW] Section not found", {
                studentNumber,
                sectionDescription,
              });
              skippedItems.push({
                studentNumber,
                reason: `Section not found: ${sectionDescription}`,
              });
              continue;
            }

            const [departmentSectionRows] = await connection.query(
              `SELECT id
             FROM dprtmnt_section_table
             WHERE section_id = ? AND curriculum_id = ?
             LIMIT 1`,
              [sectionRows[0].id, curriculumId],
            );
            if (!departmentSectionRows.length) {
              console.log(
                "[IMPORT][ROW] Department section mapping not found",
                {
                  studentNumber,
                  sectionId: sectionRows[0].id,
                  curriculumId,
                },
              );
              skippedItems.push({
                studentNumber,
                reason: `Department section mapping not found for section=${sectionDescription} curriculum=${curriculumId}`,
              });
              continue;
            }

            const [courseRows] = await connection.query(
              `SELECT course_id FROM course_table WHERE UPPER(TRIM(course_code)) = UPPER(TRIM(?)) LIMIT 1`,
              [courseCode],
            );
            if (!courseRows.length) {
              console.log("[IMPORT][ROW] Course not found", {
                studentNumber,
                courseRows,
              });
              skippedItems.push({
                studentNumber,
                reason: `Course not found: ${courseRows}`,
              });
              continue;
            }

            const midterm = toNullableNumber(
              pickValue(row, ["Midterm", "midterm"]),
            );
            const finals = toNullableNumber(
              pickValue(row, ["Finals", "finals"]),
            );
            const finalGrade = toNullableNumber(
              pickValue(row, ["Final Grade", "FinalGrade", "final_grade"]),
            );
            const enRemarks = mapRemarkToNumeric(
              pickValue(row, ["Remarks", "Remark", "remarks", "remark"]),
            );

            console.log("[IMPORT][ROW] Extracted row payload", {
              studentNumber,
              courseCode,
              courseId: courseRows[0].course_id,
              sectionDescription,
              sectionId: sectionRows[0].id,
              departmentSectionId: departmentSectionRows[0].id,
              curriculumId,
              yearLevelId,
              activeSchoolYearId,
              midterm,
              finals,
              finalGrade,
              enRemarks,
            });

            const rowSignature = [
              studentNumber,
              curriculumId,
              courseRows[0].course_id,
              yearLevelId,
              departmentSectionRows[0].id,
              activeSchoolYearId,
              normalizeText(lastName).toUpperCase(),
              normalizeText(firstName).toUpperCase(),
              normalizeText(middleName).toUpperCase(),
            ].join("|");

            // Prevent duplicate rows within the same uploaded file.
            if (seenRowSignatures.has(rowSignature)) {
              console.log(
                "[IMPORT][ROW] Duplicate in uploaded file, skipping",
                {
                  studentNumber,
                  rowSignature,
                },
              );
              skippedItems.push({
                studentNumber,
                reason: `${studentNumber}'s Data Already exist`,
              });
              continue;
            }

            const [existingExactData] = await connection.query(
              `SELECT es.id
             FROM enrolled_subject es
             INNER JOIN student_status_table sst ON sst.student_number = es.student_number
             INNER JOIN student_numbering_table snt ON snt.student_number = es.student_number
             INNER JOIN person_table pt ON pt.person_id = snt.person_id
             WHERE es.student_number = ?
               AND es.curriculum_id = ?
               AND es.course_id = ?
               AND es.active_school_year_id = ?
               AND es.department_section_id = ?
               AND sst.year_level_id = ?
               AND UPPER(TRIM(pt.last_name)) = UPPER(TRIM(?))
               AND UPPER(TRIM(pt.first_name)) = UPPER(TRIM(?))
               AND UPPER(TRIM(COALESCE(pt.middle_name, ''))) = UPPER(TRIM(?))
             LIMIT 1`,
              [
                studentNumber,
                curriculumId,
                courseRows[0].course_id,
                activeSchoolYearId,
                departmentSectionRows[0].id,
                yearLevelId,
                lastName,
                firstName,
                middleName || "",
              ],
            );

            if (existingExactData.length > 0) {
              console.log("[IMPORT][ROW] Duplicate in database, skipping", {
                studentNumber,
                existingId: existingExactData[0].id,
              });
              skippedItems.push({
                studentNumber,
                reason: `${studentNumber}'s Data Already exist`,
              });
              seenRowSignatures.add(rowSignature);
              continue;
            }

            rowsToInsert.push({
              studentNumber,
              curriculumId,
              courseId: courseRows[0].course_id,
              activeSchoolYearId,
              midterm,
              finals,
              finalGrade,
              enRemarks,
              departmentSectionId: departmentSectionRows[0].id,
            });
            seenRowSignatures.add(rowSignature);
          }

          // Do not touch any student/person/status rows if all entries are duplicates/skipped.
          if (rowsToInsert.length === 0) {
            console.log(
              "[IMPORT][GROUP] No new rows to insert, no update/insert performed",
              {
                studentNumber,
              },
            );
            processedStudents += 1;
            continue;
          }

          // Step 2 + 3 + 4: Insert only (no updates) person, person status, student numbering.
          let personId = null;
          const [existingStudentNumber] = await connection.query(
            `SELECT person_id FROM student_numbering_table WHERE student_number = ? LIMIT 1`,
            [studentNumber],
          );

          if (existingStudentNumber.length > 0) {
            personId = existingStudentNumber[0].person_id;
            console.log(
              "[IMPORT][GROUP] Existing student_number found (no update)",
              {
                studentNumber,
                personId,
              },
            );
          } else {
            const [personInsert] = await connection.query(
              `INSERT INTO person_table (campus, last_name, first_name, middle_name)
             VALUES (?, ?, ?, ?)`,
              [campus, lastName, firstName, middleName || null],
            );
            personId = personInsert.insertId;
            createdPersons += 1;

            await connection.query(
              `INSERT INTO student_numbering_table (student_number, person_id)
             VALUES (?, ?)`,
              [studentNumber, personId],
            );

            console.log(
              "[IMPORT][GROUP] Inserted new person + student_number",
              {
                studentNumber,
                personId,
                campus,
              },
            );
          }

          await connection.query(
            `INSERT INTO person_status_table (person_id, student_registration_status)
           VALUES (?, 1) ON DUPLICATE KEY UPDATE student_registration_status = student_registration_status`,
            [personId],
          );

          console.log(
            "[IMPORT][GROUP] Inserted person_status if missing (no update)",
            {
              studentNumber,
              personId,
              student_registration_status: 1,
            },
          );

          // Step 9: Insert student status only if missing (no updates).
          await connection.query(
            `INSERT IGNORE INTO student_status_table
            (student_number, active_curriculum, enrolled_status, year_level_id, active_school_year_id, control_status)
           VALUES (?, ?, 1, ?, ?, 0)`,
            [studentNumber, curriculumId, yearLevelId, activeSchoolYearId],
          );

          console.log(
            "[IMPORT][GROUP] Inserted student_status if missing (no update)",
            {
              studentNumber,
              active_curriculum: curriculumId,
              year_level_id: yearLevelId,
              active_school_year_id: activeSchoolYearId,
              enrolled_status: 1,
            },
          );

          for (const payload of rowsToInsert) {
            await connection.query(
              `INSERT INTO enrolled_subject
              (student_number, curriculum_id, course_id, active_school_year_id, midterm, finals, final_grade, en_remarks, department_section_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                payload.studentNumber,
                payload.curriculumId,
                payload.courseId,
                payload.activeSchoolYearId,
                payload.midterm,
                payload.finals,
                payload.finalGrade,
                payload.enRemarks,
                payload.departmentSectionId,
              ],
            );

            console.log("[IMPORT][ROW] Inserted enrolled_subject", {
              studentNumber: payload.studentNumber,
              curriculumId: payload.curriculumId,
              courseId: payload.courseId,
              activeSchoolYearId: payload.activeSchoolYearId,
              departmentSectionId: payload.departmentSectionId,
            });

            insertedSubjects += 1;
          }

          processedStudents += 1;
          console.log("[IMPORT][GROUP] Finished group", {
            studentNumber,
            processedStudents,
            insertedSubjects,
            skippedCount: skippedItems.length,
          });
        }

        await connection.commit();
        console.log("[IMPORT] Transaction committed", {
          groupedRecords: groupedMap.size,
          processedStudents,
          createdPersons,
          insertedSubjects,
          updatedSubjects,
          skippedCount: skippedItems.length,
        });
      } catch (transactionErr) {
        await connection.rollback();
        console.log("[IMPORT] Transaction rolled back", {
          message: transactionErr.message,
        });
        throw transactionErr;
      } finally {
        connection.release();
        console.log("[IMPORT] Connection released");
      }

      res.json({
        success: true,
        message: "Excel imported successfully",
        groupedRecords: groupedMap.size,
        processedStudents,
        createdPersons,
        insertedSubjects,
        updatedSubjects,
        skippedCount: skippedItems.length,
        skippedItems: skippedItems.slice(0, 50),
        warnings: req.xlsxWarnings || {},
      });
    } catch (err) {
      console.error("Excel import error:", err);
      res.status(500).json({ error: "Failed to import Excel" });
    }
  },
);

router.post(
  "/import-curriculum-xlsx",
  upload.single("file"),
  async (req, res) => {
    try {
      const rows = getUploadedRows(req, res);
      if (!rows) return;

      let importedCount = 0;
      const skippedItems = [];

      await runInTransaction(async (connection) => {
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];

          const programCode = normalizeText(
            pickValue(row, ["Program Code", "program_code", "Program", "Code"]),
          );
          const programDescription = normalizeText(
            pickValue(row, ["Program Description", "program_description"]),
          );
          const major = normalizeText(pickValue(row, ["Major", "major"]));

          const yearRawValue = pickValue(row, [
            "Year",
            "year",
            "Academic Year",
            "year_description",
          ]);
          const normalizedYearDescription =
            normalizeAcademicYearValue(yearRawValue);

          let programId = null;
          if (programCode) {
            const [programRows] = await connection.query(
              `SELECT program_id
             FROM program_table
             WHERE UPPER(TRIM(program_code)) = UPPER(TRIM(?))
             LIMIT 1`,
              [programCode],
            );
            if (programRows.length) {
              programId = programRows[0].program_id;
            }
          }

          if (!programId && programDescription) {
            const [programRows] = await connection.query(
              `SELECT program_id
             FROM program_table
             WHERE UPPER(TRIM(program_description)) = UPPER(TRIM(?))
               AND UPPER(TRIM(COALESCE(major, ''))) = UPPER(TRIM(?))
             LIMIT 1`,
              [programDescription, major],
            );
            if (programRows.length) {
              programId = programRows[0].program_id;
            }
          }

          let yearId = null;
          if (normalizedYearDescription) {
            const [yearRows] = await connection.query(
              `SELECT year_id
             FROM year_table
             WHERE TRIM(year_description) = TRIM(?)
             LIMIT 1`,
              [normalizedYearDescription],
            );
            if (yearRows.length) {
              yearId = yearRows[0].year_id;
            }
          }

          if (!programId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Program found: ${programCode || programDescription || "N/A"}`,
            });
            continue;
          }

          if (!yearId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Year found: ${normalizedYearDescription || yearRawValue || "N/A"}`,
            });
            continue;
          }

          const [existingRows] = await connection.query(
            `SELECT curriculum_id
           FROM curriculum_table
           WHERE program_id = ? AND year_id = ?
           LIMIT 1`,
            [programId, yearId],
          );

          if (existingRows.length) {
            skippedItems.push({
              row: index + 2,
              reason: "Curriculum already exists",
            });
            continue;
          }

          await connection.query(
            `INSERT INTO curriculum_table (program_id, year_id) VALUES (?, ?)`,
            [programId, yearId],
          );
          importedCount += 1;
        }
      });

      return res.json(
        buildImportResponse(
          "Curriculum import finished",
          importedCount,
          skippedItems,
        ),
      );
    } catch (err) {
      console.error("Curriculum import error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to import curriculum file" });
    }
  },
);

router.post("/import-program-xlsx", upload.single("file"), async (req, res) => {
  try {
    const rows = getUploadedRows(req, res);
    if (!rows) return;
    const branchComponentMap = await getBranchComponentMap();

    let importedCount = 0;
    const skippedItems = [];

    await runInTransaction(async (connection) => {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];

        const programCode = normalizeText(
          pickValue(row, [
            "Program Code",
            "program_code",
            "Code",
            "programCode",
          ]),
        );
        const programDescription = normalizeText(
          pickValue(row, [
            "Program Description",
            "program_description",
            "Description",
          ]),
        );
        const majorValue = normalizeText(pickValue(row, ["Major", "major"]));
        const major = majorValue || null;
        const rawComponent = pickValue(row, [
          "Campus",
          "components",
          "component",
          "Components",
        ]);
        const component = normalizeCampusComponent(
          rawComponent,
          branchComponentMap,
        );

        if (!programCode || !programDescription || component === null) {
          skippedItems.push({
            row: index + 2,
            reason:
              "Missing/invalid program_code, program_description, or campus",
          });
          continue;
        }

        const [existingRows] = await connection.query(
          `SELECT program_id
           FROM program_table
           WHERE UPPER(TRIM(program_code)) = UPPER(TRIM(?))
           LIMIT 1`,
          [programCode],
        );

        if (existingRows.length) {
          skippedItems.push({
            row: index + 2,
            reason: "Program code already exists",
          });
          continue;
        }

        await connection.query(
          `INSERT INTO program_table (program_code, program_description, major, components)
           VALUES (?, ?, ?, ?)`,
          [programCode, programDescription, major, component],
        );
        importedCount += 1;
      }
    });

    return res.json(
      buildImportResponse(
        "Program import finished",
        importedCount,
        skippedItems,
      ),
    );
  } catch (err) {
    console.error("Program import error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to import program file" });
  }
});

router.post("/import-course-xlsx", upload.single("file"), async (req, res) => {
  try {
    const rows = getUploadedRows(req, res);
    if (!rows) return;

    let importedCount = 0;
    const skippedItems = [];

    await runInTransaction(async (connection) => {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];

        const courseCode = normalizeText(
          pickValue(row, ["course_code", "Course Code", "Course", "Code"]),
        );
        const courseDescription = normalizeText(
          pickValue(row, [
            "course_description",
            "Course Description",
            "Description",
          ]),
        );
        const courseUnit = toNullableNumber(
          pickValue(row, [
            "course_unit",
            "Course Unit",
            "Credit Unit",
            "Units",
          ]),
        );
        const lecUnit = toNullableNumber(
          pickValue(row, ["lec_unit", "Lecture Unit", "Lec Unit", "Lec"]),
        );
        const labUnit = toNullableNumber(
          pickValue(row, ["lab_unit", "Laboratory Unit", "Lab Unit", "Lab"]),
        );
        const prereqValue = normalizeText(
          pickValue(row, ["prereq", "Prerequisite", "Pre-requisite"]),
        );
        const corequisiteValue = normalizeText(
          pickValue(row, ["corequisite", "Corequisite", "Co-requisite"]),
        );

        if (!courseCode) {
          skippedItems.push({
            row: index + 2,
            reason: "Missing course_code",
          });
          continue;
        }

        const [existingRows] = await connection.query(
          `SELECT course_id
           FROM course_table
           WHERE UPPER(TRIM(course_code)) = UPPER(TRIM(?))
           LIMIT 1`,
          [courseCode],
        );

        if (existingRows.length) {
          skippedItems.push({
            row: index + 2,
            reason: "Course code already exists",
          });
          continue;
        }

        await connection.query(
          `INSERT INTO course_table
            (course_code, course_description, course_unit, lec_unit, lab_unit, prereq, corequisite)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            courseCode,
            courseDescription || null,
            courseUnit ?? 0,
            lecUnit ?? 0,
            labUnit ?? 0,
            prereqValue || null,
            corequisiteValue || null,
          ],
        );
        importedCount += 1;
      }
    });

    return res.json(
      buildImportResponse(
        "Course import finished",
        importedCount,
        skippedItems,
      ),
    );
  } catch (err) {
    console.error("Course import error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to import course file" });
  }
});

router.post(
  "/import-program-tagging-xlsx",
  CanCreate,
  upload.single("file"),
  async (req, res) => {
    try {
      const rows = getUploadedRows(req, res);
      if (!rows) return;
      const branchComponentMap = await getBranchComponentMap();

      let importedCount = 0;
      const skippedItems = [];

      await runInTransaction(async (connection) => {
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];

          // 1) Extract metadata first.
          const programCode = normalizeText(
            pickValue(row, ["Program Code", "program_code", "Program", "Code"]),
          );
          const campusRaw = pickValue(row, [
            "Campus",
            "campus",
            "Components",
            "components",
          ]);
          const campusComponent = normalizeCampusComponent(
            campusRaw,
            branchComponentMap,
          );
          const yearRaw = pickValue(row, [
            "Year",
            "year",
            "Academic Year",
            "year_description",
          ]);
          const normalizedYearDescription = normalizeAcademicYearValue(yearRaw); // 2018-2019 -> 2018
          const yearLevelDescription = normalizeText(
            pickValue(row, [
              "Year Level",
              "year_level_description",
              "Year Level Description",
            ]),
          );
          const semesterDescription = normalizeText(
            pickValue(row, [
              "Semester",
              "semester_description",
              "Semester Description",
            ]),
          );
          const courseCode = normalizeText(
            pickValue(row, ["Course Code", "course_code", "Course"]),
          );
          const courseDescription = normalizeText(
            pickValue(row, [
              "Course Description",
              "course_description",
              "Description",
            ]),
          );

          // 2) Resolve IDs using metadata.
          let yearId = null;
          if (normalizedYearDescription) {
            const [yearRows] = await connection.query(
              `SELECT year_id
               FROM year_table
              WHERE TRIM(year_description) = TRIM(?)
              LIMIT 1`,
              [normalizedYearDescription],
            );
            if (yearRows.length) {
              yearId = yearRows[0].year_id;
            }
          }
          if (!yearId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Year found: ${normalizedYearDescription || yearRaw || "N/A"}`,
            });
            continue;
          }

          let programId = null;
          if (programCode) {
            if (campusComponent !== null) {
              const [programRows] = await connection.query(
                `SELECT program_id
                 FROM program_table
                WHERE UPPER(TRIM(program_code)) = UPPER(TRIM(?))
                  AND components = ?
                LIMIT 1`,
                [programCode, campusComponent],
              );
              if (programRows.length) {
                programId = programRows[0].program_id;
              }
            }

            if (!programId) {
              const [programRows] = await connection.query(
                `SELECT program_id
                 FROM program_table
                WHERE UPPER(TRIM(program_code)) = UPPER(TRIM(?))
                LIMIT 1`,
                [programCode],
              );
              if (programRows.length) {
                programId = programRows[0].program_id;
              }
            }
          }

          if (!programId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Program found: ${programCode || "N/A"}`,
            });
            continue;
          }

          let curriculumId = null;
          if (yearId && programId) {
            const [curriculumRows] = await connection.query(
              `SELECT curriculum_id
               FROM curriculum_table
              WHERE year_id = ?
                AND program_id = ?
              LIMIT 1`,
              [yearId, programId],
            );
            if (curriculumRows.length) {
              curriculumId = curriculumRows[0].curriculum_id;
            }
          }
          if (!curriculumId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Curriculum found for Program ${programCode || programId} and Year ${normalizedYearDescription || yearId}`,
            });
            continue;
          }

          let yearLevelId = null;
          if (yearLevelDescription) {
            const [yearLevelRows] = await connection.query(
              `SELECT year_level_id
               FROM year_level_table
              WHERE UPPER(TRIM(year_level_description)) = UPPER(TRIM(?))
              LIMIT 1`,
              [yearLevelDescription],
            );
            if (yearLevelRows.length) {
              yearLevelId = yearLevelRows[0].year_level_id;
            }
          }
          if (!yearLevelId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Year Level found: ${yearLevelDescription || "N/A"}`,
            });
            continue;
          }

          let semesterId = null;
          if (semesterDescription) {
            const [semesterRows] = await connection.query(
              `SELECT semester_id
               FROM semester_table
              WHERE UPPER(TRIM(semester_description)) = UPPER(TRIM(?))
              LIMIT 1`,
              [semesterDescription],
            );
            if (semesterRows.length) {
              semesterId = semesterRows[0].semester_id;
            }
          }
          if (!semesterId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Semester found: ${semesterDescription || "N/A"}`,
            });
            continue;
          }

          let courseId = null;
          if (courseCode) {
            const [courseRows] = await connection.query(
              `SELECT course_id
               FROM course_table
              WHERE UPPER(TRIM(course_code)) = UPPER(TRIM(?))
              LIMIT 1`,
              [courseCode],
            );
            if (courseRows.length) {
              courseId = courseRows[0].course_id;
            }
          }
          if (!courseId && courseDescription) {
            const [courseRows] = await connection.query(
              `SELECT course_id
               FROM course_table
              WHERE UPPER(TRIM(course_description)) = UPPER(TRIM(?))
              LIMIT 1`,
              [courseDescription],
            );
            if (courseRows.length) {
              courseId = courseRows[0].course_id;
            }
          }
          if (!courseId) {
            skippedItems.push({
              row: index + 2,
              reason: `There's no matching Course found: ${courseCode || courseDescription || "N/A"}`,
            });
            continue;
          }

          const [existingRows] = await connection.query(
            `SELECT program_tagging_id
             FROM program_tagging_table
            WHERE curriculum_id = ?
              AND year_level_id = ?
              AND semester_id = ?
              AND course_id = ?
            LIMIT 1`,
            [curriculumId, yearLevelId, semesterId, courseId],
          );

          if (existingRows.length) {
            skippedItems.push({
              row: index + 2,
              reason: "Program tag already exists",
            });
            continue;
          }

          await connection.query(
            `INSERT INTO program_tagging_table
            (curriculum_id, year_level_id, semester_id, course_id)
           VALUES (?, ?, ?, ?)`,
            [curriculumId, yearLevelId, semesterId, courseId],
          );
          importedCount += 1;
        }
      });

      return res.json(
        buildImportResponse(
          "Program tagging import finished",
          importedCount,
          skippedItems,
        ),
      );
    } catch (err) {
      console.error("Program tagging import error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to import program tagging file",
      });
    }
  },
);

router.post("/api/exam/import", upload.single("file"), async (req, res) => {
  try {
    const fileValidation = validateSpreadsheetUpload(req.file);
    if (!fileValidation.valid) {
      return res.status(fileValidation.status).json({ error: fileValidation.error });
    }

    const workbook = readWorkbookSafely(req.file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ error: "No worksheet found" });

    const { rows: parsedRows } = getSheetRowsWithLimits(sheet, {
      sheetToJsonOptions: { defval: "" },
    });

    const validRows = parsedRows;

    // 1️⃣ GET SUBJECTS (DYNAMIC SOURCE OF TRUTH)
    const [subjects] = await db.query(`
      SELECT id, name, max_score
      FROM subjects
      WHERE is_active = 1
      ORDER BY id ASC
    `);

    // map subject name → subject row
    const subjectMap = {};
    subjects.forEach((s) => {
      subjectMap[s.name.trim().toLowerCase()] = s;
    });

    // 2️⃣ applicant mapping
    const applicantNumbers = validRows
      .map(r => r["Applicant ID"])
      .filter(Boolean);

    const [matches] = await db.query(`
      SELECT person_id, applicant_number
      FROM applicant_numbering_table
      WHERE applicant_number IN (?)
    `, [applicantNumbers]);

    const applicantMap = {};
    matches.forEach(m => {
      applicantMap[m.applicant_number] = m.person_id;
    });

    const now = new Date();

    // 3️⃣ PROCESS EACH ROW
    for (const row of validRows) {
      const applicantNumber = row["Applicant ID"];
      const personId = applicantMap[applicantNumber];
      if (!personId) continue;

      // 4️⃣ BUILD SCORES DYNAMICALLY FROM SUBJECTS TABLE
      const subjectScores = {};

      subjects.forEach(sub => {
        const key = sub.name; // Excel header must match DB name
        subjectScores[sub.id] = Number(row[key] || 0);
      });

      const totalScore = Object.values(subjectScores).reduce((a, b) => a + b, 0);

      const maxTotal = subjects.reduce(
        (sum, s) => sum + Number(s.max_score || 0),
        0
      );

      const percentage = maxTotal ? (totalScore / maxTotal) * 100 : 0;

      const finalRating = subjects.length
        ? totalScore / subjects.length
        : 0;

      let status = row["Status"]?.toUpperCase();
      if (status !== "PASSED" && status !== "FAILED") {
        status = null;
      }

      // 5️⃣ UPSERT exam_results
      const [existing] = await db.query(
        `SELECT id FROM exam_results WHERE person_id = ?`,
        [personId]
      );

      let examResultId;

      if (existing.length > 0) {
        examResultId = existing[0].id;

        await db.query(
          `UPDATE exam_results
           SET total_score = ?, percentage = ?, final_rating = ?, status = ?
           WHERE id = ?`,
          [totalScore, percentage, finalRating, status, examResultId]
        );

        await db.query(
          `DELETE FROM exam_result_details WHERE exam_result_id = ?`,
          [examResultId]
        );
      } else {
        const [insert] = await db.query(
          `INSERT INTO exam_results
           (person_id, total_score, percentage, final_rating, status, date_created)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [personId, totalScore, percentage, finalRating, status, now]
        );

        examResultId = insert.insertId;
      }

      // 6️⃣ INSERT DETAILS (FULLY DYNAMIC)
      const detailRows = subjects.map(sub => [
        examResultId,
        sub.id,
        subjectScores[sub.id] || 0
      ]);

      await db.query(
        `INSERT INTO exam_result_details
         (exam_result_id, subject_id, score)
         VALUES ?`,
        [detailRows]
      );
    }

    res.json({
      success: true,
      message: "Import successful (fully dynamic subjects)"
    });

  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/import_xslx_student", upload.single("file"), async (req, res) => {
  try {
    const fileValidation = validateSpreadsheetUpload(req.file);
    if (!fileValidation.valid) {
      return res
        .status(fileValidation.status)
        .json({ error: fileValidation.error });
    }

    // ✅ Read from memory buffer instead of path
    const workbook = readWorkbookSafely(req.file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(400).json({ error: "Spreadsheet has no worksheet" });
    }
    if (hasFormulaCell(sheet)) {
      return res
        .status(400)
        .json({ error: "Formulas are not allowed in uploads" });
    }

    const { rows: parsedRows, truncatedByMaxRows } = getSheetRowsWithLimits(
      sheet,
      {
        sheetToJsonOptions: { defval: "" },
      },
    );
    const { cleanRows, flaggedRows } = removeFormulaLikeRows(parsedRows);
    const { validRows, skippedMissingMandatory } =
      filterRowsWithMandatoryColumns(cleanRows, [
        "student number",
        "first name",
        "last name",
      ]);
    const { rowsToInsert } = prepareRowsForInsert(validRows, req.file.size);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const row of rowsToInsert) {
      const student_number =
        row["Student Number"] ||
        row["student_number"] ||
        row["student number"] ||
        null;

      const email =
        row["email address"] ||
        row["emailAddress"] ||
        row["Email Address"] ||
        row["Email"] ||
        row["email"] ||
        null;

      const first_name =
        row["First Name"] || row["first_name"] || row["Firstname"] || null;
      const middle_name =
        row["Middle Name"] || row["middle_name"] || row["Middlename"] || null;
      const last_name =
        row["Last Name"] || row["last_name"] || row["Lastname"] || null;

      if (!student_number || !email || !first_name || !last_name) {
        skippedCount++;
        continue;
      }

      // ✅ Avoid duplicates
      const [existing] = await db3.query(
        "SELECT * FROM person_table WHERE emailAddress = ?",
        [email],
      );
      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      // ✅ Insert into person_table
      const [personInsert] = await db3.query(
        `INSERT INTO person_table (first_name, middle_name, last_name, emailAddress)
         VALUES (?, ?, ?, ?)`,
        [first_name, middle_name, last_name, email],
      );

      const person_id = personInsert.insertId;

      // ✅ Insert into student_numbering_table
      await db3.query(
        `INSERT INTO student_numbering_table (student_number, person_id)
         VALUES (?, ?)`,
        [student_number, person_id],
      );

      insertedCount++;
    }

    res.json({
      message: `✅ Import complete. ${insertedCount} records added, ${skippedCount} skipped.`,
      warnings: {
        truncatedByMaxRows,
        skippedMissingMandatory,
        formulaRowsRemoved: flaggedRows,
      },
    });
  } catch (error) {
    console.error("❌ Import error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// SAME FUNCTION NAME — ONLY VALIDATION REMOVED
router.post("/api/person/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const XLSX = require("xlsx");

    // ---------------------------------------
    // HELPERS
    // ---------------------------------------

    function excelDateToJSDate(serial) {
      if (typeof serial !== "number") return serial;

      const days = Math.floor(serial - 25569);
      const date = new Date(days * 86400 * 1000);

      return date.toISOString().split("T")[0];
    }

    function normalizeGender(val) {
      if (!val) return null;

      const v = val.toString().trim().toLowerCase();

      if (["male", "m", "0"].includes(v)) return 0;
      if (["female", "f", "1"].includes(v)) return 1;

      return null;
    }

    function calculateAge(birthdate) {
      if (!birthdate) return null;

      const d = new Date(birthdate);

      // ❗ ADD THIS
      if (isNaN(d.getTime())) return null;

      const now = new Date();

      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();

      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;

      return age;
    }

    function normalizeSchoolLevel(value) {
      if (!value) return null;

      const v = value.toString().trim().toUpperCase();

      const mapping = {
        "SENIOR HIGH SCHOOL": "Senior High School",
        UNDERGRADUATE: "Undergraduate",
        GRADUATE: "Graduate",
        ALS: "ALS",
      };

      return mapping[v] || value;
    }

    function normalizeStudentNumber(sn) {
      if (!sn) return null;

      const val = sn.toString().trim();

      if (/^\d{2}-\d{4}$/.test(val)) {
        const year = "20" + val.slice(0, 2);
        const num = val.slice(3); // ✅ FIXED
        return `${year}-${num}C`;
      }

      return val;
    }

    // ---------------------------------------
    // READ EXCEL
    // ---------------------------------------

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    // ---------------------------------------
    // COUNTERS
    // ---------------------------------------

    let totalRows = 0;
    let totalValid = 0;
    let totalInvalid = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalNotFound = 0;

    const missingStudents = [];

    // ---------------------------------------
    // COLUMNS (UNCHANGED)
    // ---------------------------------------

    const columns = [
      "student_number",
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
    ];

    // ---------------------------------------
    // PROGRAM + CAMPUS MAP (NO VALIDATION)
    // ---------------------------------------

    const studentNumbers = rows
      .slice(1)
      .map((r) => {
        const raw = r[0]?.toString().trim();
        if (!raw) return null;

        return normalizeStudentNumber(raw); // no validation
      })
      .filter((value) => value);

    const programMapRows = studentNumbers.length
      ? (
          await db3.query(
            `
            SELECT 
              snt.student_number,
              MAX(sst.active_curriculum) AS curriculum_id,
              MAX(pt.components) AS campus_component,
              MAX(pt.academic_program) AS academic_program,
              MAX(sst.year_level_id) AS year_level_id
            FROM student_numbering_table snt
            JOIN student_status_table sst 
              ON snt.student_number = sst.student_number
            JOIN curriculum_table ct 
              ON sst.active_curriculum = ct.curriculum_id
            JOIN program_table pt 
              ON ct.program_id = pt.program_id
            WHERE snt.student_number IN (?)
            GROUP BY snt.student_number
            `,
            [studentNumbers],
          )
        )[0]
      : [];

    const programMap = {};
    for (const row of programMapRows) {
      programMap[row.student_number] = row;
    }

    console.log(
      `Program map built for ${Object.keys(programMap).length} students`,
    );

    // ---------------------------------------
    // PROCESS ROWS
    // ---------------------------------------

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Object.values(row).some((v) => v)) continue;

      totalRows++;

      const rawStudentNumber = row[0]?.toString().trim();
      const normalizedStudentNumber = normalizeStudentNumber(rawStudentNumber);
      // ❗ SKIP header / non-student rows
      if (
        !rawStudentNumber ||
        rawStudentNumber.toLowerCase().includes("student") ||
        rawStudentNumber.toLowerCase().includes("republic") ||
        rawStudentNumber.toLowerCase().includes("institute") ||
        rawStudentNumber.length > 20 // long text = not a student number
      ) {
        continue;
      }
      const studentNumber = normalizeStudentNumber(rawStudentNumber);

      console.log("Processing:", rawStudentNumber, "→", studentNumber);

      totalValid++;

      let [studentRows] = await db3.query(
        `
  SELECT 
    s.person_id,
    p.last_name,
    p.first_name,
    p.middle_name
  FROM student_numbering_table s
  LEFT JOIN person_table p
    ON p.person_id = s.person_id
  WHERE s.student_number = ?
  LIMIT 1
  `,
        [rawStudentNumber],
      );

      // fallback
      if (!studentRows.length) {
        [studentRows] = await db3.query(
          `
    SELECT 
      s.person_id,
      p.last_name,
      p.first_name,
      p.middle_name
    FROM student_numbering_table s
    LEFT JOIN person_table p
      ON p.person_id = s.person_id
    WHERE s.student_number = ?
    LIMIT 1
    `,
          [normalizedStudentNumber],
        );
      }

      if (!studentRows.length || !studentRows[0].person_id) {
        totalNotFound++;
        totalSkipped++;

        // ❌ ONLY missing students go here
        missingStudents.push({
          studentNumber: rawStudentNumber, // ✅ KEEP ORIGINAL (19-*****)
          last_name: cleanValue(row[1]) || "",
          first_name: cleanValue(row[2]) || "",
          middle_name: cleanValue(row[3]) || "",
        });

        continue;
      }

      const person_id = studentRows[0].person_id;

      const [personCheck] = await db3.query(
        `
        SELECT person_id, campus, program, academicProgram, yearLevel
        FROM person_table
        WHERE person_id = ?
        LIMIT 1
        `,
        [person_id],
      );

      if (personCheck.length === 0) {
        totalSkipped++;
        continue;
      }

      const existingPerson = personCheck[0];

      const resolvedProgram =
        programMap[studentNumber]?.curriculum_id ??
        existingPerson.program ??
        null;

      const resolvedCampus =
        programMap[studentNumber]?.campus_component ??
        existingPerson.campus ??
        null;

      const resolvedAcademicProgram =
        programMap[studentNumber]?.academic_program ??
        existingPerson.academicProgram ??
        null;

      const resolvedYearLevelId =
        programMap[studentNumber]?.year_level_id ??
        existingPerson.yearLevel ??
        null;

      // ---------------------------------------
      // (REST OF YOUR CODE UNCHANGED)
      // ---------------------------------------

      function splitFullName(fullName) {
        if (!fullName || typeof fullName !== "string") {
          return { family: null, given: null, middle: null };
        }

        const clean = fullName.trim();

        if (clean.includes(",")) {
          const [last, rest] = clean.split(",");
          const parts = rest.trim().split(/\s+/);

          return {
            family: last.trim(),
            given: parts[0] || null,
            middle: parts.slice(1).join(" ") || null,
          };
        }

        const parts = clean.split(/\s+/);

        return {
          family: parts.length > 1 ? parts[parts.length - 1] : null,
          given: parts[0] || null,
          middle: parts.slice(1, -1).join(" ") || null,
        };
      }

      function cleanValue(v) {
        if (!v) return null;

        const val = v.toString().trim().toLowerCase();

        if (["-", "n/a", "na", "~", ""].includes(val)) return null;

        return v;
      }

      let birthTmp = null;

      const excelToDbMap = {
        0: "student_number",
        1: "last_name",
        2: "first_name",
        3: "middle_name",
        4: "extension",
        5: "lrnNumber",

        10: "birthOfDate",
        11: "birthPlace",
        12: "gender",
        13: "civilStatus",

        15: "citizenship",
        16: "religion",

        // ✅ ADDRESS FIX
        17: "presentStreet",
        20: "presentZipCode",
        20: "permanentZipCode",
        21: "permanentStreet",

        22: "cellphoneNumber",
        23: "emailAddress", //done

        25: "pwdType",
        26: "pwdId",

        27: "tribeEthnicGroup",

        28: "schoolLevel1",
        29: "schoolLastAttended1",
        30: "schoolAddress1",

        32: "yearGraduated",
        34: "generalAverage1",

        // ✅ FATHER (CORRECT)
        38: "father_fullname", //done
        40: "father_contact",
        41: "father_occupation",
        42: "father_income",

        47: "mother_fullname",
        49: "mother_contact",
        50: "mother_occupation",
        51: "mother_income",

        // ✅ GUARDIAN (FIXED SHIFT)
        61: "annual_income", // Family Annual Income
        62: "guardian_fullname",
        64: "guardian_contact",

        // physical
        68: "height",
        69: "weight",
      };

      const fatherParsed = splitFullName(row[38]);
      const motherParsed = splitFullName(row[47]);
      const guardianParsed = splitFullName(row[62]);

      const personValues = columns.map((col) => {
        if (col === "father_family_name") return fatherParsed.family;
        if (col === "father_given_name") return fatherParsed.given;
        if (col === "father_middle_name") return fatherParsed.middle;

        if (col === "mother_family_name") return motherParsed.family;
        if (col === "mother_given_name") return motherParsed.given;
        if (col === "mother_middle_name") return motherParsed.middle;

        if (col === "guardian_family_name") return guardianParsed.family;
        if (col === "guardian_given_name") return guardianParsed.given;
        if (col === "guardian_middle_name") return guardianParsed.middle;

        const dbToExcelMap = {};
        for (const [key, value] of Object.entries(excelToDbMap)) {
          dbToExcelMap[value] = Number(key);
        }

        if (col === "student_number") return rawStudentNumber;
        if (col === "program") return resolvedProgram;
        if (col === "campus") return resolvedCampus;
        if (col === "academicProgram") return resolvedAcademicProgram;
        if (col === "yearLevel") return resolvedYearLevelId;
        if (col === "created_at") return new Date();

        const excelIndex = dbToExcelMap[col];
        if (excelIndex === undefined) return null;

        let v = cleanValue(row[excelIndex]);

        if (col === "schoolLevel" || col === "schoolLevel1") {
          v = normalizeSchoolLevel(v);
        }

        if (col === "gender") v = normalizeGender(v);

        if (col === "birthOfDate") {
          v = excelDateToJSDate(v);
          birthTmp = v;
        }

        if (col === "age") {
          const ageVal = calculateAge(birthTmp);
          v = isNaN(ageVal) ? null : ageVal;
        }

        if (typeof v === "number" && isNaN(v)) v = null;

        return v;
      });

      // ✅ FINAL TERMINAL OUTPUT (ONLY ONCE)

      const birthIndex = columns.indexOf("birthOfDate");
      const ageIndex = columns.indexOf("age");

      const birthDateValue = personValues[birthIndex];

      const computedAge = birthDateValue ? calculateAge(birthDateValue) : null;

      personValues[ageIndex] =
        computedAge === null || isNaN(computedAge) ? null : computedAge;

      const personValueMap = {};
      columns.forEach((col, idx) => {
        personValueMap[col] = personValues[idx];
      });

      const columnsToUpdate = columns.filter((col) => {
        if (col === "campus" && resolvedCampus == null) return false;
        if (col === "program" && resolvedProgram == null) return false;
        if (col === "academicProgram" && resolvedAcademicProgram == null)
          return false;
        if (col === "yearLevel" && resolvedYearLevelId == null) return false;
        return true;
      });

      const updateFields = columnsToUpdate.map((col) => `${col} = ?`).join(",");

      await db3.query(
        `
        UPDATE person_table
        SET ${updateFields}
        WHERE person_id = ?
        `,
        [...columnsToUpdate.map((col) => personValueMap[col]), person_id],
      );

      totalUpdated++;
    }

    if (missingStudents.length > 0) {
      console.log("\n========= MISSING STUDENTS =========");
      console.table(
        missingStudents.map((sn) => ({
          studentNumber: sn,
        })),
      );
      console.log("====================================\n");
    }

    return res.json({
      success: true,
      message: `Imported: ${totalRows}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}`,
      updated: totalUpdated,
      skipped: totalSkipped,
      skippedNotFoundCount: totalNotFound,
      missingStudents, // ✅ SEND TO FRONTEND
      totalValid,
      totalInvalid,
      totalRows,
    });
  } catch (err) {
    console.error("IMPORT ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

router.post("/api/grades/import", upload.single("file"), async (req, res) => {
  try {
    const fileValidation = validateSpreadsheetUpload(req.file);
    if (!fileValidation.valid) {
      return res
        .status(fileValidation.status)
        .json({ error: fileValidation.error });
    }

    const { course_id, active_school_year_id, department_section_id } =
      req.body;

    if (!course_id || !active_school_year_id || !department_section_id) {
      return res
        .status(400)
        .json({ error: "Please Select a class to upload the file on" });
    }

    const workbook = readWorkbookSafely(req.file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(400).json({ error: "Spreadsheet has no worksheet" });
    }
    if (hasFormulaCell(sheet)) {
      return res
        .status(400)
        .json({ error: "Formulas are not allowed in uploads" });
    }

    // Start parsing headers from Row 3 (index 2)
    const { rows: parsedRows, truncatedByMaxRows } = getSheetRowsWithLimits(
      sheet,
      {
        sheetToJsonOptions: { range: 2, defval: "" },
      },
    );
    const { cleanRows, flaggedRows } = removeFormulaLikeRows(parsedRows);
    const { validRows, skippedMissingMandatory } =
      filterRowsWithMandatoryColumns(cleanRows, ["student number"]);
    const { rowsToInsert } = prepareRowsForInsert(validRows, req.file.size);

    const studentNumbers = rowsToInsert
      .map((r) => String(r["Student Number"]))
      .filter((n) => n && n !== "undefined");

    if (studentNumbers.length === 0) {
      return res.status(400).json({ error: "No valid student numbers" });
    }

    // 1. Database Validation (existing code is fine)
    const [existingStudents] = await db3.query(
      `SELECT student_number
            FROM enrolled_subject
            WHERE student_number IN (?)
              AND course_id = ?
              AND active_school_year_id = ?
              AND department_section_id = ?`,
      [studentNumbers, course_id, active_school_year_id, department_section_id],
    );

    if (existingStudents.length === 0) {
      return res
        .status(400)
        .json({ error: "No matching students found in database" });
    }

    const existingStudentNumbers = existingStudents.map(
      (s) => s.student_number,
    );
    // Dynamic conversion keeps Excel grade imports aligned with grade_conversion.
    const gradeConversions = await getGradeConversions();
    let skippedCount = 0;

    // 2. Processing and Updating Grades
    await withTransaction(db3, async (conn) => {
      await processInBatches(
        rowsToInsert,
        async (batch) => {
          for (const row of batch) {
            const studentNumber = String(row["Student Number"]);

            if (!existingStudentNumbers.includes(studentNumber)) {
              skippedCount++;
              continue;
            }

            let midterm = row["Midterm"];
            let finals = row["Finals"];
            let en_remarks = 0;
            let finalGradeValue;
            let gradesStatus = null;

            const rawMidtermStr = String(midterm || "")
              .trim()
              .toUpperCase();
            const rawFinalsStr = String(finals || "")
              .trim()
              .toUpperCase();

            if (rawMidtermStr === "INC" || rawFinalsStr === "INC") {
              en_remarks = 3;
              finalGradeValue = "0.00";
              gradesStatus = "INC";
            } else if (
              rawMidtermStr === "DRP" ||
              rawMidtermStr === "DROP" ||
              rawFinalsStr === "DRP" ||
              rawFinalsStr === "DROP"
            ) {
              const dropValue = "DRP";
              en_remarks = 4;
              midterm = dropValue;
              finals = dropValue;
              finalGradeValue = dropValue;
              gradesStatus = "DRP";
            } else {
              let numericMidterm = parseInt(rawMidtermStr, 10);
              let numericFinals = parseInt(rawFinalsStr, 10);
              if (isNaN(numericMidterm)) numericMidterm = 0;
              if (isNaN(numericFinals)) numericFinals = 0;

              finalGradeValue = numericFinals;
              const finalsOutcome = deriveRemarkAndStatusFromNumeric(
                numericFinals,
                gradeConversions,
              );
              const midtermOutcome = deriveRemarkAndStatusFromNumeric(
                numericMidterm,
                gradeConversions,
              );

              if (
                finalsOutcome.enRemark === 2 ||
                midtermOutcome.enRemark === 2
              ) {
                en_remarks = 2;
              } else if (finalsOutcome.enRemark === 1) {
                en_remarks = 1;
              } else {
                en_remarks = 0;
              }

              midterm = String(numericMidterm);
              finals = String(numericFinals);
              finalGradeValue = String(finalGradeValue);
            }

            await conn.query(
              `UPDATE enrolled_subject
                      SET midterm = ?, finals = ?, final_grade = ?, en_remarks = ?, grades_status = ?
                      WHERE student_number = ?
                        AND course_id = ?
                        AND active_school_year_id = ?
                        AND department_section_id = ?`,
              [
                midterm,
                finals,
                finalGradeValue,
                en_remarks,
                gradesStatus,
                studentNumber,
                course_id,
                active_school_year_id,
                department_section_id,
              ],
            );
          }
        },
        XLSX_IMPORT_LIMITS.BATCH_SIZE,
      );
    });

    res.json({
      success: true,
      message: `Grades updated successfully! Skipped: ${skippedCount} students.`,
      warnings: {
        truncatedByMaxRows,
        skippedMissingMandatory,
        formulaRowsRemoved: flaggedRows,
      },
    });
  } catch (err) {
    console.error("❌ Excel import error:", err);
    res.status(500).json({ error: "Failed to import Excel" });
  }
});

router.post("/api/import-xlsx", upload.single("file"), async (req, res) => {
  const { campus } = req.body;
  const connection = await db3.getConnection();

  try {
    await connection.beginTransaction();

    const fileValidation = validateSpreadsheetUpload(req.file);
    if (!fileValidation.valid) {
      await connection.rollback();
      connection.release();
      return res
        .status(fileValidation.status)
        .json({ error: fileValidation.error });
    }

    const workbook = readWorkbookSafely(req.file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "Spreadsheet has no worksheet" });
    }
    if (hasFormulaCell(sheet)) {
      await connection.rollback();
      connection.release();
      return res
        .status(400)
        .json({ error: "Formulas are not allowed in uploads" });
    }

    const { rows: parsedRows, truncatedByMaxRows } = getSheetRowsWithLimits(
      sheet,
      {
        sheetToJsonOptions: {
          header: "A",
          defval: "",
          raw: false,
          blankrows: false,
        },
      },
    );

    const { cleanRows, flaggedRows } = removeFormulaLikeRows(parsedRows);
    const { rowsToInsert } = prepareRowsForInsert(cleanRows, req.file.size);

    const metadata = {};
    for (const row of rowsToInsert) {
      if (
        String(row.A || "")
          .trim()
          .toLowerCase()
          .includes("subject code")
      )
        break;
      if (row.A) {
        const key = String(row.A).trim().replace(":", "");
        const value = row.B ? String(row.B).trim() : "";
        metadata[key] = value;
      }
    }

    const studentNumber = metadata["Student No."] || metadata["Student No"];
    const studentName = metadata["Name"];
    const program_code = metadata["Program"];
    const curriculum_raw = metadata["Curriculum"];
    const year_description = curriculum_raw
      ? curriculum_raw.split("-")[0].trim()
      : null;

    if (!studentNumber || !program_code || !year_description) {
      await connection.rollback();
      connection.release();
      return res
        .status(400)
        .json({ error: "Missing required metadata from Excel" });
    }

    // Validate NSTP variants early so no DB write happens when component is invalid.
    const invalidNstpComponents = [];
    let detectedSemester = null;
    for (const row of rowsToInsert) {
      const text = String(row.A || "").trim();

      if (/^School Year/i.test(text)) {
        if (/first semester/i.test(text)) detectedSemester = "First Semester";
        else if (/second semester/i.test(text))
          detectedSemester = "Second Semester";
        else if (/summer/i.test(text)) detectedSemester = "Summer";
        else detectedSemester = null;
        continue;
      }

      if (!detectedSemester || !row.A || /^Subject Code/i.test(text)) continue;

      const importedCourseCode = normalizeImportedCourseCode(row.A);
      const nstp = transformNstpSubject(importedCourseCode, detectedSemester);
      if (
        nstp.isNstp &&
        (nstp.hasUnknownComponentKeyword ||
          (nstp.hasKnownComponentKeyword && nstp.component === 0))
      ) {
        invalidNstpComponents.push({
          detected_course_code: importedCourseCode,
          semester: detectedSemester,
        });
      }
    }

    if (invalidNstpComponents.length > 0) {
      await connection.rollback();
      connection.release();
      const uniqueInvalid = [
        ...new Map(
          invalidNstpComponents.map((item) => [
            `${item.detected_course_code}__${item.semester}`,
            item,
          ]),
        ).values(),
      ];

      return res.status(400).json({
        error:
          "Upload failed. Detected NSTP course code has an unsupported component tag.",
        warning:
          "Please use only NSTP component tags: CWTS/CTWS, LTS, or MTS. Generic NSTP codes are allowed but will not set a component.",
        invalid_nstp_components: uniqueInvalid,
      });
    }

    // Resolve person_id and ensure person record exists
    const { lastName, firstName, middleName } =
      parseStudentNameLegacy(studentName);
    let person_id = null;
    let isNewStudent = false;

    // Check if student number already exists
    const [existingStudentRows] = await connection.query(
      `SELECT person_id FROM student_numbering_table WHERE student_number = ? LIMIT 1`,
      [studentNumber],
    );

    // Existing student number - update person details
    if (existingStudentRows.length > 0) {
      person_id = existingStudentRows[0].person_id;
      await connection.query(
        `UPDATE person_table
         SET campus = ?, last_name = ?, first_name = ?, middle_name = ?
         WHERE person_id = ?`,
        [campus, lastName, firstName, middleName, person_id],
      );
    } else {
      isNewStudent = true;

      const [[existingPerson]] = await connection.query(
        `SELECT person_id
         FROM person_table
         WHERE campus = ?
           AND UPPER(TRIM(last_name)) = UPPER(TRIM(?))
           AND UPPER(TRIM(first_name)) = UPPER(TRIM(?))
           AND (
             UPPER(TRIM(middle_name)) = UPPER(TRIM(?))
             OR (? IS NULL AND middle_name IS NULL)
             OR (? = '' AND (middle_name IS NULL OR middle_name = ''))
           )
         LIMIT 1`,
        [campus, lastName, firstName, middleName, middleName, middleName],
      );

      // If a person record matches the name + campus, link student number to that person_id
      // Else, create a new person record and link student number to the new person_id
      if (existingPerson) {
        person_id = existingPerson.person_id;
      } else {
        const [personInsert] = await connection.query(
          `INSERT INTO person_table (campus, last_name, first_name, middle_name)
           VALUES (?, ?, ?, ?)`,
          [campus, lastName, firstName, middleName],
        );
        person_id = personInsert.insertId;
        console.log(`✓ Created new person: person_id: ${person_id}`);
      }

      // Link student number to person_id
      // Using INSERT IGNORE to handle race conditions gracefully
      const [insertResult] = await connection.query(
        `INSERT INTO student_numbering_table (student_number, person_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE person_id = person_id`,
        [studentNumber, person_id],
      );

      // If no rows were inserted (duplicate detected), fetch the existing person_id
      if (insertResult.affectedRows === 0) {
        const [[recheckStudent]] = await connection.query(
          `SELECT person_id FROM student_numbering_table WHERE student_number = ? LIMIT 1`,
          [studentNumber],
        );
        if (recheckStudent) {
          person_id = recheckStudent.person_id;
          console.log(
            `⚠️ Race condition detected - using existing person_id: ${person_id}`,
          );
        }
      } else {
        console.log(
          `✓ Linked student number ${studentNumber} to person_id: ${person_id}`,
        );
      }
    }

    if (!person_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "Failed to resolve person_id" });
    }

    const [checkPersonStatus] = await connection.query(
      `SELECT person_id FROM person_status_table WHERE person_id = ? LIMIT 1`,
      [person_id],
    );

    console.log(
      `[DEBUG] person_id ${person_id} status record exists: ${checkPersonStatus.length > 0}`,
    );

    if (checkPersonStatus.length > 0) {
      await connection.query(
        `UPDATE person_status_table SET student_registration_status = 1 WHERE person_id = ?`,
        [person_id],
      );
    } else {
      await connection.query(
        `INSERT INTO person_status_table (person_id, student_registration_status)
        VALUES (?, ?)`,
        [person_id, 1],
      );
    }

    // --- Step 3: DB lookups for program/year/curriculum ---
    const [[yearRow]] = await connection.query(
      "SELECT year_id FROM year_table WHERE year_description = ?",
      [year_description],
    );

    if (!yearRow) {
      await connection.rollback();
      connection.release();
      return res
        .status(400)
        .json({ error: `Year ${year_description} not found` });
    }

    const [[program]] = await connection.query(
      "SELECT program_id FROM program_table WHERE program_code = ?",
      [program_code],
    );
    if (!program) {
      await connection.rollback();
      connection.release();
      return res
        .status(400)
        .json({ error: `Program code ${program_code} not found` });
    }

    const [[curriculum]] = await connection.query(
      "SELECT curriculum_id FROM curriculum_table WHERE year_id = ? AND program_id = ?",
      [yearRow.year_id, program.program_id],
    );
    if (!curriculum) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "No matching curriculum found" });
    }

    // --- Step 4: Process each School Year + Semester block ---
    // Dynamic conversion keeps legacy transcript imports aligned with grade_conversion.
    const gradeConversions = await getGradeConversions();
    const results = [];
    const resultBlockMap = new Map();
    const duplicateSubjectWarnings = [];
    let currentSY = null;
    let subjects = [];
    const subjectMap = new Map();

    const hasImportGradeValue = (subject) => {
      return !(
        subject.final_grade === 0 ||
        subject.final_grade === 0.0 ||
        subject.final_grade === null ||
        subject.final_grade === undefined ||
        subject.en_remark === 5
      );
    };

    const pushCurrentSubjectBlock = () => {
      if (!currentSY || subjects.length === 0) {
        subjects = [];
        return;
      }

      const blockKey = [
        currentSY.normalizedSchoolYear,
        currentSY.normalizedSemester,
      ].join("|");

      let targetBlock = resultBlockMap.get(blockKey);
      if (!targetBlock) {
        targetBlock = { ...currentSY, subjects: [] };
        resultBlockMap.set(blockKey, targetBlock);
        results.push(targetBlock);
      }

      for (const subject of subjects) {
        const targetIndex = targetBlock.subjects.length;
        targetBlock.subjects.push(subject);

        const subjectRecord = subjectMap.get(subject.__importSubjectKey);
        if (subjectRecord?.subject === subject) {
          subjectRecord.index = targetIndex;
          subjectRecord.blockKey = blockKey;
        }
      }

      subjects = [];
    };

    const addSubjectToCurrentBlock = (subject, rowNumber) => {
      const subjectKey = [
        currentSY.normalizedSchoolYear,
        currentSY.normalizedSemester,
        subject.course_code,
        subject.component || 0,
      ].join("|");

      const existing = subjectMap.get(subjectKey);
      if (!existing) {
        subject.__importSubjectKey = subjectKey;
        subjectMap.set(subjectKey, {
          subject,
          index: subjects.length,
          rowNumber,
        });
        subjects.push(subject);
        return;
      }

      const existingHasGrade = hasImportGradeValue(existing.subject);
      const incomingHasGrade = hasImportGradeValue(subject);
      const keptIncoming = !existingHasGrade && incomingHasGrade;

      if (keptIncoming) {
        subject.__importSubjectKey = subjectKey;

        if (existing.blockKey) {
          resultBlockMap.get(existing.blockKey).subjects[existing.index] =
            subject;
        } else {
          subjects[existing.index] = subject;
        }

        subjectMap.set(subjectKey, {
          subject,
          index: existing.index,
          rowNumber,
          blockKey: existing.blockKey,
        });
      }

      duplicateSubjectWarnings.push({
        schoolYear: currentSY.normalizedSchoolYear,
        semester: currentSY.normalizedSemester,
        courseCode: subject.course_code,
        component: subject.component || 0,
        keptRow: keptIncoming ? rowNumber : existing.rowNumber,
        skippedRow: keptIncoming ? existing.rowNumber : rowNumber,
        reason: keptIncoming
          ? "Duplicate subject found; kept the later row because it has a grade."
          : "Duplicate subject found; kept the first row.",
      });
    };

    for (const [rowIndex, row] of rowsToInsert.entries()) {
      const text = String(row.A || "").trim();

      if (/^School Year/i.test(text)) {
        pushCurrentSubjectBlock();

        const syMatch = text.match(/School Year:\s*(\d{4})-(\d{4})/i);
        const normalizedSchoolYear = syMatch ? syMatch[1] : null;

        let normalizedSemester = null;
        if (/first semester/i.test(text)) normalizedSemester = "First Semester";
        else if (/second semester/i.test(text))
          normalizedSemester = "Second Semester";
        else if (/summer/i.test(text)) normalizedSemester = "Summer";

        currentSY = { normalizedSchoolYear, normalizedSemester };
      } else if (currentSY && row.A && !/^Subject Code/i.test(text)) {
        const importedCourseCode = normalizeImportedCourseCode(row.A);
        const nstp = transformNstpSubject(
          importedCourseCode,
          currentSY.normalizedSemester,
        );
        const raw = String(row.D || "")
          .trim()
          .toUpperCase();
        const reExamGrade = String(row.E || "").trim();
        let finalGrade = 0.0;
        let enRemark = 0;
        let status = 0;
        let gradeStatus = null;

        if (!raw || ["", "-", "N/A", "NA"].includes(raw)) {
          enRemark = 5;
        } else if (["CE", "CURRENTLY ENROLLED"].includes(raw)) {
          finalGrade = 0;
          enRemark = 0;
          status = 0;
        } else if (["INC", "INCOMPLETE"].includes(raw)) {
          enRemark = 3;
          finalGrade = "INC";
        } else if (["DRP", "DROP", "DROPPED"].includes(raw)) {
          enRemark = 4;
          finalGrade = "DRP";
          gradeStatus = "DRP";
        } else {
          const gradeNum = parseFloat(raw);

          if (!isNaN(gradeNum)) {
            const gradeOutcome = deriveLegacyImportOutcome(
              gradeNum,
              gradeConversions,
            );
            finalGrade = gradeOutcome.storedNumericGrade;
            enRemark = gradeOutcome.enRemark;
            status = gradeOutcome.status;
          } else {
            enRemark = 6;
          }
        }

        if (reExamGrade) {
          gradeStatus = reExamGrade;

          const normalizedReExam = reExamGrade.toUpperCase();
          const reExamNumeric = parseFloat(normalizedReExam);

          if (!isNaN(reExamNumeric)) {
            const reExamOutcome = deriveLegacyImportOutcome(
              reExamNumeric,
              gradeConversions,
            );
            enRemark = reExamOutcome.enRemark;
            status = reExamOutcome.status;
          } else if (["INC", "INCOMPLETE"].includes(normalizedReExam)) {
            enRemark = 3;
          } else if (["DRP", "DROP", "DROPPED"].includes(normalizedReExam)) {
            enRemark = 4;
            gradeStatus = "DRP";
          }
        }

        addSubjectToCurrentBlock({
          course_code: nstp.courseCode,
          description: row.B || "",
          units: row.C || 0,
          final_grade: finalGrade,
          en_remark: enRemark,
          status,
          grade_status: gradeStatus,
          component: nstp.component,
          nstp_normalized_source: nstp.normalizedSource,
        }, rowIndex + 1);
      }
    }

    // Push last block if exists
    pushCurrentSubjectBlock();

    // Validate all course codes exist
    const allCourseCodes = [];

    for (const block of results) {
      for (const subj of block.subjects) {
        const code = String(subj.course_code || "").trim();
        if (!code) {
          allCourseCodes.push("(blank course code)");
        } else {
          allCourseCodes.push(code);
        }
      }
    }

    const uniqueCodes = [
      ...new Set(allCourseCodes.filter((c) => c !== "(blank course code)")),
    ];

    if (uniqueCodes.length > 0) {
      const [existingCourses] = await connection.query(
        `SELECT course_code FROM course_table WHERE course_code IN (?)`,
        [uniqueCodes],
      );

      const existingCodesSet = new Set(
        existingCourses.map((c) => c.course_code),
      );

      const missingCourseCodes = allCourseCodes.filter(
        (code) => code === "(blank course code)" || !existingCodesSet.has(code),
      );

      console.log("missing course codes", missingCourseCodes);

      if (missingCourseCodes.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          error: "Upload failed. Some course codes do not exist.",
          missing_course_codes: [...new Set(missingCourseCodes)],
        });
      }
    }

    // --- Step 5: Count completed semesters and collect all semesters for status table ---
    let latestOngoing = null;
    const completedBySchoolYear = {};

    // Place 1 guard: only First/Second Semester affect year level progression and allNonOngoingSemesters
    const allNonOngoingSemesters = []; // First + Second Sem only (non-ongoing)
    const allSummerSemesters = []; // Summer only (non-ongoing)

    for (const block of results) {
      const { normalizedSchoolYear, normalizedSemester, subjects } = block;

      // Handle Summer separately — excluded from Place 1 and Place 2 guards
      if (normalizedSemester === "Summer") {
        if (subjects.length > 0) {
          const isOngoingSummer = subjects.every(
            (s) => s.final_grade === 0 && s.en_remark === 0,
          );
          if (!isOngoingSummer) {
            allSummerSemesters.push({
              schoolYear: normalizedSchoolYear,
              semester: normalizedSemester,
            });
          } else {
            latestOngoing = {
              schoolYear: normalizedSchoolYear,
              semester: normalizedSemester,
            };
          }
        }
        continue; // still excluded from Place 1 guard below
      }

      // Place 1 guard: only First Semester and Second Semester past this point
      if (!["First Semester", "Second Semester"].includes(normalizedSemester))
        continue;

      const isOngoing = subjects.every(
        (s) => s.final_grade === 0 && s.en_remark === 0,
      );

      if (isOngoing) {
        latestOngoing = {
          schoolYear: normalizedSchoolYear,
          semester: normalizedSemester,
        };
        continue;
      }

      if (subjects.length > 0) {
        // Track every non-ongoing First/Second Semester for student_status_table
        allNonOngoingSemesters.push({
          schoolYear: normalizedSchoolYear,
          semester: normalizedSemester,
        });

        // Place 2 guard: only increment year level if at least one subject was passed
        const hasAtLeastOnePassed = subjects.some((s) => s.en_remark === 1);

        if (hasAtLeastOnePassed) {
          if (!completedBySchoolYear[normalizedSchoolYear]) {
            completedBySchoolYear[normalizedSchoolYear] = new Set();
          }
          completedBySchoolYear[normalizedSchoolYear].add(normalizedSemester);
        }
      }
    }

    const sortedSchoolYears = Object.keys(completedBySchoolYear).sort();
    let runningYearLevel = 0;

    const yearLevelPerSY = [];

    for (const sy of sortedSchoolYears) {
      const completedSemCount = completedBySchoolYear[sy].size;

      if (completedSemCount > 0) {
        runningYearLevel++;
        yearLevelPerSY.push({
          schoolYear: sy,
          yearLevel: runningYearLevel,
          semesters: [...completedBySchoolYear[sy]],
        });
      }
    }

    // Build semesterYearLevelMap for First/Second Sem entries
    // Semester ordering for chronological sort
    const semesterOrder = {
      "First Semester": 1,
      "Second Semester": 2,
      Summer: 3,
    };

    const semesterYearLevelMap = {};

    // Populate progressing semesters first
    for (const entry of yearLevelPerSY) {
      for (const sem of entry.semesters) {
        semesterYearLevelMap[`${entry.schoolYear}__${sem}`] = entry.yearLevel;
      }
    }

    // Sort all non-ongoing First/Second Sem chronologically
    const sortedAllSemesters = [...allNonOngoingSemesters].sort((a, b) => {
      if (a.schoolYear !== b.schoolYear)
        return a.schoolYear.localeCompare(b.schoolYear);
      return (
        (semesterOrder[a.semester] || 0) - (semesterOrder[b.semester] || 0)
      );
    });

    // Walk chronologically to assign inherited year levels to non-progressing semesters
    let trackingYearLevel = 0;
    for (const { schoolYear, semester } of sortedAllSemesters) {
      const key = `${schoolYear}__${semester}`;
      if (semesterYearLevelMap[key] !== undefined) {
        // Already resolved (progressed year level) — update tracker
        trackingYearLevel = semesterYearLevelMap[key];
      } else {
        // Did not progress — inherit last known year level (minimum 1)
        semesterYearLevelMap[key] = Math.max(trackingYearLevel, 1);
      }
    }

    // Now resolve Summer year levels by merging and sorting all semesters together
    // Summer sits after Second Semester of the same school year (order = 3)
    const sortedAllSemestersWithSummer = [
      ...sortedAllSemesters,
      ...allSummerSemesters,
    ].sort((a, b) => {
      if (a.schoolYear !== b.schoolYear)
        return a.schoolYear.localeCompare(b.schoolYear);
      return (
        (semesterOrder[a.semester] || 0) - (semesterOrder[b.semester] || 0)
      );
    });

    // Walk again with Summer included — Summer inherits the last known year level
    let trackingYearLevelWithSummer = 0;
    for (const { schoolYear, semester } of sortedAllSemestersWithSummer) {
      const key = `${schoolYear}__${semester}`;
      if (semesterYearLevelMap[key] !== undefined) {
        // Already resolved (First/Second Sem) — just update tracker
        trackingYearLevelWithSummer = semesterYearLevelMap[key];
      } else {
        // Summer — inherit last known year level (minimum 1)
        semesterYearLevelMap[key] = Math.max(trackingYearLevelWithSummer, 1);
      }
    }

    const targetActiveSchoolYearIds = new Set();

    for (const block of results) {
      const { normalizedSchoolYear, normalizedSemester } = block;

      if (!normalizedSchoolYear || !normalizedSemester) continue;

      const [[schoolYearRow]] = await connection.query(
        "SELECT year_id FROM year_table WHERE year_description = ?",
        [normalizedSchoolYear],
      );
      if (!schoolYearRow) continue;

      const [[semesterRow]] = await connection.query(
        "SELECT semester_id FROM semester_table WHERE semester_description = ?",
        [normalizedSemester],
      );
      if (!semesterRow) continue;

      const [[activeYear]] = await connection.query(
        "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ?",
        [schoolYearRow.year_id, semesterRow.semester_id],
      );
      if (!activeYear) continue;

      targetActiveSchoolYearIds.add(activeYear.id);
    }

    if (targetActiveSchoolYearIds.size > 0) {
      const activeSchoolYearIds = [...targetActiveSchoolYearIds];

      const [existingEnrolledRows] = await connection.query(
        `SELECT 1
         FROM enrolled_subject
         WHERE student_number = ?
           AND active_school_year_id IN (?) 
         LIMIT 1`,
        [studentNumber, activeSchoolYearIds],
      );

      if (existingEnrolledRows.length > 0) {
        await connection.query(
          `DELETE FROM enrolled_subject
           WHERE student_number = ?
             AND active_school_year_id IN (?)`,
          [studentNumber, activeSchoolYearIds],
        );
      }

      const [existingStatusRows] = await connection.query(
        `SELECT 1
         FROM student_status_table
         WHERE student_number = ?
           AND active_school_year_id IN (?)
         LIMIT 1`,
        [studentNumber, activeSchoolYearIds],
      );

      if (existingStatusRows.length > 0) {
        await connection.query(
          `DELETE FROM student_status_table
           WHERE student_number = ?
             AND active_school_year_id IN (?)`,
          [studentNumber, activeSchoolYearIds],
        );
      }
    }

    // --- Step 6: Insert fresh records per block ---
    let totalInserted = 0,
      totalUpdated = 0;

    for (const block of results) {
      const { normalizedSchoolYear, normalizedSemester, subjects } = block;

      if (!normalizedSchoolYear || !normalizedSemester) continue;

      const [[schoolYearRow]] = await connection.query(
        "SELECT year_id FROM year_table WHERE year_description = ?",
        [normalizedSchoolYear],
      );
      if (!schoolYearRow) continue;

      const [[semesterRow]] = await connection.query(
        "SELECT semester_id FROM semester_table WHERE semester_description = ?",
        [normalizedSemester],
      );
      if (!semesterRow) continue;

      const [[activeYear]] = await connection.query(
        "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ?",
        [schoolYearRow.year_id, semesterRow.semester_id],
      );
      if (!activeYear) continue;

      const active_school_year_id = activeYear.id;
      console.log("Active School Year:", active_school_year_id);

      for (const subj of subjects) {
        if (!subj.course_code) continue;

        const [[course]] = await connection.query(
          "SELECT course_id FROM course_table WHERE UPPER(TRIM(course_code)) = UPPER(TRIM(?))",
          [subj.course_code],
        );
        if (!course) continue;

        await connection.query(
          `INSERT INTO enrolled_subject
            (student_number, curriculum_id, course_id, component, active_school_year_id,
             midterm, finals, final_grade, en_remarks, grades_status, department_section_id, status, fe_status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            studentNumber,
            curriculum.curriculum_id,
            course.course_id,
            subj.component || 0,
            active_school_year_id,
            0,
            0,
            subj.final_grade,
            subj.en_remark,
            subj.grade_status,
            req.body.department_section_id || 0,
            1,
            0,
            "migrated from old system",
          ],
        );
        totalInserted++;
      }
    }

    // --- Step 7: Update student year level per semester ---
    // Iterates ALL non-ongoing semesters including Summer
    for (const { schoolYear, semester } of sortedAllSemestersWithSummer) {
      const key = `${schoolYear}__${semester}`;
      const yearLevel = semesterYearLevelMap[key];

      if (!yearLevel) continue;

      const [[schoolYearRow]] = await connection.query(
        "SELECT year_id FROM year_table WHERE year_description = ?",
        [schoolYear],
      );
      if (!schoolYearRow) continue;

      const [[semesterRow]] = await connection.query(
        "SELECT semester_id FROM semester_table WHERE semester_description = ?",
        [semester],
      );
      if (!semesterRow) continue;

      const [[activeSY]] = await connection.query(
        `SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ?`,
        [schoolYearRow.year_id, semesterRow.semester_id],
      );
      if (!activeSY) continue;

      const [existingStatus] = await connection.query(
        `SELECT id FROM student_status_table
         WHERE student_number = ? AND active_curriculum = ? AND year_level_id = ? AND active_school_year_id = ?`,
        [studentNumber, curriculum.curriculum_id, yearLevel, activeSY.id],
      );

      if (existingStatus.length > 0) {
        await connection.query(
          `UPDATE student_status_table
           SET enrolled_status = 1
           WHERE id = ?`,
          [existingStatus[0].id],
        );
        console.log(
          `✓ Updated student_status_table for student_number ${studentNumber}, year level ${yearLevel}, school year ${schoolYear} (${semester})`,
        );
      } else {
        await connection.query(
          `INSERT INTO student_status_table
           (student_number, active_curriculum, enrolled_status, year_level_id, active_school_year_id)
           VALUES (?, ?, ?, ?, ?)`,
          [studentNumber, curriculum.curriculum_id, 1, yearLevel, activeSY.id],
        );
        console.log(
          `✓ Inserted student_status_table for student_number ${studentNumber}, year level ${yearLevel}, school year ${schoolYear} (${semester})`,
        );
      }
    }

    // Handle ongoing semester
    if (latestOngoing) {
      const [[schoolYearRow]] = await connection.query(
        "SELECT year_id FROM year_table WHERE year_description = ?",
        [latestOngoing.schoolYear],
      );

      const [[semesterRow]] = await connection.query(
        "SELECT semester_id FROM semester_table WHERE semester_description = ?",
        [latestOngoing.semester],
      );

      if (schoolYearRow && semesterRow) {
        const [[activeSY]] = await connection.query(
          "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ?",
          [schoolYearRow.year_id, semesterRow.semester_id],
        );

        if (activeSY) {
          const currentSchoolYearLevel = yearLevelPerSY.find(
            (entry) => entry.schoolYear === latestOngoing.schoolYear,
          )?.yearLevel;
          const ongoingYearLevel =
            currentSchoolYearLevel || Math.max(runningYearLevel + 1, 1);

          const [existingStatus] = await connection.query(
            `SELECT id FROM student_status_table
             WHERE student_number = ? AND active_curriculum = ? AND year_level_id = ? AND active_school_year_id = ?`,
            [
              studentNumber,
              curriculum.curriculum_id,
              ongoingYearLevel,
              activeSY.id,
            ],
          );

          if (existingStatus.length > 0) {
            await connection.query(
              `UPDATE student_status_table
               SET enrolled_status = 1
               WHERE id = ?`,
              [existingStatus[0].id],
            );
            console.log(
              `✓ Updated ongoing semester: student_number ${studentNumber}, year level ${ongoingYearLevel}, school year ${latestOngoing.schoolYear} (${latestOngoing.semester})`,
            );
          } else {
            await connection.query(
              `INSERT INTO student_status_table
               (student_number, active_curriculum, enrolled_status, year_level_id, active_school_year_id)
               VALUES (?, ?, ?, ?, ?)`,
              [
                studentNumber,
                curriculum.curriculum_id,
                1,
                ongoingYearLevel,
                activeSY.id,
              ],
            );
            console.log(
              `✓ Inserted ongoing semester: student_number ${studentNumber}, year level ${ongoingYearLevel}, school year ${latestOngoing.schoolYear} (${latestOngoing.semester})`,
            );
          }
        }
      }
    }

    // Commit transaction
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      updated: totalUpdated,
      inserted: totalInserted,
      studentNumber,
      person_id,
      isNewStudent,
      program_code,
      year_description,
      highestYearLevel: runningYearLevel,
      warnings: {
        truncatedByMaxRows,
        formulaRowsRemoved: flaggedRows,
        duplicateSubjectsSkipped: duplicateSubjectWarnings,
      },
    });
  } catch (err) {
    console.error("❌ Excel import error:", err);

    try {
      await connection.rollback();
      connection.release();
    } catch (rollbackErr) {
      console.error("❌ Rollback error:", rollbackErr);
    }

    res.status(500).json({
      error: "Failed to import Excel",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

router.post("/api/qualifying_exam/import", async (req, res) => {
  try {
    const rows = Array.isArray(req.body.data) ? req.body.data : [];

    if (!rows.length) {
      return res.status(400).json({ success: false, error: "No rows found" });
    }

    const applicantNumbers = rows
      .map((r) => r.applicant_number)
      .filter(Boolean);
    if (!applicantNumbers.length) {
      return res
        .status(400)
        .json({ success: false, error: "No valid applicant numbers" });
    }

    const [matches] = await db.query(
      `SELECT person_id, applicant_number
       FROM applicant_numbering_table
       WHERE applicant_number IN (?)`,
      [applicantNumbers],
    );

    const applicantMap = {};
    matches.forEach((m) => {
      applicantMap[m.applicant_number] = m.person_id;
    });

    const personStatusValues = [];
    const statusMap = {};
    for (const row of rows) {
      const personId = applicantMap[row.applicant_number];
      if (!personId) continue;

      const qExam = Number(row.qualifying_exam_score) || 0;
      const qInterview = Number(row.qualifying_interview_score) || 0;
      const status = row.status ? row.status.trim() : "Waiting List";

      personStatusValues.push([personId, qExam, qInterview]);
      statusMap[row.applicant_number] = status;
    }

    if (!personStatusValues.length) {
      return res
        .status(400)
        .json({ success: false, error: "No valid data to import" });
    }

    await db.query(
      `INSERT INTO person_status_table
        (person_id, qualifying_result, interview_result)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         qualifying_result = VALUES(qualifying_result),
         interview_result = VALUES(interview_result)`,
      [personStatusValues],
    );

    const applicantIds = Object.keys(statusMap);
    if (applicantIds.length > 0) {
      const cases = applicantIds
        .map((a) => `WHEN '${a}' THEN '${statusMap[a]}'`)
        .join(" ");
      await db.query(
        `UPDATE interview_applicants
         SET status = CASE applicant_id ${cases} END
         WHERE applicant_id IN (?)`,
        [applicantIds],
      );
    }

    const [registrarRows] = await db3.query(
      "SELECT last_name, first_name, middle_name, email FROM user_accounts WHERE role = 'registrar' LIMIT 1",
    );
    const registrar = registrarRows[0];
    const registrarEmail = registrar?.email || "earistmis@gmail.com";
    const registrarFullName = registrar
      ? `${registrar.last_name}, ${registrar.first_name} ${registrar.middle_name || ""}`.trim()
      : "Registrar";

    const message = `📊 Bulk Qualifying/Interview Exam Scores uploaded by ${registrarFullName}`;
    await db.query(
      "INSERT INTO notifications (type, message, applicant_number, actor_email, actor_name, timestamp) VALUES (?, ?, ?, ?, ?, NOW())",
      ["upload", message, null, registrarEmail, registrarFullName],
    );

    (req.app.get("io") || { emit: () => {} }).emit("notification", {
      type: "upload",
      message,
      applicant_number: null,
      actor_email: registrarEmail,
      actor_name: registrarFullName,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: "Excel imported successfully!" });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
