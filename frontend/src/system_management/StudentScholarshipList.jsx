import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  TextField,
  Typography,
  Card,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Paper,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
} from "@mui/material";
import '../styles/Print.css'
import CertificateOfRegistration from '../components/CORForScholarship';
import EaristLogo from "../assets/EaristLogo.png";
import SearchIcon from "@mui/icons-material/Search";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import GradeIcon from "@mui/icons-material/Grade";
import SchoolIcon from "@mui/icons-material/School";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../apiConfig";

import UploadFileIcon from '@mui/icons-material/UploadFile';
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";

const StudentScholarshipList = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

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
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
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

  // Also put it at the very top
  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");

  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const pageId = 129;

  const [employeeID, setEmployeeID] = useState("");

  const getAuditHeaders = () => ({
    "Content-Type": "application/json",
    "x-employee-id": employeeID || localStorage.getItem("employee_id") || "",
    "x-page-id": pageId,
    "x-audit-actor-id": employeeID || localStorage.getItem("employee_id") || "",
    "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
  });
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
      const response = await axios.get(`${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`);
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
      if (error.response && error.response.data.message) {
        console.log(error.response.data.message);
      } else {
        console.log("An unexpected error occurred.");
      }
      setLoading(false);
    }
  };



  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(3);
  const [clickedSteps, setClickedSteps] = useState([]);

  const tabs1 = [
    { label: "Student Records", to: "/student_list", icon: <ListAltIcon /> },
    { label: "Applicant Form", to: "/readmission_dashboard1", icon: <PersonAddIcon /> },
    { label: "Submitted Documents", to: "/submitted_documents", icon: <UploadFileIcon /> },
    { label: "Search Certificate of Registration", to: "/search_cor", icon: <ListAltIcon /> },
    { label: "Report of Grades", to: "/report_of_grades", icon: <GradeIcon /> },
    { label: "Transcript of Records", to: "/transcript_of_records", icon: <SchoolIcon /> },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentData, setStudentData] = useState([]);
  const [studentDetails, setStudentDetails] = useState([]);
  const [notAssignedStudents, setNotAssignedStudents] = useState([]);
  const [notAssignedLoading, setNotAssignedLoading] = useState(false);
  const [refreshNotAssignedKey, setRefreshNotAssignedKey] = useState(0);
  const [openCorModal, setOpenCorModal] = useState(false);
  const [selectedCorStudentNumber, setSelectedCorStudentNumber] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setOpenSnackbar(false);
  };

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 9) {
      setSelectedStudent(null);
      setStudentData([]);
      return;
    }

    const fetchStudent = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/program_evaluation/${searchQuery}`);
        const data = await res.json();


        if (data) {
          setSelectedStudent(data);
          setStudentData(data);

          if (searchQuery) {
            localStorage.setItem("admin_edit_person_id", searchQuery);
          }

          const detailsRes = await fetch(`${API_BASE_URL}/api/program_evaluation/details/${searchQuery}`);
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
        localStorage.removeItem("admin_edit_person_id");
        setOpenSnackbar(true);
      }
    };

    fetchStudent();
  }, [searchQuery]);


  const handleStepClick = (index, to) => {
    setActiveStep(index);

    const pid = localStorage.getItem("admin_edit_person_id");
    console.log(pid);
    if (pid && pid !== "undefined" && pid !== "null" && pid.length >= 9) {
      navigate(`${to}?student_number=${pid}`);
    } else {
      navigate(to);
    }
  };

  useEffect(() => {
    const storedId = localStorage.getItem("admin_edit_person_id");

    if (storedId && storedId !== "undefined" && storedId !== "null" && storedId.length >= 9) {
      setSearchQuery(storedId);
    }
  }, []);

  const [studentNumber, setStudentNumber] = useState(() => {
    return localStorage.getItem("studentNumberForCOR") || localStorage.getItem("admin_edit_person_id") || "";
  });
  const [debouncedStudentNumber, setDebouncedStudentNumber] = useState("");

  const divToPrintRef = useRef();
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleGeneratePdf = async () => {
    if (!divToPrintRef.current || pdfLoading) return;

    setPdfLoading(true);

    try {
      const html = `
      <html>
        <head>
          <link rel="stylesheet" href="${window.location.origin}/styles/Print.css" />
        </head>
        <body>
          ${divToPrintRef.current.innerHTML}
        </body>
      </html>
    `;

      const res = await fetch(`${API_BASE_URL}/api/generate-cor-pdf`, {
        method: "POST",
        headers: getAuditHeaders(),
        body: JSON.stringify({ html, student_number: studentNumber || searchQuery }),
      });

      if (!res.ok) throw new Error("PDF failed");

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "certificate_of_registration.pdf";
      a.click();

      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("PDF failed");
    }

    setPdfLoading(false);
  };

  useEffect(() => {
    if (studentNumber.trim().length >= 9) { // adjust min length if needed
      const delayDebounce = setTimeout(() => {
        setDebouncedStudentNumber(studentNumber);
      }, 500); // half-second debounce

      return () => clearTimeout(delayDebounce);
    }
  }, [studentNumber]);

  useEffect(() => {
    if (studentNumber) {
      localStorage.removeItem("studentNumberForCOR");
    }
  }, [studentNumber]);

  useEffect(() => {
    const fetchNotAssignedStudents = async () => {
      setNotAssignedLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/not_assigned`);
        setNotAssignedStudents(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to fetch not assigned students:", error);
        setSnackbarMessage("Failed to load not assigned students.");
        setOpenSnackbar(true);
      } finally {
        setNotAssignedLoading(false);
      }
    };

    fetchNotAssignedStudents();
  }, [refreshNotAssignedKey]);

  const handleOpenCorModal = (studentNumberValue) => {
    setSelectedCorStudentNumber(studentNumberValue);
    setStudentNumber(studentNumberValue);
    setOpenCorModal(true);
  };

  const handleCloseCorModal = () => {
    setOpenCorModal(false);
    setSelectedCorStudentNumber("");
  };

  const handleCorSaved = () => {
    setRefreshNotAssignedKey((prev) => prev + 1);
    handleCloseCorModal();
  };

  // Put this at the very bottom before the return 
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return (
      <Unauthorized />
    );
  }

  return (
    <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>
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
          ASSIGN STUDENT SCHOLARSHIP
        </Typography>

        <TextField
          variant="outlined"
          placeholder="Enter Student Number"
          size="small"
          value={studentNumber}

          onChange={(e) => setStudentNumber(e.target.value)}
          sx={{
            width: 450,
            backgroundColor: "#fff",
            borderRadius: 1,
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
            },
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
          }}
        />
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />
       <br />


      <Card sx={{  boxShadow: 3 }}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead >
              <TableRow >
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >Student Number</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >Last Name</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >First Name</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                > Middle Name</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >Extension</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >Program Code</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >Program Descriptio</TableCell>
                <TableCell sx={{
                  border: `1px solid ${borderColor}`,
                  padding: "10px",
                  color: "white",
                  backgroundColor: settings?.header_color || "#1976d2",
                }}
                >Major</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!notAssignedLoading && notAssignedStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No not-assigned students found.
                  </TableCell>
                </TableRow>
              )}

              {notAssignedStudents.map((student) => (
                <TableRow key={student.student_number} hover>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>
                    <Button
                      variant="text"
                      onClick={() => handleOpenCorModal(student.student_number)}
                      sx={{ textTransform: "none", p: 0, minWidth: 0 }}
                    >
                      {student.student_number}
                    </Button>
                  </TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.last_name || "-"}</TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.first_name || "-"}</TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.middle_name || "-"}</TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.extension || "-"}</TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.program_code || "-"}</TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.program_description || "-"}</TableCell>
                  <TableCell sx={{  border: `1px solid ${borderColor}`}}>{student.major || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <br />

      <Dialog
        open={openCorModal}
        onClose={handleCloseCorModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Certificate of Registration - {selectedCorStudentNumber}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ marginTop: "4rem" }}>
            {selectedCorStudentNumber && (
              <CertificateOfRegistration
                student_number={selectedCorStudentNumber}
                onSaved={handleCorSaved}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>


      <Snackbar
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity="info" variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StudentScholarshipList;
