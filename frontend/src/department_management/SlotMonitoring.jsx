import React, { useContext, useEffect, useRef, useState } from "react";
import {
    Box,
    Typography,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    Paper,
    Select,
    MenuItem,
    Button,
    TableBody,
    TextField,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import { SettingsContext } from "../App";
import API_BASE_URL from "../apiConfig";
import axios from "axios";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import EaristLogo from "../assets/EaristLogo.png";

const SectionSlotMonitoring = () => {
    const settings = useContext(SettingsContext);
    const pageId = 123;

    const [borderColor, setBorderColor] = useState("#000000");
    const [titleColor, setTitleColor] = useState("#6D2323");
    const [fetchedLogo, setFetchedLogo] = useState(EaristLogo);
    const [loading, setLoading] = useState(false);
    const [hasAccess, setHasAccess] = useState(null);

    const [schoolYears, setSchoolYears] = useState([]);
    const [semesters, setSchoolSemester] = useState([]);
    const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
    const [selectedSchoolSemester, setSelectedSchoolSemester] = useState('');
    const [selectedActiveSchoolYear, setSelectedActiveSchoolYear] = useState('');
    const [department, setDepartment] = useState([]);
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
    const [programs, setPrograms] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState("");
    const [yearLevels, setYearLevels] = useState([]);
    const [selectedYearLevel, setSelectedYearLevel] = useState("");
    const [campusFilter, setCampusFilter] = useState("");
    const [branches, setBranches] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [slotRows, setSlotRows] = useState([]);
    const [sectionOptionRows, setSectionOptionRows] = useState([]);
    const [selectedSectionFilter, setSelectedSectionFilter] = useState("");
    const [savingSlotBySection, setSavingSlotBySection] = useState({});
    const saveTimersRef = useRef({});
    const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    useEffect(() => {
        if (!settings) return;
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.logo_url) {
            setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
            setFetchedLogo(EaristLogo);
        }
        if (settings?.branches) {
            try {
                const parsed =
                    typeof settings.branches === "string"
                        ? JSON.parse(settings.branches)
                        : settings.branches;
                setBranches(Array.isArray(parsed) ? parsed : []);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCampusFilter((prev) => prev || String(parsed[0].id));
                }
            } catch (err) {
                console.error("Failed to parse branches:", err);
                setBranches([]);
            }
        }
    }, [settings]);

    useEffect(() => {
        const storedUser = localStorage.getItem("email");
        const storedRole = localStorage.getItem("role");
        const storedID = localStorage.getItem("person_id");
        const storedEmployeeID = localStorage.getItem("employee_id");

        if (storedUser && storedRole && storedID && storedEmployeeID) {
            checkAccess(storedEmployeeID);
        } else {
            window.location.href = "/login";
        }
    }, []);

    const checkAccess = async (employeeIDValue) => {
        setLoading(true);
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/page_access/${employeeIDValue}/${pageId}`,
            );
            if (response.data && response.data.page_privilege === 1) {
                setHasAccess(true);
            } else {
                setHasAccess(false);
            }
        } catch (error) {
            console.error("Error checking access:", error);
            setHasAccess(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasAccess !== true) return;
        axios
            .get(`${API_BASE_URL}/get_school_year/`)
            .then((res) => setSchoolYears(res.data))
            .catch((err) => console.error(err));
    }, [hasAccess])

    useEffect(() => {
        if (hasAccess !== true) return;
        axios
            .get(`${API_BASE_URL}/get_school_semester/`)
            .then((res) => setSchoolSemester(res.data))
            .catch((err) => console.error(err));
    }, [hasAccess])

    useEffect(() => {
        if (hasAccess !== true) return;
        axios
            .get(`${API_BASE_URL}/get_year_level`)
            .then((res) => setYearLevels(res.data))
            .catch((err) => console.error(err));
    }, [hasAccess]);

    useEffect(() => {
        if (hasAccess !== true) return;
        axios
            .get(`${API_BASE_URL}/active_school_year`)
            .then((res) => {
                if (res.data.length > 0) {
                    setSelectedSchoolYear(res.data[0].year_id);
                    setSelectedSchoolSemester(res.data[0].semester_id);
                }
            })
            .catch((err) => console.error(err));
    }, [hasAccess]);

    useEffect(() => {
        if (selectedSchoolYear && selectedSchoolSemester) {
            axios
                .get(`${API_BASE_URL}/get_selecterd_year/${selectedSchoolYear}/${selectedSchoolSemester}`)
                .then((res) => {
                    if (res.data.length > 0) {
                        setSelectedActiveSchoolYear(res.data[0].school_year_id);
                    }
                })
                .catch((err) => console.error(err));
        }
    }, [selectedSchoolYear, selectedSchoolSemester]);

    useEffect(() => {
        if (hasAccess !== true) return;
        fetchDepartments();
    }, [hasAccess])

    useEffect(() => {
        if (department.length > 0 && !selectedDepartmentFilter) {
            const firstDeptId = department[0].dprtmnt_id;
            setSelectedDepartmentFilter(firstDeptId);
            fetchPrograms(firstDeptId);
        }
    }, [department, selectedDepartmentFilter]);

    useEffect(() => {
        if (programs.length > 0 && !selectedProgram) {
            setSelectedProgram(programs[0].program_id);
        }
    }, [programs, selectedProgram]);

    useEffect(() => {
        if (yearLevels.length > 0 && !selectedYearLevel) {
            setSelectedYearLevel(yearLevels[0].year_level_id);
        }
    }, [yearLevels, selectedYearLevel]);

    const fetchDepartments = async () => {
        if (hasAccess !== true) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/get_department`);
            setDepartment(res.data);
            console.log(res.data);
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const fetchPrograms = async (dprtmnt_id) => {
        if (hasAccess !== true) return;
        if (!dprtmnt_id) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/api/applied_program/${dprtmnt_id}`);
            setPrograms(res.data);
        } catch (err) {
            console.error("❌ Department fetch error:", err);
        }
    };

    const selectedProgramMeta = programs.find(
        (prog) => String(prog.program_id) === String(selectedProgram),
    );
    const selectedCurriculumId = selectedProgramMeta?.curriculum_id;

    useEffect(() => {
        if (!selectedCurriculumId) {
            setCourses([]);
            setSelectedCourse("");
            return;
        }
        axios
            .get(`${API_BASE_URL}/courses/${selectedCurriculumId}`)
            .then((res) => {
                const taggedCourses = (res.data || []).filter((course) => {
                    const matchesYearLevel =
                        !selectedYearLevel ||
                        String(course.year_level_id) === String(selectedYearLevel);
                    const matchesSemester =
                        !selectedSchoolSemester ||
                        String(course.semester_id) === String(selectedSchoolSemester);
                    return matchesYearLevel && matchesSemester;
                });
                setCourses(taggedCourses);
            })
            .catch((err) => {
                console.error(err);
                setCourses([]);
            });
    }, [selectedCurriculumId, selectedYearLevel, selectedSchoolSemester]);

    useEffect(() => {
        setSelectedCourse("");
    }, [selectedCurriculumId, selectedYearLevel, selectedSchoolSemester]);

    useEffect(() => {
        const fetchSectionOptions = async () => {
            if (
                !selectedDepartmentFilter ||
                !selectedProgram ||
                !selectedCurriculumId ||
                !selectedYearLevel ||
                !selectedSchoolYear ||
                !selectedSchoolSemester ||
                !selectedActiveSchoolYear ||
                !campusFilter
            ) {
                setSectionOptionRows([]);
                return;
            }

            try {
                const sectionResponse = await axios.get(`${API_BASE_URL}/api/slot-monitoring-sections`, {
                    params: {
                        departmentId: selectedDepartmentFilter,
                        programId: selectedProgram,
                        curriculumId: selectedCurriculumId,
                        yearLevelId: selectedYearLevel,
                        yearId: selectedSchoolYear,
                        semesterId: selectedSchoolSemester,
                        campus: campusFilter,
                        activeSchoolYearId: selectedActiveSchoolYear,
                    },
                });

                setSectionOptionRows(sectionResponse.data || []);
            } catch (err) {
                console.error("Error fetching section options:", err);
                setSectionOptionRows([]);
            }
        };

        fetchSectionOptions();
    }, [
        selectedDepartmentFilter,
        selectedProgram,
        selectedYearLevel,
        selectedSchoolYear,
        selectedSchoolSemester,
        selectedActiveSchoolYear,
        campusFilter,
        selectedCurriculumId,
    ]);

    useEffect(() => {
        const fetchSlotMonitoringSections = async () => {
            if (
                !selectedDepartmentFilter ||
                !selectedProgram ||
                !selectedCurriculumId ||
                !selectedYearLevel ||
                !selectedSchoolYear ||
                !selectedSchoolSemester ||
                !selectedActiveSchoolYear ||
                !campusFilter
            ) {
                setSlotRows([]);
                return;
            }

            try {
                const slotResponse = await axios.get(`${API_BASE_URL}/api/slot-monitoring-sections`, {
                    params: {
                        departmentId: selectedDepartmentFilter,
                        programId: selectedProgram,
                        curriculumId: selectedCurriculumId,
                        yearLevelId: selectedYearLevel,
                        yearId: selectedSchoolYear,
                        semesterId: selectedSchoolSemester,
                        campus: campusFilter,
                        activeSchoolYearId: selectedActiveSchoolYear,
                        ...(selectedCourse ? { courseId: selectedCourse } : {}),
                    },
                });
                const rows = slotResponse.data || [];

                if (rows.length === 0) {
                    setSlotRows([]);
                    return;
                }

                const sectionIds = [
                    ...new Set(
                        rows
                            .map((row) => row.department_section_id)
                            .filter(Boolean),
                    ),
                ];

                const curriculumId = rows[0]?.curriculum_id || selectedCurriculumId;

                if (!curriculumId || sectionIds.length === 0) {
                    setSlotRows(rows.map((row) => ({ ...row, enrolled_student: 0 })));
                    return;
                }

                const enrolledResponse = await axios.post(
                    `${API_BASE_URL}/api/slot-monitoring-enrolled-count`,
                    {
                        curriculumId,
                        sectionIds,
                        activeSchoolYearId: selectedActiveSchoolYear,
                        ...(selectedCourse ? { courseId: selectedCourse } : {}),
                    },
                );

                const enrolledMap = new Map(
                    (enrolledResponse.data || []).map((item) => [
                        `${item.department_section_id}:${item.course_id || ""}`,
                        Number(item.enrolled_student) || 0,
                    ]),
                );

                const mergedRows = rows.map((row) => ({
                    ...row,
                    enrolled_student:
                        enrolledMap.get(`${row.department_section_id}:${row.course_id || ""}`) || 0,
                }));

                setSlotRows(mergedRows);
            } catch (err) {
                console.error("Error fetching slot monitoring rows:", err);
                setSlotRows([]);
                showSnackbar("Failed to load slot monitoring records.", "error");
            }
        };

        fetchSlotMonitoringSections();
    }, [
        selectedDepartmentFilter,
        selectedCourse,
        selectedProgram,
        selectedYearLevel,
        selectedSchoolYear,
        selectedSchoolSemester,
        selectedActiveSchoolYear,
        campusFilter,
        selectedCurriculumId,
    ]);

    useEffect(() => {
        if (!selectedProgram && programs.length > 0) {
            setSelectedCourse("");
        }
    }, [selectedProgram, programs.length]);

    useEffect(() => {
        setSelectedSectionFilter("");
    }, [selectedDepartmentFilter, selectedProgram, selectedCurriculumId, selectedYearLevel, selectedSchoolYear, selectedSchoolSemester, campusFilter]);

    const sectionOptions = [
        ...new Map(
            sectionOptionRows.map((row) => [String(row.department_section_id), row]),
        ).values(),
    ];

    const sectionSummaryRows = sectionOptions.map((section) => ({
        ...section,
        course_id: null,
        course_code: "",
        course_description: "",
        schedule: "",
        enrolled_student: null,
    }));

    const filteredSlotRows = selectedSectionFilter
        ? slotRows.filter(
            (row) => String(row.department_section_id) === String(selectedSectionFilter),
        )
        : sectionSummaryRows;

    const subjectRows = selectedSectionFilter
        ? filteredSlotRows.filter((row) => row.course_id)
        : [];

    const selectedBranch = branches.find(
        (branch) => String(branch.id) === String(campusFilter),
    );
    const selectedBranchAddress =
        selectedBranch?.address ||
        selectedBranch?.branch_address ||
        selectedBranch?.campus_address ||
        settings?.campus_address ||
        "Campus Branch Address";

    const handleSchoolYearChange = (event) => {
        setSelectedSchoolYear(event.target.value);
    };

    const handleSchoolSemesterChange = (event) => {
        setSelectedSchoolSemester(event.target.value);
    };

    const handleCollegeChange = (e) => {
        const selectedId = e.target.value;

        setSelectedDepartmentFilter(selectedId);
        setSelectedProgram("");
        setPrograms([]);
        setCourses([]);
        setSelectedCourse("");
        setSlotRows([]);
        fetchPrograms(selectedId);
    };

    const showSnackbar = (message, severity = "success") => {
        setSnackbar({ open: true, message, severity });
    };

    const handleDownloadSubjectsPdf = async () => {
        if (subjectRows.length === 0) {
            showSnackbar("No subjects available for PDF.", "error");
            return;
        }

        const doc = new jsPDF("portrait", "mm", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();

        const schoolYearMeta = schoolYears.find(
            (sy) => String(sy.year_id) === String(selectedSchoolYear),
        );
        const semesterMeta = semesters.find(
            (sem) => String(sem.semester_id) === String(selectedSchoolSemester),
        );
        const schoolYearLabel = schoolYearMeta
            ? `${schoolYearMeta.current_year}-${schoolYearMeta.next_year}`
            : "School Year";
        const semesterLabel = semesterMeta?.semester_description || "Semester";

        const logoUrl = fetchedLogo || EaristLogo;

        const loadImageAsDataUrl = async (url) => {
            const response = await fetch(url, { mode: "cors" });
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        let logoDataUrl = null;
        try {
            logoDataUrl = await loadImageAsDataUrl(logoUrl);
        } catch (err) {
            console.warn("External logo failed, falling back to EaristLogo:", err);
            try {
                logoDataUrl = await loadImageAsDataUrl(EaristLogo);
            } catch (fallbackErr) {
                console.warn("Fallback logo also failed:", fallbackErr);
            }
        }

        const marginX = 14;
        const logoWidth = 25;
        const logoHeight = 25;
        const logoX = marginX;
        const logoY = 8;

        // Mirror logo width on right so text is truly centered
        const textStartX = marginX + logoWidth + 5;
        const textEndX = pageWidth - marginX - logoWidth - 5;
        const textCenterX = (textStartX + textEndX) / 2;
        const maxTextWidth = textEndX - textStartX;

        if (logoDataUrl) {
            const format = logoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
            doc.addImage(logoDataUrl, format, logoX, logoY, logoWidth, logoHeight);
        }

        // Helper: render text with letter spacing
        const drawSpacedText = (text, x, y, align = "center") => {
            const charSpacing = 0;
            const chars = text.split("");
            const totalWidth = chars.reduce((acc, char) => {
                return acc + doc.getTextWidth(char) + charSpacing;
            }, 0);

            let startX = x;
            if (align === "center") startX = x - totalWidth / 2;
            else if (align === "right") startX = x - totalWidth;

            chars.forEach((char) => {
                doc.text(char, startX, y);
                startX += doc.getTextWidth(char) + charSpacing;
            });
        };

        // --- Header Text ---
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        drawSpacedText("Republic of the Philippines", textCenterX, 13);

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        const companyName = settings?.company_name || "Campus Name";
        const nameLines = doc.splitTextToSize(companyName, maxTextWidth);
        nameLines.forEach((line, i) => {
            drawSpacedText(line, textCenterX, 20 + i * 6);
        });

        const nameBlockHeight = nameLines.length * 6;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        drawSpacedText(selectedBranchAddress, textCenterX, 20 + nameBlockHeight);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        drawSpacedText(
            `${schoolYearLabel} , ${semesterLabel}`,
            textCenterX,
            20 + nameBlockHeight + 7
        );

        // --- Divider ---
        const dividerY = Math.max(logoY + logoHeight + 3, 20 + nameBlockHeight + 13);
        doc.setDrawColor(120);
        doc.line(marginX, dividerY, pageWidth - marginX, dividerY);

        // --- Table ---
        autoTable(doc, {
            startY: dividerY + 11,
            head: [["Program Description", "Section", "Subject"]],
            body: subjectRows.map((row) => [
                row.program_description || "-",
                `${row.program_code || ""}-${row.section_description || ""}`,
                row.course_code || "-",
            ]),
            styles: { fontSize: 10 },
            headStyles: {
                fillColor: [109, 35, 35],
            },
        });

        // --- Save ---
        const firstRow = subjectRows[0];
        const rawFileName = `${firstRow.program_code || "program"}-${firstRow.section_description || "section"}.pdf`;
        const safeFileName = rawFileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
        doc.save(safeFileName);
    };

    const handleSlotInputChange = (departmentSectionId, rawValue) => {
        const normalizedValue =
            rawValue === "" ? "" : Math.max(0, Number(rawValue));

        setSlotRows((prev) =>
            prev.map((row) =>
                String(row.department_section_id) === String(departmentSectionId)
                    ? { ...row, max_slots: normalizedValue }
                    : row,
            ),
        );

        if (saveTimersRef.current[departmentSectionId]) {
            clearTimeout(saveTimersRef.current[departmentSectionId]);
        }

        saveTimersRef.current[departmentSectionId] = setTimeout(async () => {
            const parsed = Number(normalizedValue);
            if (rawValue === "" || Number.isNaN(parsed) || parsed < 0) return;

            setSavingSlotBySection((prev) => ({
                ...prev,
                [departmentSectionId]: true,
            }));

            try {
                await axios.put(
                    `${API_BASE_URL}/api/slot-monitoring-sections/${departmentSectionId}/max-slots`,
                    { max_slots: parsed },
                );
                showSnackbar("Max slots saved.");
            } catch (err) {
                console.error("Error auto-saving max slots:", err);
                showSnackbar("Failed to save max slots.", "error");
            } finally {
                setSavingSlotBySection((prev) => ({
                    ...prev,
                    [departmentSectionId]: false,
                }));
            }
        }, 600);
    };

    useEffect(() => {
        return () => {
            Object.values(saveTimersRef.current).forEach((timerId) =>
                clearTimeout(timerId),
            );
        };
    }, []);

    if (loading || hasAccess === null) {
        return <LoadingOverlay open={loading} message="Loading..." />;
    }

    if (!hasAccess) {
        return <Unauthorized />;
    }

    return (
        <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>
            <Typography
                variant="h4"
                sx={{
                    fontWeight: "bold",
                    color: titleColor,
                    fontSize: "36px",
                    background: "white",
                    display: "flex",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                SLOT MONITORING
            </Typography>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />
            <br />
            <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}`, }}>
                <Table>
                    <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', textAlign: "Center" }}>FILTER OPTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                </Table>
            </TableContainer>

            <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}`, }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between", borderBottom: "none" }}>
                                <Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            Campus:
                                        </Typography>
                                        <Select
                                            name="campus"
                                            value={campusFilter}
                                            onChange={(e) => setCampusFilter(e.target.value)}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        marginTop: "8px"
                                                    },
                                                },
                                            }}
                                            sx={{ width: "200px", textAlign: "left" }}
                                        >
                                            {branches.length > 0 ? (
                                                branches.map((branch) => (
                                                    <MenuItem key={branch.id} value={String(branch.id)}>
                                                        {branch.branch}
                                                    </MenuItem>
                                                ))
                                            ) : (
                                                <MenuItem value="">No Branches</MenuItem>
                                            )}
                                        </Select>
                                    </Box>

                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            Year Level:
                                        </Typography>
                                        <Select
                                            name="yearLevel"
                                            value={selectedYearLevel}
                                            onChange={(e) => setSelectedYearLevel(e.target.value)}
                                            sx={{ width: "200px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 410,
                                                        marginTop: "8px"
                                                    },
                                                },
                                            }}
                                        >
                                            {yearLevels.map((yl) => (
                                                <MenuItem key={yl.year_level_id} value={yl.year_level_id}>
                                                    {yl.year_level_description}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                </Box>

                                <Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            College:
                                        </Typography>
                                        <Select
                                            name="college"
                                            value={selectedDepartmentFilter}
                                            onChange={handleCollegeChange}
                                            sx={{ width: "485px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        marginTop: "8px",
                                                        height: "265px"
                                                    },
                                                },
                                            }}
                                        >
                                            {department.map((dep) => (
                                                <MenuItem key={dep.dprtmnt_id} value={dep.dprtmnt_id}>
                                                    {dep.dprtmnt_name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            Program:
                                        </Typography>
                                        <Select
                                            name="program"
                                            value={selectedProgram}
                                            onChange={(e) => setSelectedProgram(e.target.value)}
                                            sx={{ width: "485px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 410,
                                                        marginTop: "8px"
                                                    },
                                                },
                                            }}
                                        >
                                            {programs.map((prog) => (
                                                <MenuItem key={prog.program_id} value={prog.program_id}>
                                                    {prog.program_description} {prog.major}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                </Box>

                                <Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            Section:
                                        </Typography>
                                        <Select
                                            name="sectionFilter"
                                            value={selectedSectionFilter}
                                            onChange={(e) => setSelectedSectionFilter(e.target.value)}
                                            sx={{ width: "230px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 410,
                                                        marginTop: "8px",
                                                    },
                                                },
                                            }}
                                        >
                                            <MenuItem value="">All Sections</MenuItem>
                                            {sectionOptions.map((section) => (
                                                <MenuItem
                                                    key={section.department_section_id}
                                                    value={section.department_section_id}
                                                >
                                                    {section.program_code}-{section.section_description}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            Course:
                                        </Typography>
                                        <Select
                                            name="course"
                                            value={selectedCourse}
                                            onChange={(e) => setSelectedCourse(e.target.value)}
                                            sx={{ width: "230px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        marginTop: "8px",
                                                        height: "265px"
                                                    },
                                                },
                                            }}
                                        >
                                            <MenuItem value="">All Tagged Subjects</MenuItem>
                                            {courses.map((course) => (
                                                <MenuItem key={course.course_id} value={course.course_id}>
                                                    {course.course_code} - {course.course_description}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                </Box>

                                <Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            School Year:
                                        </Typography>
                                        <Select
                                            name="schoolYear"
                                            value={selectedSchoolYear}
                                            onChange={handleSchoolYearChange}
                                            sx={{ width: "200px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 410,
                                                        marginTop: "8px"
                                                    },
                                                },
                                            }}
                                        >
                                            {schoolYears.map((sy) => (
                                                <MenuItem key={sy.year_id} value={sy.year_id}>
                                                    {sy.current_year}-{sy.next_year}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                    <Box sx={{ textAlign: "Center", display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                                        <Typography sx={{ width: "100px", textAlign: "left" }}>
                                            Semester:
                                        </Typography>
                                        <Select
                                            name="semester"
                                            value={selectedSchoolSemester}
                                            onChange={handleSchoolSemesterChange}
                                            sx={{ width: "200px", textAlign: "left" }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        maxHeight: 410,
                                                        marginTop: "8px"
                                                    },
                                                },
                                            }}
                                        >
                                            {semesters.map((sem) => (
                                                <MenuItem key={sem.semester_id} value={sem.semester_id}>
                                                    {sem.semester_description}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                </Box>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ display: "flex", alignItems: "center", gap: "1rem", border: "none", justifyContent: "end" }}>
                                <Button
                                    disabled={filteredSlotRows.length === 0}
                                    sx={{ backgroundColor: settings?.main_button_color || settings?.header_color || "#1976d2", color: "white" }}
                                >
                                    Actual Size
                                </Button>
                                <Button
                                    disabled={!selectedSectionFilter || subjectRows.length === 0}
                                    sx={{ backgroundColor: settings?.main_button_color || settings?.header_color || "#1976d2", color: "white" }}
                                    onClick={() => setSubjectsModalOpen(true)}
                                >
                                    List of Subjects
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                </Table>
            </TableContainer>

            <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}`, mt: 2 }}>
                <Table>
                    <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                        <TableRow>
                            <TableCell sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}`, width: "70px" }}>#</TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}>Section</TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}>Subject</TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}>Schedule</TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", width: "120px", border: `1px solid ${borderColor}` }}>Slots</TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", width: "120px", border: `1px solid ${borderColor}` }}>Enrolled</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredSlotRows.length > 0 ? (
                            filteredSlotRows.map((row, index) => (
                                <TableRow key={`${row.department_section_id}-${row.course_id || "section"}-${index}`}>
                                    <TableCell sx={{ textAlign: "center" }}>{index + 1}</TableCell>
                                    <TableCell sx={{ textAlign: "center" }}>{row.program_code}-{row.section_description || ""}</TableCell>
                                    <TableCell sx={{ textAlign: "center" }}>
                                        {row.course_code || (selectedSectionFilter ? "-" : "Select section to view subjects")}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: "center" }}>
                                        {row.schedule || (selectedSectionFilter ? "-" : "Select section to view schedules")}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: "center" }}>
                                        <TextField
                                            type="number"
                                            size="small"
                                            value={row.max_slots ?? ""}
                                            onChange={(e) =>
                                                handleSlotInputChange(
                                                    row.department_section_id,
                                                    e.target.value,
                                                )
                                            }
                                            inputProps={{ min: 0 }}
                                            sx={{ width: "95px" }}
                                        />
                                        {savingSlotBySection[row.department_section_id] ? (
                                            <Typography sx={{ fontSize: "11px", color: "gray", mt: 0.5 }}>
                                                Saving...
                                            </Typography>
                                        ) : null}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: "center" }}>
                                        {selectedSectionFilter ? row.enrolled_student ?? 0 : "-"}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ textAlign: "center", py: 2 }}>
                                    No records found for the selected filters.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog
                open={subjectsModalOpen}
                onClose={() => setSubjectsModalOpen(false)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>List of Subjects</DialogTitle>
                <DialogContent>
                    <TableContainer component={Paper} sx={{ border: `1px solid ${borderColor}` }}>
                        <Table>
                            <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                                <TableRow>
                                    <TableCell sx={{ color: "white", textAlign: "center" }}>Program Description</TableCell>
                                    <TableCell sx={{ color: "white", textAlign: "center" }}>Section</TableCell>
                                    <TableCell sx={{ color: "white", textAlign: "center" }}>Subject</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {subjectRows.length > 0 ? (
                                    subjectRows.map((row, index) => (
                                        <TableRow key={`subject-row-${index}`}>
                                            <TableCell sx={{ textAlign: "center" }}>
                                                {row.program_description || "-"}
                                            </TableCell>
                                            <TableCell sx={{ textAlign: "center" }}>
                                                {row.program_code || ""}-{row.section_description || ""}
                                            </TableCell>
                                            <TableCell sx={{ textAlign: "center" }}>
                                                {row.course_code || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} sx={{ textAlign: "center", py: 2 }}>
                                            No subjects found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubjectsModalOpen(false)} color="inherit">
                        Close
                    </Button>
                    <Button
                        variant="contained"
                        disabled={subjectRows.length === 0}
                        onClick={handleDownloadSubjectsPdf}
                        sx={{ backgroundColor: settings?.main_button_color || settings?.header_color || "#1976d2" }}
                    >
                        Download PDF
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={2500}
                onClose={() =>
                    setSnackbar((prev) => ({ ...prev, open: false }))
                }
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    severity={snackbar.severity}
                    variant="filled"
                    onClose={() =>
                        setSnackbar((prev) => ({ ...prev, open: false }))
                    }
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default SectionSlotMonitoring;
