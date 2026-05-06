import React, { useEffect, useState, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import API_BASE_URL from "../apiConfig";

import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Snackbar,
    Alert,
} from "@mui/material";

import SchoolIcon from "@mui/icons-material/School";


const sortTerms = (terms) =>
    [...terms].sort((a, b) => {
        const getYear = (term) => {
            if (term.includes("First Year")) return 1;
            if (term.includes("Second Year")) return 2;
            if (term.includes("Third Year")) return 3;
            if (term.includes("Fourth Year")) return 4;
            if (term.includes("Fifth Year")) return 5;
            return 0;
        };

        const getSem = (term) => {
            if (term.includes("First Semester")) return 1;
            if (term.includes("Second Semester")) return 2;
            if (term.includes("Summer")) return 3;
            return 0;
        };

        const yearA = getYear(a);
        const yearB = getYear(b);

        // sort by year DESC (4th → 3rd → 2nd → 1st)
        if (yearA !== yearB) return yearB - yearA;

        const semA = getSem(a);
        const semB = getSem(b);

        // sort by semester DESC (2nd → 1st)
        return semB - semA;
    });

const addOneYear = (yearStr) => {
    if (!yearStr) return "";

    const parts = yearStr.split("-");

    if (parts.length !== 2) return yearStr;

    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);

    if (isNaN(start) || isNaN(end)) return yearStr;

    return `${start + 1}-${end + 1}`;
};
// ─── Main Component ─────────────────────────────────
const StudentCurriculumSubjects = () => {
    const settings = useContext(SettingsContext);

    const [titleColor, setTitleColor] = useState("#000000");
    const [subtitleColor, setSubtitleColor] = useState("#555555");
    const [borderColor, setBorderColor] = useState("#000000");
    const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
    const [subButtonColor, setSubButtonColor] = useState("#ffffff"); // ✅ NEW
    const [stepperColor, setStepperColor] = useState("#000000"); // ✅ NEW

    const [fetchedLogo, setFetchedLogo] = useState(null);
    const [companyName, setCompanyName] = useState("");
    const [shortTerm, setShortTerm] = useState("");
    const [campusAddress, setCampusAddress] = useState("");
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (!settings) return;

        // 🎨 Colors
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.main_button_color)
            setMainButtonColor(settings.main_button_color);
        if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
        if (settings.stepper_color) setStepperColor(settings.stepper_color);

        // 🏫 Logo
        if (settings.logo_url) {
            setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
            setFetchedLogo(EaristLogo);
        }

        // 🏷️ School Info
        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings.short_term) setShortTerm(settings.short_term);
        if (settings.campus_address) setCampusAddress(settings.campus_address);

        // ✅ Branches (JSON stored in DB)
        if (settings?.branches) {
            try {
                const parsed =
                    typeof settings.branches === "string"
                        ? JSON.parse(settings.branches)
                        : settings.branches;

                setBranches(parsed);
            } catch (err) {
                console.error("Failed to parse branches:", err);
                setBranches([]);
            }
        }
    }, [settings]);


    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const [userID, setUserID] = useState("");

    useEffect(() => {
        const storedID = localStorage.getItem("person_id");

        if (!storedID) {
            window.location.href = "/login";
            return;
        }

        setUserID(storedID);
        fetchSubjects(storedID);
    }, []);

    const fetchSubjects = async (id) => {
        try {
            const res = await axios.get(
                `${API_BASE_URL}/api/student/${id}/curriculum-subjects`
            );

            setSubjects(res.data);
        } catch (err) {
            console.error(err);
            setMessage("Failed to fetch curriculum subjects");
        } finally {
            setLoading(false);
        }
    };

    const yearLabelMap = {
        "First Year": "1st Year",
        "Second Year": "2nd Year",
        "Third Year": "3rd Year",
        "Fourth Year": "4th Year",
        "Fifth Year": "5th Year",
    };

    const formatYearLabel = (year) => {
        return yearLabelMap[year] || year;
    };

    const formatAcademicYear = (year) => {
        if (!year) return "";

        // If already formatted like "2024-2025"
        if (typeof year === "string" && year.includes("-")) {
            return year;
        }

        const startYear = Number(year);

        if (isNaN(startYear)) return "";

        return `${startYear}-${startYear + 1}`;
    };


    const formatUnit = (value) => {
        if (value === null || value === undefined) return "0";

        const num = Number(value);

        if (isNaN(num)) return "0";

        // remove trailing .0
        return Number.isInteger(num) ? num.toString() : num.toString();
    };

    const rawTerms = [...new Set(subjects.map(
        (row) => `${row.year_level_description} ${row.semester_description}`
    ))];

    const sortedTerms = sortTerms(rawTerms);

    const headerBg = settings?.header_color || "#800000";

    const headCell = {
        backgroundColor: headerBg,
        color: "#fff",
        fontWeight: 600,
        fontSize: 12,
        textTransform: "uppercase",
        border: `1px solid ${borderColor}`,
    };

    const colStyle = {
        border: `1px solid ${borderColor}`,
        fontSize: 13,
        wordWrap: "break-word",
        overflowWrap: "break-word",
        whiteSpace: "normal",
    };

    const bodyCell = {
        fontSize: 13,
        border: `1px solid ${borderColor}`,
    };

    const programInfo = subjects[0];

    if (loading) return <Box p={3}>Loading...</Box>;

    return (
        <Box
            sx={{
                height: "calc(100vh - 150px)",
                overflowY: "auto",
                paddingRight: 1,
                backgroundColor: "transparent",
                mt: 1,
                padding: 2,
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>



                {programInfo && (
                    <Typography variant="h4"
                        sx={{
                            fontWeight: "bold",
                            color: titleColor,
                            fontSize: "36px",
                        }}>

                        CURRICULUM: ({programInfo.program_code}) - {programInfo.program_description} ({formatAcademicYear(programInfo.year_description)})
                    </Typography>


                )}

            </Box>
            <hr style={{ border: "1px solid #ccc", width: "100%" }} />

            <br />
            <br />

            {
                sortedTerms.map((term, idx) => {
                    const termSubjects = subjects.filter(
                        (row) => `${row.year_level_description} ${row.semester_description}` === term
                    );
                    const yearLevel = termSubjects[0]?.year_level_description;
                    const semesterLabel = termSubjects[0]?.semester_description;

                    const totalLec = termSubjects.reduce(
                        (sum, row) => sum + Number(row.lec_unit || 0),
                        0
                    );

                    const totalLab = termSubjects.reduce(
                        (sum, row) => sum + Number(row.lab_unit || 0),
                        0
                    );

                    const totalCourse = termSubjects.reduce(
                        (sum, row) => sum + Number(row.course_unit || 0),
                        0
                    );


                    return (
                        <Box key={idx} sx={{ mb: 4 }}>

                            {/* ── Term Header ── */}

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    mb: 2,
                                    p: 2.5,
                                    borderRadius: "10px",
                                    backgroundColor: "#fff",
                                    border: `1px solid ${borderColor}`,
                                    boxShadow: 2,
                                    gap: 3,
                                }}
                            >
                                {/* LEFT ICON (cleaner spacing) */}
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        backgroundColor: headerBg,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#fff",
                                        flexShrink: 0,
                                    }}
                                >
                                    <SchoolIcon />

                                </Box>

                                <Box
                                    sx={{
                                        width: 4,
                                        height: 50,
                                        borderRadius: 2,
                                        backgroundColor: headerBg,
                                        flexShrink: 0,
                                    }}
                                />

                                {/* LEFT CONTENT */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    {programInfo && (
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>

                                            <Typography sx={{ fontSize: 15, fontWeight: 700, color: titleColor }}>
                                                STUDENT NUMBER:
                                                <Box component="span" sx={{ fontWeight: 400, ml: 1.5 }}>
                                                    {programInfo.student_number}
                                                </Box>
                                            </Typography>

                                            <Typography sx={{ fontSize: 15, fontWeight: 700, color: titleColor }}>
                                                NAME:
                                                <Box component="span" sx={{ fontWeight: 400, ml: 1.5 }}>
                                                    {programInfo.last_name}, {programInfo.first_name} {programInfo.middle_name}
                                                </Box>
                                            </Typography>

                                        </Box>
                                    )}
                                </Box>

                                {/* RIGHT CONTENT */}
                                {programInfo && (
                                    <Box
                                        sx={{
                                            textAlign: "right",
                                            flex: 1,
                                            minWidth: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.8,
                                        }}
                                    >
                                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: titleColor }}>
                                            PROGRAM:
                                            <Box component="span" sx={{ fontWeight: 400, ml: 1.5 }}>
                                                ({programInfo.program_code}) {programInfo.program_description} {programInfo.major}
                                            </Box>
                                        </Typography>

                                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: titleColor }}>
                                            YEAR / SEMESTER:
                                            <Box component="span" sx={{ fontWeight: 400, ml: 1.5 }}>
                                                {formatYearLabel(yearLevel)} - {semesterLabel}
                                            </Box>
                                        </Typography>
                                    </Box>
                                )}
                            </Box>


                            {/* ── Table ── */}
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ ...headCell, width: "40px" }}>#</TableCell>
                                            <TableCell sx={{ ...headCell, width: "110px" }}>Subject Code</TableCell>
                                            <TableCell sx={{ ...headCell, width: "320px" }}>Description</TableCell>
                                            <TableCell sx={{ ...headCell, width: "90px" }}>Section</TableCell>
                                            <TableCell sx={{ ...headCell, width: "90px" }}>Lec Units</TableCell>
                                            <TableCell sx={{ ...headCell, width: "90px" }}>Lab Units</TableCell>
                                            <TableCell sx={{ ...headCell, width: "110px" }}>Course Units</TableCell>
                                            <TableCell sx={{ ...headCell, width: "220px" }}>Schedule</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {termSubjects.map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell sx={{ ...colStyle, width: "40px" }}>{i + 1}</TableCell>

                                                <TableCell sx={{ ...colStyle, width: "110px" }}>
                                                    {row.course_code}
                                                </TableCell>

                                                <TableCell
                                                    sx={{
                                                        ...colStyle,
                                                        width: "320px",
                                                        maxHeight: "70px",
                                                    }}
                                                >
                                                    {row.course_description}
                                                </TableCell>

                                                <TableCell sx={{ ...colStyle, width: "90px" }}></TableCell>

                                                <TableCell sx={{ ...colStyle, width: "90px", textAlign: "center" }}>
                                                    {formatUnit(row.lec_unit)}
                                                </TableCell>

                                                <TableCell sx={{ ...colStyle, width: "90px", textAlign: "center" }}>
                                                    {formatUnit(row.lab_unit)}
                                                </TableCell>

                                                <TableCell sx={{ ...colStyle, width: "110px", textAlign: "center" }}>
                                                    {formatUnit(row.course_unit)}
                                                </TableCell>

                                                <TableCell
                                                    sx={{
                                                        ...colStyle,
                                                        width: "220px",
                                                        textAlign: "center",
                                                        whiteSpace: "pre-line", // IMPORTANT for schedules
                                                    }}
                                                >
                                                    {row.schedule}
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {/* ✅ TOTAL ROW */}
                                        <TableRow
                                            sx={{
                                                backgroundColor: "#f5f5f5",
                                            }}
                                        >
                                            <TableCell sx={{ ...bodyCell, fontWeight: 700 }} colSpan={4}>
                                                TOTAL
                                            </TableCell>

                                            <TableCell sx={{ ...bodyCell, fontWeight: 700 }}>
                                                {totalLec}
                                            </TableCell>

                                            <TableCell sx={{ ...bodyCell, fontWeight: 700 }}>
                                                {totalLab}
                                            </TableCell>

                                            <TableCell sx={{ ...bodyCell, fontWeight: 700 }}>
                                                {totalCourse}
                                            </TableCell>

                                            <TableCell sx={bodyCell}></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    );
                })
            }

            <Snackbar
                open={!!message}
                autoHideDuration={4000}
                onClose={() => setMessage("")}
            >
                <Alert severity="error">{message}</Alert>
            </Snackbar>


        </Box >
    );
};

export default StudentCurriculumSubjects;
