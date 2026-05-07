import React, { useEffect, useState, useContext } from "react";
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from "@mui/material";

import axios from "axios";
import API_BASE_URL from "../apiConfig";
import { SettingsContext } from "../App";

const ProgramPayment = () => {
    const settings = useContext(SettingsContext);

    const [assessmentData, setAssessmentData] = useState([]);
    const [student, setStudent] = useState(null);

    const [titleColor, setTitleColor] = useState("#000");
    const [borderColor, setBorderColor] = useState("#000");

    ////////////////////////////////////////////////////////////
    // SETTINGS
    ////////////////////////////////////////////////////////////
    useEffect(() => {
        if (!settings) return;
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.border_color) setBorderColor(settings.border_color);
    }, [settings]);

    ////////////////////////////////////////////////////////////
    // FETCH DATA
    ////////////////////////////////////////////////////////////
    useEffect(() => {
        const fetchAssessment = async () => {
            try {
                const person_id = localStorage.getItem("person_id");
                console.log("PERSON:", person_id);

                if (!person_id) {
                    console.error("No person_id found in localStorage");
                    return;
                }

                const response = await axios.get(
                    `${API_BASE_URL}/api/student-assessment/${person_id}`
                );

                console.log("Response:", response);

                if (!response.data.success) {
                    console.error(response.data.error);
                    return;
                }

                setStudent(response.data.student || null);

                // MAP ALL ROWS
                setAssessmentData(
                    (response.data.rows || []).map((row) => ({
                        school_year: row.school_year || "",
                        semester: row.semester || "",
                        year_level: row.year_level || "",
                        assessment: Number(row.fees?.grandTotal || 0),
                        payment: 0,
                        balance: Number(row.fees?.grandTotal || 0),
                    }))
                );

            } catch (error) {
                console.error("FULL ERROR:", error);
                console.error("ERROR RESPONSE:", error.response);
            }
        };

        fetchAssessment();
    }, []);

    ////////////////////////////////////////////////////////////
    // GRAND TOTAL
    ////////////////////////////////////////////////////////////
    const grandTotal = assessmentData.reduce(
        (sum, row) => sum + Number(row.balance || 0),
        0
    );

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
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",

                    mb: 2,
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: "bold",
                        color: titleColor,
                        fontSize: "36px",
                    }}
                >
                    STUDENT ACCOUNT BALANCE
                </Typography>
            </Box>
            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />
            <br />

            <Paper
                sx={{
                    mt: 3,
                    p: 3,
                   border: `1px solid ${borderColor}`,
                    minHeight: "75vh",
                    backgroundColor: "white",
                }}
            >
                {/* ANNOUNCEMENT */}
                <Box sx={{ textAlign: "center", mb: 5 }}>
                    <Typography sx={{ fontSize: "24px", textDecoration: "underline" }}>
                        Announcement :
                    </Typography>
                    <Typography sx={{ fontSize: "22px", mt: 1 }}>
                        Accounts/Balance reflected in the system are subject for correction
                        or adjustment at the STUDENTS ACCOUNT SECTION.
                    </Typography>
                </Box>

                {/* STUDENT INFO */}
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, px: 2 }}>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Typography sx={{ fontWeight: "bold" }}>Student Name</Typography>
                        <Typography>:</Typography>
                        <Typography>
                            {student ? `${student.last_name}, ${student.first_name}` : ""}
                        </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Typography sx={{ fontWeight: "bold" }}>Student No.</Typography>
                        <Typography>:</Typography>
                        <Typography>{student?.student_number}</Typography>
                    </Box>
                </Box>

                {/* TABLE */}
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: "#990000" }}>
                                {[
                                    "School Year",
                                    "Semester",
                                    "Year Level",
                                    "Scholarship",
                                    "Payment Description",
                                    "O.R. Date",
                                    "O.R. No.",
                                    "Assessment",
                                    "Payment",
                                    "Balance",
                                ].map((header) => (
                                    <TableCell
                                        key={header}
                                        sx={{
                                            color: "white",
                                            fontWeight: "bold",
                                            border: `1px solid ${borderColor}`,
                                            textAlign: "center",
                                            padding: "6px",
                                        }}
                                    >
                                        {header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {assessmentData.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={10}
                                        align="center"
                                        sx={{ border: `1px solid ${borderColor}`, py: 4 }}
                                    >
                                        No assessment records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                assessmentData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.school_year} - {row.school_year + 1}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, color: "#b22222" }}>
                                            {row.semester}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.year_level}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.scholarship || ""}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            TOTAL AMOUNT DUE
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.or_date || ""}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            TOTAL AMOUNT DUE
                                        </TableCell>
                                        <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>
                                            {Number(row.assessment || 0).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>
                                            {Number(row.payment || 0).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>
                                            {Number(row.balance || 0).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}

                            {/* GRAND TOTAL ROW */}
                            <TableRow>
                                <TableCell
                                    colSpan={9}
                                    align="right"
                                    sx={{
                                        fontWeight: "bold",
                                        border: `1px solid ${borderColor}`,
                                        fontSize: "16px",
                                    }}
                                >
                                    Grand Total Balance/(Refund) :
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: "bold",
                                        color: "red",
                                        fontSize: "16px",
                                        border: `1px solid ${borderColor}`,
                                    }}
                                >
                                    {grandTotal.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                    })}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default ProgramPayment;