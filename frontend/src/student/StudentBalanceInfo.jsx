import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import axios from "axios";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import API_BASE_URL from "../apiConfig";
import { SettingsContext } from "../App";

const money = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const StudentBalanceInfo = () => {
  const settings = useContext(SettingsContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [student, setStudent] = useState(location.state?.student || null);
  const [assessmentRow, setAssessmentRow] = useState(
    location.state?.assessmentRow || null,
  );
  const [loading, setLoading] = useState(!location.state?.assessmentRow);

  const titleColor = settings?.title_color || "#000";
  const borderColor = settings?.border_color || "#000";
  const headerColor = settings?.header_color || "#990000";

  useEffect(() => {
    if (assessmentRow) return;

    const fetchAssessment = async () => {
      try {
        const personId = localStorage.getItem("person_id");
        if (!personId) return;

        const { data } = await axios.get(
          `${API_BASE_URL}/api/student-assessment/${personId}`,
        );

        setStudent(data.student || null);

        const activeSchoolYearId = searchParams.get("active_school_year_id");
        const schoolYear = searchParams.get("school_year");
        const semester = searchParams.get("semester");

        const match = (data.rows || []).find((row) => {
          if (activeSchoolYearId) {
            return String(row.active_school_year_id || "") === activeSchoolYearId;
          }

          return (
            String(row.school_year || "") === String(schoolYear || "") &&
            String(row.semester || "") === String(semester || "")
          );
        });

        setAssessmentRow(match || null);
      } catch (error) {
        console.error("Failed to fetch student balance info:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentRow, searchParams]);

  const subjects = (assessmentRow?.subjects || []).filter(
    (subject) => String(subject?.course_code || "").trim() !== "",
  );
  const fees = assessmentRow?.fees || {};

  const totals = useMemo(() => {
    const courseUnits = subjects.reduce(
      (sum, subject) => sum + Number(subject.course_unit || 0),
      0,
    );
    const lectureFees = subjects.reduce(
      (sum, subject) => sum + Number(subject.lec_fee || 0),
      0,
    );
    const labFees = subjects.reduce(
      (sum, subject) => sum + Number(subject.lab_fee || 0),
      0,
    );

    return { courseUnits, lectureFees, labFees };
  }, [subjects]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        backgroundColor: "transparent",
        mt: 1,
        p: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/student_account_balance")}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Back
        </Button>
        <Typography
          variant="h4"
          sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
        >
          STUDENT BALANCE BREAKDOWN
        </Typography>
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />

      {!assessmentRow ? (
        <Paper sx={{ mt: 3, p: 3, border: `1px solid ${borderColor}` }}>
          <Typography>No balance breakdown found for this semester.</Typography>
        </Paper>
      ) : (
        <Paper
          sx={{
            mt: 3,
            p: 3,
            border: `1px solid ${borderColor}`,
            backgroundColor: "white",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography fontWeight={700}>Student Name</Typography>
              <Typography>
                {student
                  ? `${student.last_name}, ${student.first_name} ${student.middle_name || ""}`
                  : ""}
              </Typography>
            </Box>
            <Box>
              <Typography fontWeight={700}>Student No.</Typography>
              <Typography>{student?.student_number || ""}</Typography>
            </Box>
            <Box>
              <Typography fontWeight={700}>Term</Typography>
              <Typography>
                {assessmentRow.school_year} - {Number(assessmentRow.school_year) + 1} /{" "}
                {assessmentRow.semester}
              </Typography>
            </Box>
            <Box>
              <Typography fontWeight={700}>Year Level</Typography>
              <Typography>{assessmentRow.year_level}</Typography>
            </Box>
          </Box>

          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: headerColor }}>
                  {["#", "Course Code", "Description", "Units", "Lec Fee", "Lab Fee", "Total"].map((header) => (
                    <TableCell
                      key={header}
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {subjects.map((subject, index) => (
                  <TableRow key={`${subject.course_id}-${index}`}>
                    <TableCell align="center" sx={{ border: `1px solid ${borderColor}` }}>{index + 1}</TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}` }}>{subject.course_code}</TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}` }}>{subject.course_description}</TableCell>
                    <TableCell align="center" sx={{ border: `1px solid ${borderColor}` }}>{subject.course_unit}</TableCell>
                    <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>{money(subject.lec_fee)}</TableCell>
                    <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>{money(subject.lab_fee)}</TableCell>
                    <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>
                      {money(Number(subject.lec_fee || 0) + Number(subject.lab_fee || 0))}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow sx={{ backgroundColor: "#f5f5f5", fontWeight: 700 }}>
                  <TableCell colSpan={3} align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    Course Totals
                  </TableCell>
                  <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    {totals.courseUnits}
                  </TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    {money(totals.lectureFees)}
                  </TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    {money(totals.labFees)}
                  </TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    {money(fees.tuitionFee)}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell colSpan={7} sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, fontSize: 18 }}>
                    Tuition Fee
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: `1px solid ${borderColor}` }}>Tuition Fee</TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>{money(fees.tuitionFee)}</TableCell>
                </TableRow>
                {Number(fees.nstpFee || 0) > 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ border: `1px solid ${borderColor}` }}>NSTP Fee</TableCell>
                    <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>{money(fees.nstpFee)}</TableCell>
                  </TableRow>
                )}
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell colSpan={6} align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    Total Tuition
                  </TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    {money(fees.totalTuition)}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell colSpan={7} sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, fontSize: 18 }}>
                    Miscellaneous and Other Fees
                  </TableCell>
                </TableRow>
                {(fees.miscellaneousBreakdown || []).map((fee) => (
                  <TableRow key={fee.label}>
                    <TableCell colSpan={6} sx={{ border: `1px solid ${borderColor}` }}>{fee.label}</TableCell>
                    <TableCell align="right" sx={{ border: `1px solid ${borderColor}` }}>{money(fee.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell colSpan={6} align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    Total Miscellaneous Fee
                  </TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                    {money(fees.miscellaneousFee)}
                  </TableCell>
                </TableRow>
                {Number(fees.discountAmount || 0) > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={6} align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                        Gross Assessment
                      </TableCell>
                      <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                        {money(fees.originalGrandTotal)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700 }}>
                        Discount / Scholarship
                      </TableCell>
                      <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, color: "red" }}>
                        -{money(fees.discountAmount)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
                <TableRow sx={{ backgroundColor: "#fff1f1" }}>
                  <TableCell colSpan={6} align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 800, fontSize: 16 }}>
                    Total Assessment
                  </TableCell>
                  <TableCell align="right" sx={{ border: `1px solid ${borderColor}`, fontWeight: 800, color: "red", fontSize: 16 }}>
                    {money(fees.grandTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default StudentBalanceInfo;
