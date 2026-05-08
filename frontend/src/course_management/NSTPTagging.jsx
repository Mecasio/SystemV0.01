import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  Chip,
  Divider,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Search as SearchIcon,
  PersonAdd as EnrollIcon,
  PersonRemove as UnenrollIcon,
  GroupAdd as EnrollAllIcon,
  GroupRemove as UnenrollAllIcon,
  CheckCircle as EnrolledIcon,
} from "@mui/icons-material";
import API_BASE_URL from "../apiConfig";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";

// ── NSTP type config ──────────────────────────────────────────────────────────
const NSTP_TYPES = [
  {
    key: "CWTS",
    label: "CWTS",
    component: 1,
    color: "#1B5E20",
    bg: "#E8F5E9",
    border: "#2E7D32",
  },
  {
    key: "LTS",
    label: "LTS",
    component: 2,
    color: "#0D47A1",
    bg: "#E3F2FD",
    border: "#1565C0",
  },
  {
    key: "MTS",
    label: "MTS",
    component: 3,
    color: "#4A148C",
    bg: "#F3E5F5",
    border: "#6A1B9A",
  },
];

// Maps NSTP key → numeric component value sent to the backend
// CWTS = 1, LTS = 2, MTS = 3
const NSTP_COMPONENT_MAP = {
  CWTS: 1,
  LTS: 2,
  MTS: 3,
};

// Maps numeric component from backend → NSTP key for display
// 1 = CWTS, 2 = LTS, 3 = MTS
const NSTP_COMPONENT_REVERSE_MAP = {
  1: "CWTS",
  2: "LTS",
  3: "MTS",
};

const NSTPTagging = () => {
  const settings = useContext(SettingsContext);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [mainButtonColor, setMainButtonColor] = useState("#1B5E20");
  const [headerColor, setHeaderColor] = useState("#1B5E20");
  const [borderColor, setBorderColor] = useState("#c8e6c9");
  const [titleColor, setTitleColor] = useState("#1B5E20");

  useEffect(() => {
    if (!settings) return;
    if (settings.main_button_color)
      setMainButtonColor(settings.main_button_color);
    if (settings.header_color) setHeaderColor(settings.header_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.title_color) setTitleColor(settings.title_color);
  }, [settings]);

  // ── Auth / access ─────────────────────────────────────────────────────────
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [employeeID, setEmployeeID] = useState("");
  const pageId = 145;
  const auditConfig = {
    headers: {
      "x-audit-actor-id":
        employeeID ||
        localStorage.getItem("employee_id") ||
        localStorage.getItem("email") ||
        "unknown",
      "x-audit-actor-role": localStorage.getItem("role") || "registrar",
    },
  };

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedRole && storedID) {
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

  const checkAccess = async (empID) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/page_access/${empID}/${pageId}`,
      );
      setHasAccess(res.data?.page_privilege === 1);
    } catch {
      setHasAccess(false);
    }
  };

  // ── Dropdown data ─────────────────────────────────────────────────────────
  const [departmentSections, setDepartmentSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [selectedSection, setSelectedSection] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedNstp, setSelectedNstp] = useState("CWTS");

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [secRes, yrRes, semRes, activeRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/department_section`),
          axios.get(`${API_BASE_URL}/get_school_year`),
          axios.get(`${API_BASE_URL}/get_school_semester`),
          axios.get(`${API_BASE_URL}/active_school_year`),
        ]);
        setDepartmentSections(secRes.data || []);
        setSchoolYears(yrRes.data || []);
        setSemesters(semRes.data || []);

        if (activeRes.data?.length > 0) {
          const active = activeRes.data[0];
          setSelectedYear(active.year_id);
          setSelectedSemester(active.semester_id);
        }
      } catch (err) {
        console.error("Failed to fetch dropdowns:", err);
      }
    };
    fetchDropdowns();
  }, []);

  // ── Table data ────────────────────────────────────────────────────────────
  // allSectionStudents — full section list, never filtered out
  const [allSectionStudents, setAllSectionStudents] = useState([]);
  const [taggedStudents, setTaggedStudents] = useState([]);
  // taggedNumbers — Set of student_number strings for O(1) button state lookup
  const [taggedNumbers, setTaggedNumbers] = useState(new Set());

  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── Resolve active_school_year_id ─────────────────────────────────────────
  const [activeSYID, setActiveSYID] = useState("");

  useEffect(() => {
    if (!selectedYear || !selectedSemester) return;
    axios
      .get(
        `${API_BASE_URL}/get_selecterd_year/${selectedYear}/${selectedSemester}`,
      )
      .then((res) => {
        if (res.data?.length > 0) setActiveSYID(res.data[0].school_year_id);
      })
      .catch(() => {});
  }, [selectedYear, selectedSemester]);

  // ── Fetch all students in section — left panel never filters anyone out ───
  const fetchSectionStudents = async () => {
    const res = await axios.get(`${API_BASE_URL}/get_student_per_section`, {
      params: {
        department_section_id: selectedSection,
        active_school_year_id: activeSYID,
      },
    });
    setAllSectionStudents(res.data || []);
  };

  const fetchTaggedStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/get_nstp_tagged_student`, {
        params: {
          department_section_id: selectedSection,
          active_school_year_id: activeSYID,
        },
      });
      const tagged = Array.isArray(res.data) ? res.data : [];
      setTaggedStudents(tagged);
      setTaggedNumbers(new Set(tagged.map((s) => String(s.student_number))));
    } catch (err) {
      if (err.response?.status === 404) {
        setTaggedStudents([]);
        setTaggedNumbers(new Set());
      } else {
        console.error("Failed to fetch tagged students:", err);
      }
    }
  };

  // ── Fetch both panels — used after Enroll All / Unenroll All ─────────────
  const fetchBothPanels = async () => {
    await Promise.all([fetchSectionStudents(), fetchTaggedStudents()]);
  };

  const syncTaggedState = (students) => {
    setTaggedStudents(students);
    setTaggedNumbers(new Set(students.map((s) => String(s.student_number))));
  };

  const refreshTaggedStudentsInBackground = () => {
    fetchTaggedStudents().catch((err) => {
      console.error("Background refresh for tagged students failed:", err);
    });
  };

  // ── Search — fetches both panels so tagged students appear immediately ────
  const handleSearch = async () => {
    if (!selectedSection || !activeSYID) {
      setSnackbar({
        open: true,
        message: "Please select all fields before searching.",
        severity: "warning",
      });
      return;
    }
    setSearching(true);
    try {
      await Promise.all([fetchSectionStudents(), fetchTaggedStudents()]);
      setSearched(true);
    } catch (err) {
      console.error("Search error:", err);
      setSnackbar({
        open: true,
        message: "Failed to fetch students.",
        severity: "error",
      });
    } finally {
      setSearching(false);
    }
  };

  // ── Enroll / Unenroll ─────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);

  const getSectionMeta = () => {
    const sec = departmentSections.find(
      (s) => String(s.department_section_id) === String(selectedSection),
    );
    return {
      department_section_id: selectedSection,
      active_school_year_id: activeSYID,
      curriculum_id: sec?.curriculum_id || "",
    };
  };

  const buildOptimisticTaggedStudent = (studentNumber) => {
    const student = allSectionStudents.find(
      (s) => String(s.student_number) === String(studentNumber),
    );

    if (!student) return null;

    return {
      ...student,
      component: NSTP_COMPONENT_MAP[selectedNstp],
    };
  };

  const addOptimisticTaggedStudent = (studentNumber) => {
    const nextStudent = buildOptimisticTaggedStudent(studentNumber);
    if (!nextStudent) return;

    syncTaggedState([
      ...taggedStudents.filter(
        (s) => String(s.student_number) !== String(studentNumber),
      ),
      nextStudent,
    ]);
  };

  const removeOptimisticTaggedStudent = (studentNumber) => {
    syncTaggedState(
      taggedStudents.filter(
        (s) => String(s.student_number) !== String(studentNumber),
      ),
    );
  };

  // ── Enroll All ────────────────────────────────────────────────────────────
  const handleEnrollAll = async () => {
    setActionLoading(true);
    try {
      const meta = getSectionMeta();
      await axios.put(`${API_BASE_URL}/enroll_nstp_component`, {
        ...meta,
        nstp_type: NSTP_COMPONENT_MAP[selectedNstp],
      }, auditConfig);
      syncTaggedState(
        allSectionStudents.map((student) => ({
          ...student,
          component: NSTP_COMPONENT_MAP[selectedNstp],
        })),
      );
      setSnackbar({
        open: true,
        message: `All students enrolled in ${selectedNstp}.`,
        severity: "success",
      });
      fetchBothPanels().catch((err) => {
        console.error("Background refresh after NSTP enroll all failed:", err);
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Enroll all failed.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Unenroll All ──────────────────────────────────────────────────────────
  const handleUnenrollAll = async () => {
    setActionLoading(true);
    try {
      const meta = getSectionMeta();
      await axios.put(`${API_BASE_URL}/unenroll_nstp_component`, meta, auditConfig);
      syncTaggedState([]);
      setSnackbar({
        open: true,
        message: "All students unenrolled.",
        severity: "success",
      });
      fetchBothPanels().catch((err) => {
        console.error("Background refresh after NSTP unenroll all failed:", err);
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Unenroll all failed.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Enroll Single — sends numeric component, only refreshes tagged panel ──
  const handleEnrollSingle = async (studentNumber) => {
    try {
      const meta = getSectionMeta();
      await axios.put(
        `${API_BASE_URL}/enroll_nstp_component/${studentNumber}`,
        {
          ...meta,
          nstp_type: NSTP_COMPONENT_MAP[selectedNstp],
        },
        auditConfig,
      );
      addOptimisticTaggedStudent(studentNumber);
      setSnackbar({
        open: true,
        message: `Student ${studentNumber} enrolled in ${selectedNstp}.`,
        severity: "success",
      });
      // Only refresh tagged panel — left panel stays intact
      refreshTaggedStudentsInBackground();
    } catch (err) {
      setSnackbar({
        open: true,
        message: `Failed to enroll ${studentNumber}.`,
        severity: "error",
      });
    }
  };

  // ── Unenroll Single — only refreshes tagged panel ─────────────────────────
  const handleUnenrollSingle = async (studentNumber) => {
    try {
      const meta = getSectionMeta();
      await axios.put(
        `${API_BASE_URL}/unenroll_nstp_component/${studentNumber}`,
        meta,
        auditConfig,
      );
      removeOptimisticTaggedStudent(studentNumber);
      setSnackbar({
        open: true,
        message: `Student ${studentNumber} unenrolled.`,
        severity: "success",
      });
      // Only refresh tagged panel — left panel stays intact
      refreshTaggedStudentsInBackground();
    } catch (err) {
      setSnackbar({
        open: true,
        message: `Failed to unenroll ${studentNumber}.`,
        severity: "error",
      });
    }
  };

  // ── Snackbar ──────────────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (loading || hasAccess === null)
    return <LoadingOverlay open={loading} message="Loading..." />;
  if (!hasAccess) return <Unauthorized />;

  // ── Shared table styles ───────────────────────────────────────────────────
  const thStyle = {
    backgroundColor: headerColor || "#1B5E20",
    color: "#fff",
    fontWeight: 600,
    fontSize: "13px",
    padding: "10px 12px",
    border: "none",
    whiteSpace: "nowrap",
  };

  const tdStyle = {
    fontSize: "13px",
    padding: "9px 12px",
    borderBottom: `1px solid ${borderColor}`,
  };

  const activeNstp =
    NSTP_TYPES.find((n) => n.key === selectedNstp) || NSTP_TYPES[0];
  const canManageStudents = Boolean(selectedSection && activeSYID);

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        paddingRight: 2,
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
          px: 1,
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
          NSTP TAGGING PANEL
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${borderColor}`,
          borderRadius: "10px",
          p: 2.5,
          mb: 3,
          backgroundColor: "#fff",
        }}
      >
        <Typography
          sx={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#888",
            letterSpacing: "0.08em",
            mb: 1.5,
            textTransform: "uppercase",
          }}
        >
          Filter
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {/* Department Section — coerce to string to fix MUI value mismatch */}
          <FormControl size="small" sx={{ minWidth: 260, flex: "1 1 260px" }}>
            <InputLabel>Department Section</InputLabel>
            <Select
              value={String(selectedSection || "")}
              label="Department Section"
              onChange={(e) => setSelectedSection(e.target.value)}
            >
              <MenuItem value="" disabled>
                Select a Department Section
              </MenuItem>
              {departmentSections.map((sec) => {
                const val = String(sec.department_section_id ?? "");
                return (
                  <MenuItem key={val} value={val}>
                    {sec.program_code} {sec.major ? `(${sec.major})` : ""} —{" "}
                    {sec.section_description}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {/* School Year */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>School Year</InputLabel>
            <Select
              value={selectedYear}
              label="School Year"
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <MenuItem value="" disabled>
                Select Year
              </MenuItem>
              {schoolYears.map((yr) => (
                <MenuItem key={yr.year_id} value={yr.year_id}>
                  {yr.current_year} – {yr.next_year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Semester */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Semester</InputLabel>
            <Select
              value={selectedSemester}
              label="Semester"
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <MenuItem value="" disabled>
                Select Semester
              </MenuItem>
              {semesters.map((sem) => (
                <MenuItem key={sem.semester_id} value={sem.semester_id}>
                  {sem.semester_description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Search Button */}
          <Button
            variant="contained"
            startIcon={
              searching ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SearchIcon />
              )
            }
            disabled={searching}
            onClick={handleSearch}
            sx={{
              backgroundColor: mainButtonColor,
              color: "#fff",
              fontWeight: 600,
              height: "40px",
              px: 3,
              borderRadius: "8px",
              textTransform: "none",
              "&:hover": { backgroundColor: mainButtonColor, opacity: 0.88 },
            }}
          >
            {searching ? "Searching…" : "Search"}
          </Button>
        </Box>
      </Paper>

      {/* ── NSTP Type Selector + Enroll All / Unenroll All ───────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography
          sx={{ fontSize: "13px", fontWeight: 600, color: "#555", mr: 0.5 }}
        >
          NSTP Type:
        </Typography>

        {NSTP_TYPES.map((type) => (
          <Button
            key={type.key}
            onClick={() => setSelectedNstp(type.key)}
            variant={selectedNstp === type.key ? "contained" : "outlined"}
            sx={{
              fontWeight: 700,
              fontSize: "13px",
              height: "36px",
              px: 2.5,
              borderRadius: "8px",
              textTransform: "none",
              border: `2px solid ${type.border}`,
              backgroundColor:
                selectedNstp === type.key ? type.border : "transparent",
              color: selectedNstp === type.key ? "#fff" : type.color,
              "&:hover": {
                backgroundColor:
                  selectedNstp === type.key ? type.border : type.bg,
                border: `2px solid ${type.border}`,
              },
            }}
          >
            {type.label}
          </Button>
        ))}

        <Box sx={{ flex: 1 }} />

        {/* Enroll All */}
        <Tooltip
          title={
            canManageStudents
              ? `Enroll all students in ${selectedNstp} (component ${NSTP_COMPONENT_MAP[selectedNstp]})`
              : "Please select a section, school year, and semester first"
          }
        >
          <span>
            <Button
              variant="contained"
              startIcon={
                actionLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <EnrollAllIcon />
                )
              }
              disabled={actionLoading || !canManageStudents}
              onClick={handleEnrollAll}
              sx={{
                backgroundColor: activeNstp.border,
                color: "#fff",
                fontWeight: 600,
                fontSize: "12px",
                height: "36px",
                px: 2,
                borderRadius: "8px",
                textTransform: "none",
                "&:hover": {
                  backgroundColor: activeNstp.border,
                  opacity: 0.85,
                },
              }}
            >
              Enroll All ({selectedNstp})
            </Button>
          </span>
        </Tooltip>

        {/* Unenroll All */}
        <Tooltip
          title={
            canManageStudents
              ? "Unenroll all tagged students"
              : "Please select a section, school year, and semester first"
          }
        >
          <span>
            <Button
              variant="outlined"
              startIcon={<UnenrollAllIcon />}
              disabled={actionLoading || !canManageStudents}
              onClick={handleUnenrollAll}
              sx={{
                fontWeight: 600,
                fontSize: "12px",
                height: "36px",
                px: 2,
                borderRadius: "8px",
                textTransform: "none",
                border: "2px solid #c62828",
                color: "#c62828",
                "&:hover": {
                  backgroundColor: "#ffebee",
                  border: "2px solid #c62828",
                },
              }}
            >
              Unenroll All
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* ── Two-panel table layout ────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2.5 }}>
        {/* ── LEFT: All Section Students ───────────────────────────────── */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography fontWeight={600} fontSize="14px" color="#333">
              Section Students
            </Typography>
            <Chip
              label={allSectionStudents.length}
              size="small"
              sx={{
                backgroundColor: "#e8f5e9",
                color: "#2e7d32",
                fontWeight: 700,
                fontSize: "11px",
                height: "20px",
              }}
            />
          </Box>

          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${borderColor}`,
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {[
                      "#",
                      "Student No.",
                      "Student Name",
                      "Program",
                      "Year Level",
                      "Action",
                    ].map((h) => (
                      <TableCell key={h} sx={thStyle}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allSectionStudents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        sx={{
                          textAlign: "center",
                          py: 4,
                          color: "#aaa",
                          fontSize: "13px",
                        }}
                      >
                        {searched
                          ? "No students found in this section"
                          : "Search a section to load students"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    allSectionStudents.map((s, idx) => {
                      const isTagged = taggedNumbers.has(
                        String(s.student_number),
                      );
                      return (
                        <TableRow
                          key={s.student_number}
                          sx={{
                            // Subtle green tint for already-tagged rows
                            backgroundColor: isTagged ? "#f1f8f1" : "inherit",
                            "&:hover": {
                              backgroundColor: isTagged ? "#e8f5e9" : "#f9fbe7",
                            },
                          }}
                        >
                          <TableCell
                            sx={{ ...tdStyle, color: "#888", width: "36px" }}
                          >
                            {idx + 1}
                          </TableCell>
                          <TableCell sx={tdStyle}>{s.student_number}</TableCell>
                          <TableCell sx={tdStyle}>
                            {s.last_name}, {s.first_name} {s.middle_name || ""}
                          </TableCell>
                          <TableCell sx={tdStyle}>{s.program_code}</TableCell>
                          <TableCell sx={tdStyle}>
                            {s.year_level_description || s.year_level}
                          </TableCell>
                          <TableCell sx={tdStyle}>
                            {isTagged ? (
                              // Already tagged — disabled "Enrolled" button
                              <Button
                                size="small"
                                variant="outlined"
                                disabled
                                startIcon={
                                  <EnrolledIcon
                                    sx={{ fontSize: "14px !important" }}
                                  />
                                }
                                sx={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  height: "28px",
                                  px: 1.5,
                                  borderRadius: "6px",
                                  textTransform: "none",
                                  minWidth: "unset",
                                  color: "#2e7d32 !important",
                                  borderColor: "#2e7d32 !important",
                                  opacity: 0.7,
                                }}
                              >
                                Enrolled
                              </Button>
                            ) : (
                              // Not tagged — active "Enroll" button
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={
                                  <EnrollIcon
                                    sx={{ fontSize: "14px !important" }}
                                  />
                                }
                                onClick={() =>
                                  handleEnrollSingle(s.student_number)
                                }
                                sx={{
                                  backgroundColor: activeNstp.border,
                                  color: "#fff",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  height: "28px",
                                  px: 1.5,
                                  borderRadius: "6px",
                                  textTransform: "none",
                                  minWidth: "unset",
                                  "&:hover": {
                                    backgroundColor: activeNstp.border,
                                    opacity: 0.85,
                                  },
                                }}
                              >
                                Enroll
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* ── RIGHT: Tagged Students ────────────────────────────────────── */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography fontWeight={600} fontSize="14px" color="#333">
              Tagged Students
            </Typography>
            <Chip
              label={taggedStudents.length}
              size="small"
              sx={{
                backgroundColor: "#e3f2fd",
                color: "#1565c0",
                fontWeight: 700,
                fontSize: "11px",
                height: "20px",
              }}
            />
          </Box>

          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${borderColor}`,
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {[
                      "#",
                      "Student No.",
                      "Student Name",
                      "Program",
                      "Year Level",
                      "NSTP",
                      "Action",
                    ].map((h) => (
                      <TableCell key={h} sx={thStyle}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {taggedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        sx={{
                          textAlign: "center",
                          py: 4,
                          color: "#aaa",
                          fontSize: "13px",
                        }}
                      >
                        No tagged students yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    taggedStudents.map((s, idx) => {
                      // Backend returns numeric component (1, 2, 3) in s.component
                      // Convert back to string key for color/label lookup
                      const nstpKey =
                        NSTP_COMPONENT_REVERSE_MAP[s.component] || "CWTS";
                      const nstpType =
                        NSTP_TYPES.find((n) => n.key === nstpKey) ||
                        NSTP_TYPES[0];

                      return (
                        <TableRow
                          key={s.student_number}
                          sx={{ "&:hover": { backgroundColor: "#fff8e1" } }}
                        >
                          <TableCell
                            sx={{ ...tdStyle, color: "#888", width: "36px" }}
                          >
                            {idx + 1}
                          </TableCell>
                          <TableCell sx={tdStyle}>{s.student_number}</TableCell>
                          <TableCell sx={tdStyle}>
                            {s.last_name}, {s.first_name} {s.middle_name || ""}
                          </TableCell>
                          <TableCell sx={tdStyle}>{s.program_code}</TableCell>
                          <TableCell sx={tdStyle}>
                            {s.year_level_description || s.year_level}
                          </TableCell>
                          <TableCell sx={tdStyle}>
                            <Chip
                              label={nstpKey}
                              size="small"
                              sx={{
                                backgroundColor: nstpType.bg,
                                color: nstpType.color,
                                fontWeight: 700,
                                fontSize: "11px",
                                height: "22px",
                                border: `1px solid ${nstpType.border}`,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={tdStyle}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={
                                <UnenrollIcon
                                  sx={{ fontSize: "14px !important" }}
                                />
                              }
                              onClick={() =>
                                handleUnenrollSingle(s.student_number)
                              }
                              sx={{
                                fontSize: "11px",
                                fontWeight: 600,
                                height: "28px",
                                px: 1.5,
                                borderRadius: "6px",
                                textTransform: "none",
                                minWidth: "unset",
                                border: "1.5px solid #c62828",
                                color: "#c62828",
                                "&:hover": {
                                  backgroundColor: "#ffebee",
                                  border: "1.5px solid #c62828",
                                },
                              }}
                            >
                              Unenroll
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>

      {/* ── Snackbar ───────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NSTPTagging;
