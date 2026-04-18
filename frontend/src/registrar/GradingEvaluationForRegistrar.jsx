import { Box, Typography, TextField, Snackbar, Alert, Autocomplete } from "@mui/material";
import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import EaristLogo from "../assets/EaristLogo.png";
import { Search } from "@mui/icons-material";
import axios from "axios";
import { FcPrint } from "react-icons/fc";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";

const ProgramEvaluationForRegistrar = () => {
  const settings = useContext(SettingsContext);
  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");
  const [stepperColor, setStepperColor] = useState("#000000");

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  // ── Grade conversion table fetched from backend ──────────────────────────
  const [gradeConversion, setGradeConversion] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/grade-conversion`)
      .then((res) => setGradeConversion(res.data))
      .catch((err) => {
        console.error("Failed to fetch grade conversions:", err);
        setGradeConversion([]);
      });
  }, []);

  // ── Convert a stored final_grade value to its display equivalent ─────────
  // Returns "" for null / undefined / 0 / "0" / "0.00"
  // Returns "INC" / "DRP" as-is
  // If the value is between 1–5 (rating scale), returns it formatted directly
  // Otherwise looks up in gradeConversion min_score/max_score table
  const handleGradeConversion = (grade) => {
    if (grade === null || grade === undefined || grade === "") return "";

    const normalizedGrade = String(grade).trim().toUpperCase();

    // Zero in any form → blank (currently enrolled / no grade yet)
    if (normalizedGrade === "0" || Number(normalizedGrade) === 0) return "";

    if (normalizedGrade === "INC") return "INC";
    if (normalizedGrade === "DROP" || normalizedGrade === "DRP") return "DRP";

    const numericGrade = Number(normalizedGrade);
    if (Number.isNaN(numericGrade)) return grade;

    // Already on the 1.0–5.0 rating scale — return as-is formatted
    if (numericGrade > 0 && numericGrade <= 5) {
      return Number.isInteger(numericGrade)
        ? String(numericGrade)
        : numericGrade.toFixed(2);
    }

    // Raw percentage — look up in conversion table
    const matchedConversion = gradeConversion.find((row) => {
      const minScore = Number(row.min_score);
      const maxScore = Number(row.max_score);
      return (
        Number.isFinite(minScore) &&
        Number.isFinite(maxScore) &&
        numericGrade >= minScore &&
        numericGrade <= maxScore
      );
    });

    if (!matchedConversion?.equivalent_grade) return grade;

    const equivalentGrade = Number(matchedConversion.equivalent_grade);
    return Number.isNaN(equivalentGrade)
      ? matchedConversion.equivalent_grade
      : equivalentGrade.toFixed(2);
  };

  // ── Sanitize grade input — only allow digits, one decimal point, INC, DRP ─
  const sanitizeGradeInput = (value) => {
    if (!value) return value;

    const upper = String(value).toUpperCase();

    // Allow INC / DRP keywords as typed
    if (upper === "INC" || upper === "DRP") return upper;

    // Allow partial typing of keywords
    if ("INC".startsWith(upper) || "DRP".startsWith(upper)) return upper;

    // Strip everything that is not a digit or decimal point
    const stripped = upper.replace(/[^0-9.]/g, "");

    // Only one decimal point allowed
    const parts = stripped.split(".");
    if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");

    return stripped;
  };

  // ── Allowed grade options — same as GradingSheet ─────────────────────────
  const gradeOptions = [
    ...Array.from({ length: 41 }, (_, i) => String(100 - i)), // "100" down to "60"
    "INC",
    "DRP",
  ];

  // ── Validate/clamp a grade value on blur or Enter ─────────────────────────
  const validateGradeInput = (rawValue) => {
    if (rawValue === null || rawValue === undefined) return "";

    let value = String(rawValue).trim().toUpperCase();

    if (/^INC/.test(value)) return "INC";
    if (/^DRP/.test(value)) return "DRP";

    // Gibberish letters → minimum passing
    if (/^[A-Z]+$/.test(value)) return "60";

    // Parse as float first to handle decimals like "99.99" → 99
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return "60";

    // Truncate to integer — no decimals allowed in grade column
    let num = Math.trunc(parsed);
    if (num > 100) num = 100;
    if (num < 60) num = 60;

    return String(num);
  };

  // ── Autocomplete dropdown grade selector — mirrors GradingSheet ───────────
  const GradeSelect = ({ value, onChange, disabled = false }) => {
    const [inputValue, setInputValue] = React.useState(value ?? "");

    useEffect(() => {
      setInputValue(value ?? "");
    }, [value]);

    return (
      <Autocomplete
        freeSolo
        disableClearable
        disabled={disabled}
        options={gradeOptions}
        inputValue={inputValue}
        value={inputValue}
        onInputChange={(event, newInputValue, reason) => {
          if (reason === "input") {
            setInputValue(newInputValue.toUpperCase());
          }
        }}
        onChange={(event, newValue) => {
          if (newValue !== null) {
            const validated = validateGradeInput(newValue);
            setInputValue(validated);
            onChange(validated);
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            variant="outlined"
            onBlur={() => {
              const validated = validateGradeInput(inputValue);
              setInputValue(validated);
              onChange(validated);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const validated = validateGradeInput(inputValue);
                setInputValue(validated);
                onChange(validated);
              }
            }}
            sx={{ textAlign: "center", width: "90px" }}
          />
        )}
        sx={{
          "& .MuiAutocomplete-inputRoot": {
            textAlign: "center",
            fontSize: "0.85rem",
          },
        }}
      />
    );
  };

  useEffect(() => {
    if (!settings) return;

    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);

    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
  }, [settings]);

  const words = companyName.trim().split(" ");
  const middle = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, middle).join(" ");
  const secondLine = words.slice(middle).join(" ");

  useEffect(() => {
    if (settings && settings.address) {
      setCampusAddress(settings.address);
    }
  }, [settings]);

  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [studentData, setStudentData] = useState([]);
  const [studentNumber, setStudentNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentDetails, setStudentDetails] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [gradeEdits, setGradeEdits] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const pageId = 105;
  const [employeeID, setEmployeeID] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setUserID(storedID);
      setEmployeeID(storedEmployeeID);

      if (storedRole === "registrar") {
        checkAccess(storedEmployeeID);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const checkAccess = async (employeeID) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`
      );
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 9) {
      setSelectedStudent(null);
      setStudentData([]);
      return;
    }

    const fetchStudent = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/program_evaluation/${searchQuery}`
        );
        const data = await res.json();

        if (data) {
          setSelectedStudent(data);
          setStudentData(data);

          const detailsRes = await fetch(
            `${API_BASE_URL}/api/program_evaluation/details/${searchQuery}`
          );
          const detailsData = await detailsRes.json();
          if (Array.isArray(detailsData) && detailsData.length > 0) {
            setStudentDetails(detailsData);
          } else {
            setStudentDetails([]);
            setSnackbarMessage("No enrolled subjects found for this student.");
            setOpenSnackbar(true);
          }
        } else {
          setSelectedStudent(null);
          setStudentData([]);
          setStudentDetails([]);
          setSnackbarMessage("No student data found.");
          setOpenSnackbar(true);
        }
      } catch (err) {
        console.error("Error fetching student", err);
        setSnackbarMessage("Server error. Please try again.");
        setOpenSnackbar(true);
      }
    };

    fetchStudent();
  }, [searchQuery]);

  const handleGradeChange = async (courseId, value, studentNumber) => {
    // value already comes validated from GradeSelect's onChange
    setGradeEdits((prev) => ({ ...prev, [courseId]: value }));

    try {
      await axios.post(`${API_BASE_URL}/api/update-grade`, {
        final_grade: value,
        student_number: studentNumber,
        course_id: courseId,
      });

      try {
        await axios.post(`${API_BASE_URL}/insert-logs/${userID}`, {
          message: `User #${userID} - ${user} successfully submitted student grades in Program Evaluation`,
          type: "submit",
        });
      } catch (err) {
        console.error("Error inserting audit log");
      }
    } catch (error) {
      console.error("Failed to save grade:", error);
    }
  };

  const getLevelBySection = (section) => {
    if (!section) return null;
    const yearNumber = parseInt(section[0]);
    switch (yearNumber) {
      case 1: return "First Year";
      case 2: return "Second Year";
      case 3: return "Third Year";
      case 4: return "Fourth Year";
      case 5: return "Fifth Year";
      default: return "unknown";
    }
  };

  const totalLec = (course_unit) => Number(course_unit) || 0;
  const totalLab = (lab_unit) => Number(lab_unit) || 0;

  const groupedDetails = {};
  if (Array.isArray(studentDetails)) {
    studentDetails.forEach((item) => {
      const key = `${item.school_year}-${item.semester_description}`;
      if (!groupedDetails[key]) groupedDetails[key] = [];
      groupedDetails[key].push(item);
    });
  }

  const divToPrintRef = useRef();
  const printDiv = async () => { window.print(); };

  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }
  if (!hasAccess) {
    return <Unauthorized />;
  }

  return (
    <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px", background: "white", display: "flex", alignItems: "center" }}>
          PROGRAM EVALUATION
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextField
            variant="outlined"
            placeholder="Enter Student Number"
            size="small"
            value={studentNumber}
            onChange={(e) => {
              setStudentNumber(e.target.value);
              setSearchQuery(e.target.value);
            }}
            InputProps={{ startAdornment: <Search sx={{ mr: 1 }} /> }}
            sx={{ width: 425, background: "white" }}
          />
          <button
            onClick={printDiv}
            style={{
              width: "300px", padding: "10px 20px", border: "2px solid black",
              backgroundColor: "#f0f0f0", color: "black", borderRadius: "5px",
              cursor: "pointer", fontSize: "16px", fontWeight: "bold",
              transition: "background-color 0.3s, transform 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#d3d3d3")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
            onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FcPrint size={20} />
              Print Evaluation
            </span>
          </button>
        </Box>

        <hr style={{ border: "1px solid #ccc", width: "100%", margin: "0" }} />
        <br />
      </Box>

      <button
        onClick={() => setIsEditing(!isEditing)}
        style={{
          padding: "8px 12px", marginBottom: "1rem", cursor: "pointer",
          fontWeight: "bold", backgroundColor: "#1976d2", color: "white",
          border: "none", borderRadius: "5px",
        }}
      >
        {isEditing ? "Cancel Editing" : "Edit Student Grade"}
      </button>

      <style>
        {`
          /* Both columns visible on screen */
          .col-raw-grade { display: flex; }
          .col-raw-grade-header { display: flex; }
          .col-equivalent-grade { display: flex; }
          .col-equivalent-grade-header { display: flex; }

          /* Screen: show EQUIVALENT label, hide GRADE label */
          .screen-only-label { display: inline; }
          .print-only-label { display: none; }

          @media print {
            @page { margin: 0; padding-right: 5rem }

            body * { visibility: hidden; }

            .body {
              margin-top: -30rem;
              margin-left: -27rem;
              overflow: visible !important;
              height: auto !important;
              max-height: none !important;
            }

            .print-container, .print-container * {
              visibility: visible;
            }

            .print-container {
              scale: 0.8;
              position: absolute;
              left: 0%;
              top: 0%;
              width: 100%;
              font-family: "Poppins", sans-serif;
              margin-top: -8rem;
              padding: 0;
            }

            button { display: none !important; }

            /* Print: hide raw grade input column, show only equivalent grade column */
            .col-raw-grade { display: none !important; }
            .col-raw-grade-header { display: none !important; }
            .col-equivalent-grade { display: flex !important; }
            .col-equivalent-grade-header { display: flex !important; }

            /* Print: swap label — hide EQUIVALENT, show GRADE */
            .screen-only-label { display: none !important; }
            .print-only-label { display: inline !important; }
          }
        `}
      </style>

      <Box>
        <Box
          className="print-container"
          style={{ paddingRight: "1.5rem", marginTop: "-1rem", paddingBottom: "1.5rem", maxWidth: "100%" }}
          ref={divToPrintRef}
        >
          {/* ── School Header ─────────────────────────────────────────────── */}
          <Box style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "center" }}>
            <Box style={{ paddingTop: "1.5rem", paddingRight: "3rem" }}>
              <img
                src={fetchedLogo || EaristLogo}
                alt="School Logo"
                style={{ width: "8rem", height: "8rem", display: "block", objectFit: "cover", borderRadius: "50%" }}
              />
            </Box>

            <Box style={{ marginTop: "1.5rem" }}>
              <div colSpan={15} style={{ textAlign: "center", fontFamily: "Poppins, sans-serif", fontSize: "10px", lineHeight: "1.5" }}>
                <div style={{ fontFamily: "Arial", fontSize: "13px" }}>Republic of the Philippines</div>

                {companyName ? (() => {
                  const name = companyName.trim();
                  const ws = name.split(" ");
                  const mi = Math.ceil(ws.length / 2);
                  const fl = ws.slice(0, mi).join(" ");
                  const sl = ws.slice(mi).join(" ");
                  return (
                    <>
                      <Typography style={{ textAlign: "center", marginTop: "0rem", lineHeight: "1", fontSize: "1.6rem", letterSpacing: "-1px", fontWeight: "600" }}>
                        {fl} <br /> {sl}
                      </Typography>
                      {campusAddress && (
                        <Typography style={{ mt: 1, textAlign: "center", fontSize: "12px", letterSpacing: "1px" }}>
                          {campusAddress}
                        </Typography>
                      )}
                    </>
                  );
                })() : <div style={{ height: "24px" }}></div>}
              </div>
            </Box>
          </Box>

          <Box style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <Typography style={{ width: "100%", fontSize: "1.6rem", letterSpacing: "-1px", fontWeight: "500", marginLeft: "11rem", textAlign: "center" }}>
              OFFICE OF THE REGISTRAR
            </Typography>
          </Box>

          <Box style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <Typography style={{ width: "100%", marginTop: "-0.2rem", fontSize: "1.8rem", letterSpacing: "-1px", fontWeight: "600", textAlign: "center", marginLeft: "11rem" }}>
              ACADEMIC PROGRAM EVALUATION
            </Typography>
          </Box>

          {/* ── Student Info ──────────────────────────────────────────────── */}
          <Box style={{ display: "flex" }}>
            <Box>
              <Box sx={{ padding: "1rem", marginLeft: "1rem", borderBottom: "solid black 1px", width: "100%" }}>
                <Box style={{ display: "flex" }}>
                  <Box style={{ display: "flex", width: "38rem" }}>
                    <Typography style={{ width: "9rem", fontSize: "1.05rem", letterSpacing: "-1px" }}>Student Name:</Typography>
                    <Typography style={{ fontSize: "1.06rem", fontWeight: "500" }}>
                      {studentData.last_name}, {studentData.first_name} {studentData.middle_name}
                    </Typography>
                  </Box>
                  <Box style={{ display: "flex" }}>
                    <Typography style={{ width: "6rem", fontSize: "1.05rem", letterSpacing: "-1px" }}>College:</Typography>
                    <Typography style={{ fontSize: "1.06rem", fontWeight: "500" }}>{studentData.dprtmnt_name}</Typography>
                  </Box>
                </Box>
                <Box style={{ display: "flex" }}>
                  <Box style={{ display: "flex", width: "38rem" }}>
                    <Typography style={{ width: "9rem", marginTop: "0.7rem", fontSize: "1.05rem", letterSpacing: "-1px" }}>Student No. :</Typography>
                    <Typography style={{ fontSize: "1.06rem", fontWeight: "500", marginTop: "0.7rem" }}>{studentData.student_number}</Typography>
                  </Box>
                  <Box style={{ display: "flex" }}>
                    <Typography style={{ width: "6rem", marginTop: "0.7rem", fontSize: "1.05rem", letterSpacing: "-1px" }}>Program:</Typography>
                    <Typography style={{ fontSize: "1.06rem", fontWeight: "500", marginTop: "0.7rem" }}>
                      {studentData.program_description} {studentData.major || ""}
                    </Typography>
                  </Box>
                </Box>
                <Box style={{ display: "flex" }}>
                  <Typography style={{ width: "9rem", marginTop: "0.7rem", fontSize: "1.05rem", letterSpacing: "-1px" }}>Curriculum:</Typography>
                  <Typography style={{ fontSize: "1.06rem", fontWeight: "500", marginTop: "0.7rem" }}>
                    {studentData.program_code} {studentData.year_description} RP (ORIGINAL)
                  </Typography>
                </Box>
              </Box>

              {/* ── Semester Blocks ──────────────────────────────────────── */}
              <Box style={{ display: "flex", flexWrap: "wrap" }}>
                {Object.entries(groupedDetails).map(([key, courses]) => (
                  <Box
                    style={{ paddingLeft: "1rem", marginBottom: "1rem", boxSizing: "border-box", width: "100%" }}
                    key={key}
                  >
                    <table style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <td style={{ textAlign: "center" }}>
                            {courses[0].year_level_description} {courses[0].semester_description}
                          </td>
                        </tr>
                        <tr style={{ display: "flex", borderBottom: "solid 1px rgba(0,0,0,0.1)" }}>
                          {/* CODE */}
                          <td style={{ fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", width: "6rem" }}>
                            <span>CODE</span>
                          </td>
                          {/* DESCRIPTION */}
                          <td style={{ fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", width: "28rem" }}>
                            <span>DESCRIPTION</span>
                          </td>
                          {/* PRE-REQUISITE */}
                          <td style={{ fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", width: "10rem" }}>
                            <span>Pre-requisite</span>
                          </td>
                          {/* HRS/WK */}
                          <td>
                            <div style={{ margin: "-1px", fontWeight: "700", textAlign: "center", width: "5rem" }}>HRS/WK</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <div style={{ fontWeight: "700", fontSize: "0.9rem", textAlign: "center", width: "50%" }}><span>LEC</span></div>
                              <div style={{ textAlign: "center", fontWeight: "700", fontSize: "0.9rem", width: "50%" }}><span>LAB</span></div>
                            </div>
                          </td>
                          {/* UNITS */}
                          <td>
                            <div style={{ margin: "-1px", fontWeight: "700", textAlign: "center", width: "5rem" }}>UNITS</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <div style={{ fontWeight: "700", fontSize: "0.9rem", textAlign: "center", width: "50%" }}><span>LEC</span></div>
                              <div style={{ textAlign: "center", fontWeight: "700", fontSize: "0.9rem", width: "50%" }}><span>LAB</span></div>
                            </div>
                          </td>
                          {/* TOTAL UNITS */}
                          <td style={{ fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", width: "6rem" }}>
                            <span>TOTAL <br /> UNITS</span>
                          </td>

                          {/* GRADE — raw input, screen only, hidden on print */}
                          <td className="col-raw-grade-header" style={{ fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", width: "7rem" }}>
                            <span>GRADE</span>
                          </td>

                          {/* EQUIVALENT GRADE — shown on screen as "EQUIVALENT", shown on print as "GRADE" */}
                          <td className="col-equivalent-grade-header" style={{ fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", width: "7rem" }}>
                            <span className="screen-only-label">EQUIVALENT</span>
                            <span className="print-only-label">GRADE</span>
                          </td>
                        </tr>
                      </thead>

                      <tbody>
                        {courses.map((p) => {
                          const rawGrade = gradeEdits[p.course_id] ?? p.final_grade ?? "";
                          const equivalentGrade = handleGradeConversion(rawGrade);

                          // Strip decimals for display in the GRADE column
                          // e.g. "99.99" → "99", "INC"/"DRP" pass through, "" stays ""
                          const displayGrade = (() => {
                            if (!rawGrade && rawGrade !== 0) return "";
                            const upper = String(rawGrade).trim().toUpperCase();
                            if (upper === "INC" || upper === "DRP" || upper === "") return upper;
                            const parsed = parseFloat(upper);
                            if (isNaN(parsed)) return upper;
                            return String(Math.trunc(parsed));
                          })();

                          return (
                            <tr style={{ display: "flex", borderBottom: `solid 1px ${borderColor}` }} key={p.enrolled_id}>
                              {/* Code */}
                              <td style={{ display: "flex", width: "6rem" }}>
                                <span style={{ width: "100px" }}>{p.course_code}</span>
                              </td>
                              {/* Description */}
                              <td style={{ display: "flex", width: "28rem" }}>
                                <span style={{ margin: "0", padding: "0" }}>{p.course_description}</span>
                              </td>
                              {/* Pre-req */}
                              <td style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "10rem" }}>
                                <span>None</span>
                              </td>
                              {/* HRS/WK */}
                              <td>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                  <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center" }}><span>{p.course_unit}</span></div>
                                  <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center" }}><span>{p.lab_unit}</span></div>
                                </div>
                              </td>
                              {/* UNITS */}
                              <td>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                  <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center" }}><span>{p.course_unit}</span></div>
                                  <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center" }}><span>{p.lab_unit}</span></div>
                                </div>
                              </td>
                              {/* Total Units */}
                              <td style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "6rem" }}>
                                {Number(p.course_unit) + Number(p.lab_unit)}
                              </td>

                              {/* GRADE — GradeSelect dropdown, screen only */}
                              <td className="col-raw-grade" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "7rem" }}>
                                <GradeSelect
                                  value={displayGrade}
                                  disabled={!isEditing}
                                  onChange={(val) =>
                                    handleGradeChange(p.course_id, val, studentData.student_number)
                                  }
                                />
                              </td>

                              {/* EQUIVALENT GRADE — read-only converted value, always visible */}
                              <td className="col-equivalent-grade" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "7rem" }}>
                                <span style={{ width: "7rem", textAlign: "center", display: "block", fontSize: "0.9rem" }}>
                                  {equivalentGrade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Totals row */}
                        <tr style={{ display: "flex", fontWeight: "700", borderBottom: `solid 1px ${borderColor}`, borderRight: `solid 1px ${borderColor}`, borderLeft: `solid 1px ${borderColor}` }}>
                          <td style={{ display: "flex", justifyContent: "center", alignContent: "center", width: "44rem" }}>
                            <span>Total</span>
                          </td>
                          <td style={{ margin: 0, padding: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", margin: 0, padding: 0 }}>
                              <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center", borderLeft: `solid 1px ${borderColor}`, borderRight: `solid 1px ${borderColor}`, margin: 0, padding: 0 }}>
                                <span>{courses.reduce((sum, p) => sum + totalLec(p.course_unit), 0)}</span>
                              </div>
                              <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center", borderRight: `solid 1px ${borderColor}`, margin: 0, padding: 0 }}>
                                <span>{courses.reduce((sum, p) => sum + totalLab(p.lab_unit), 0)}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center" }}>
                                <span>{courses.reduce((sum, p) => sum + totalLec(p.course_unit), 0)}</span>
                              </div>
                              <div style={{ fontSize: "0.9rem", width: "2.5rem", textAlign: "center" }}>
                                <span>{courses.reduce((sum, p) => sum + totalLab(p.lab_unit), 0)}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ fontSize: "0.9rem", width: "6rem", textAlign: "center" }}>
                              <span>{courses.reduce((sum, p) => sum + totalLec(p.course_unit) + totalLab(p.lab_unit), 0)}</span>
                            </div>
                          </td>
                          {/* Empty grade cells in totals row */}
                          <td className="col-raw-grade" style={{ width: "7rem" }}></td>
                          <td className="col-equivalent-grade" style={{ width: "7rem" }}></td>
                        </tr>

                        {/* Evaluator / Date / GWA / Status row */}
                        <tr style={{ display: "flex", gap: "1rem" }}>
                          <td style={{ display: "flex", gap: "1.5rem", width: "20rem" }}>
                            <div>Evaluator:</div><span></span>
                          </td>
                          <td style={{ display: "flex", gap: "1.5rem", width: "13rem" }}>
                            <div>Date:</div><span></span>
                          </td>
                          <td style={{ display: "flex", gap: "1.5rem", width: "13rem" }}>
                            <div>GWA:</div><span></span>
                          </td>
                          <td style={{ display: "flex", gap: "1.5rem", width: "15rem" }}>
                            <div>Status:</div><span></span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Box>
                ))}
              </Box>

              <Snackbar
                open={openSnackbar}
                autoHideDuration={4000}
                onClose={() => setOpenSnackbar(false)}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
              >
                <Alert onClose={() => setOpenSnackbar(false)} severity="warning" sx={{ width: "100%" }}>
                  {snackbarMessage}
                </Alert>
              </Snackbar>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ProgramEvaluationForRegistrar;