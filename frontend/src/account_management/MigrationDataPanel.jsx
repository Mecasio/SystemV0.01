import React, { useState, useEffect, useContext, useRef } from 'react';
import { SettingsContext } from "../App";
import axios from 'axios';
import { Box, Button, Typography, TextField, Paper, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Snackbar, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, MenuItem } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { FaFileExcel } from "react-icons/fa";
import API_BASE_URL from '../apiConfig';
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import EaristLogo from "../assets/EaristLogo.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MigrationDataPanel = () => {
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

    useEffect(() => {
        if (!settings) return;

        // 🎨 Colors
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
        if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);   // ✅ NEW
        if (settings.stepper_color) setStepperColor(settings.stepper_color);           // ✅ NEW

        // 🏫 Logo
        if (settings.logo_url) {
            setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
            setFetchedLogo(EaristLogo);
        }

        // 🏷️ School Information
        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings.short_term) setShortTerm(settings.short_term);
        if (settings.campus_address) setCampusAddress(settings.campus_address);
        if (settings?.branches) {
            try {
                const parsed =
                    typeof settings.branches === "string"
                        ? JSON.parse(settings.branches)
                        : settings.branches;
                setBranches(parsed);
                setCampusFilter((prev) => prev || parsed?.[0]?.id || "");
            } catch (err) {
                console.error("Failed to parse branches:", err);
                setBranches([]);
            }
        }

    }, [settings]);


    const [searchQuery, setSearchQuery] = useState("");
    const [studentInfo, setStudentInfo] = useState(null);
    const [studentGradeList, setStudentGradeList] = useState([]);
    const [campusFilter, setCampusFilter] = useState("");
    const [branches, setBranches] = useState([]);
    const [openAddSubjectDialog, setOpenAddSubjectDialog] = useState(false);
    const [openViewDialog, setOpenViewDialog] = useState(false);
    const [courseList, setCourseList] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [loadingCourses, setLoadingCourses] = useState(false);

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    // Also put it at the very top
    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");

    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);

    // ✅ For Excel Import
    const [excelFile, setExcelFile] = useState(null);

    const handleExcelChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setExcelFile(file);
        }
    };

  const exportExcel = async () => {
  const res = await axios.get(`${API_BASE_URL}/get_students_grouped`);
  const students = res.data;

  const workbook = new ExcelJS.Workbook();

  // GROUP BY PROGRAM
  const grouped = {};
  students.forEach(s => {
    if (!grouped[s.program_code]) grouped[s.program_code] = [];
    grouped[s.program_code].push(s);
  });

  for (const program in grouped) {
    const list = grouped[program];
    const first = list[0];

    // Sheet name = Program Code
    const ws = workbook.addWorksheet(program);

    // ===== HEADER INFO =====
    ws.mergeCells("A1:D1");
    ws.getCell("A1").value = companyName || "SCHOOL NAME";
    ws.getCell("A1").font = { bold: true, size: 16 };
    ws.getCell("A1").alignment = { horizontal: "center" };

    ws.mergeCells("A2:D2");
    ws.getCell("A2").value = campusAddress || "";
    ws.getCell("A2").alignment = { horizontal: "center" };

    ws.mergeCells("A4:D4");
    ws.getCell("A4").value = `${first.dprtmnt_code} - ${first.dprtmnt_name}`;
    ws.getCell("A4").font = { bold: true };
    ws.getCell("A4").alignment = { horizontal: "center" };

    ws.mergeCells("A5:D5");
    ws.getCell("A5").value = `${first.program_code} - ${first.program_description} ${first.major || ""}`;
    ws.getCell("A5").font = { bold: true };
    ws.getCell("A5").alignment = { horizontal: "center" };

    ws.mergeCells("A6:D6");
    ws.getCell("A6").value = "STUDENT LIST";
    ws.getCell("A6").font = { bold: true, size: 14 };
    ws.getCell("A6").alignment = { horizontal: "center" };

    // ===== TABLE HEADER =====
    ws.addRow([]);
    ws.addRow(["#", "Student Number", "Name", "Year Level"]);

    ws.columns = [
      { width: 5 },
      { width: 20 },
      { width: 35 },
      { width: 15 },
    ];

    // ===== DATA =====
    list.forEach((s, i) => {
      ws.addRow([
        i + 1,
        s.student_number,
        `${s.last_name}, ${s.first_name} ${s.middle_name || ""}`,
        s.year_level_description
      ]);
    });

    // ===== BORDERS =====
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "Students_By_Program.xlsx");
};


    const getBase64FromUrl = async (url) => {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const exportPDF = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/get_students_grouped`);
    const students = res.data;
    if (!students.length) return alert("No students found");

    const doc = new jsPDF("landscape", "mm", "a4");

    // GROUP BY PROGRAM
    const grouped = {};
    students.forEach(s => {
      if (!grouped[s.program_code]) grouped[s.program_code] = [];
      grouped[s.program_code].push(s);
    });

    const school = companyName || "School Name";
    const address = campusAddress || "";

    let logoBase64 = null;
    if (fetchedLogo) {
      try {
        logoBase64 = await getBase64FromUrl(fetchedLogo);
      } catch (e) {
        console.warn("Logo failed, using default");
      }
    }

    let firstPage = true;

    for (const program in grouped) {
      if (!firstPage) doc.addPage();
      firstPage = false;

      const list = grouped[program];
      const first = list[0];

      const deptLine = `${first.dprtmnt_code} - ${first.dprtmnt_name}`;
      const programLine = `${first.program_code} - ${first.program_description} ${first.major || ""}`;

      // LOGO
      if (logoBase64) doc.addImage(logoBase64, "PNG", 10, 10, 25, 25);

      // HEADER
      doc.setFont("Times", "Bold");
      doc.setFontSize(12);
      doc.text("Republic of the Philippines", 150, 15, { align: "center" });

      doc.setFontSize(18);
      doc.text(school, 150, 25, { align: "center" });

      doc.setFontSize(11);
      doc.text(address, 150, 32, { align: "center" });

      doc.setFontSize(14);
      doc.text(deptLine, 150, 45, { align: "center" });

      doc.setFontSize(12);
      doc.text(programLine, 150, 52, { align: "center" });

      doc.setFontSize(16);
      doc.text("STUDENT LIST", 150, 62, { align: "center" });

      const tableData = list.map((s, i) => [
        i + 1,
        s.student_number,
        `${s.last_name}, ${s.first_name} ${s.middle_name || ""}`,
        s.year_level_description
      ]);

      autoTable(doc, {
        startY: 70,
        head: [["#", "Student Number", "Name", "Year Level"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [128, 0, 0] },
      });
    }

    doc.save("Students_By_Program.pdf");

  } catch (err) {
    console.error("PDF ERROR FULL:", err);
    alert("PDF export failed");
  }
};

    const handleImportExcel = async () => {
        try {
            if (!selectedFile) {
                setSnackbar({
                    open: true,
                    message: "Please choose a file first!",
                    severity: "warning",
                });
                return;
            }

            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await axios.post(`${API_BASE_URL}/api/person/import`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (res.data.success) {
                setSnackbar({
                    open: true,
                    message: res.data.message || "Excel imported successfully!",
                    severity: "success",
                });
                setExcelFile(null);
            } else {
                setSnackbar({
                    open: true,
                    message: res.data.error || "Failed to import",
                    severity: "error",
                });
            }
        } catch (err) {
            console.error("❌ Import error:", err);
            setSnackbar({
                open: true,
                message: "Import failed: " + (err.response?.data?.error || err.message),
                severity: "error",
            });
        }
    };


    const divToPrintRef = useRef();
    const [showPrintView, setShowPrintView] = useState(false);

    const pageId = 114;
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

    const [openDialog, setOpenDialog] = useState(false);
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [selectedTermContext, setSelectedTermContext] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        if (!settings) return;
        settings.title_color && setTitleColor(settings.title_color);
        settings.subtitle_color && setSubtitleColor(settings.subtitle_color);
        settings.border_color && setBorderColor(settings.border_color);
        settings.main_button_color && setMainButtonColor(settings.main_button_color);
    }, [settings]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        try {
            if (!selectedFile) {
                setSnackbar({
                    open: true,
                    message: "Please choose a file first!",
                    severity: "warning",
                });
                return;
            }

            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("campus", campusFilter);

            const res = await axios.post(`${API_BASE_URL}/api/import-xlsx`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (res.data.success) {
                setSnackbar({
                    open: true,
                    message: res.data.message || "Excel imported successfully!",
                    severity: "success",
                });
                setSelectedFile(null);
            } else {
                setSnackbar({
                    open: true,
                    message: res.data.error || "Failed to import",
                    severity: "error",
                });
            }
        } catch (err) {
            console.error("❌ Import error:", err);
            setSnackbar({
                open: true,
                message: "Import failed: " + (err.response?.data?.error || err.message),
                severity: "error",
            });
        }
    };


    const formatFileSize = (bytes) => {
        if (!bytes) return "";
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(2)} KB`;
        return `${(kb / 1024).toFixed(2)} MB`;
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
            <div style={{ height: "10px" }}></div>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} >
                <Typography variant="h4" fontWeight="bold" style={{ color: titleColor, }}>
                    MIGRATION DATA PANEL
                </Typography>
            </Box>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />

            <Box>
                <Typography>
                    Student Grades Migration Button
                </Typography>
                <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 200, mt: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: 2.5, marginRight: 2 }}>
                        <Typography>
                            Campus:
                        </Typography>
                        <TextField
                            select
                            label="Campus"
                            size="small"
                            value={campusFilter}
                            onChange={(e) => setCampusFilter(e.target.value)}
                            SelectProps={{ native: true }}
                            sx={{ width: 150 }}
                        >
                            {branches.map((branch) => (
                                <option key={branch.id ?? branch.branch} value={branch.id ?? ""}>
                                    {branch.branch}
                                </option>
                            ))}
                        </TextField>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 200 }}>

                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                            id="grades-excel-upload"
                        />


                        <div ref={divToPrintRef} style={{ position: "absolute", left: "-9999px", top: 0 }}></div>
                        <button
                            onClick={() => document.getElementById("grades-excel-upload").click()}
                            style={{
                                border: "2px solid green",
                                backgroundColor: "#f0fdf4",
                                color: "green",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "bold",
                                height: "50px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                justifyContent: "center",
                                userSelect: "none",
                                width: "200px",

                            }}
                            type="button"
                        >
                            <FaFileExcel size={20} />
                            Choose Excel
                        </button>

                        {selectedFile && (
                            <Typography
                                sx={{
                                    mt: 1,
                                    fontSize: "13px",
                                    color: "#333",
                                    fontStyle: "italic"
                                }}
                            >
                                📄 {selectedFile.name} ({formatFileSize(selectedFile.size)})
                            </Typography>
                        )}
                    </Box>

                    <Button
                        variant="contained"
                        fullWidth
                        sx={{
                            background: `${mainButtonColor}`,
                            color: "white",
                            height: "50px",
                            width: "200px",
                            fontWeight: "bold",
                            border: "2px solid black"
                        }}
                        onClick={handleImport}
                    >
                        IMPORT
                    </Button>

                </Box>
            </Box>


            <Box sx={{ mt: 5 }}>
                <Typography>
                    Upload Personal Information
                </Typography>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    width="100%"
                    mb={2}
                >
                    {/* RIGHT SIDE — Choose Excel + Import */}
                    <Box display="flex" alignItems="center" gap={2}>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleExcelChange}
                            style={{ display: "none" }}
                            id="excel-upload"
                        />

                        {/* Choose Excel Button */}
                        <button
                            onClick={() => document.getElementById("excel-upload").click()}
                            style={{
                                padding: "5px 20px",
                                border: "2px solid green",
                                backgroundColor: "#f0fdf4",
                                color: "green",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "bold",
                                height: "50px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                width: "175px",
                            }}
                            type="button"
                        >
                            <FaFileExcel size={20} />
                            Choose Excel
                        </button>

                        {excelFile && (
                            <Typography
                                sx={{
                                    mt: 1,
                                    fontSize: "13px",
                                    color: "#333",
                                    fontStyle: "italic"
                                }}
                            >
                                📄 {excelFile.name} ({formatFileSize(excelFile.size)})
                            </Typography>
                        )}

                        {/* Import Button */}
                        <Button
                            onClick={handleImportExcel}
                            variant="contained"
                            sx={{
                                backgroundColor: settings?.header_color || "#1976d2",
                                border: `1px solid ${borderColor}`,
                                color: "white",
                                height: "50px",
                                width: "175px",
                                fontWeight: "bold",
                            }}
                        >
                            Import
                        </Button>
                    </Box>
                </Box>


                <Button onClick={exportExcel}>Export Excel</Button>
                <Button onClick={exportPDF}>Export PDF</Button>
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    )
}

export default MigrationDataPanel;
