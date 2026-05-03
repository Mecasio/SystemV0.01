import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import API_BASE_URL from "../apiConfig";

import {
    Box,
    Typography,
    Card,
    TextField,
    Button,
    Grid,
    Switch,
    Stack,
    Snackbar,
    Alert,
    InputAdornment,
    IconButton,
    Tooltip,
    Chip,
    Divider,
    Collapse,
    Paper,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import SubjectIcon from "@mui/icons-material/Subject";
import ScoreIcon from "@mui/icons-material/Score";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BarChartIcon from "@mui/icons-material/BarChart";
import CircleIcon from "@mui/icons-material/Circle";
import SchoolIcon from "@mui/icons-material/School";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import CampaignIcon from "@mui/icons-material/Campaign";
import KeyIcon from "@mui/icons-material/Key";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PeopleIcon from "@mui/icons-material/People";
import { useNavigate } from "react-router-dom";

const AdminSubjects = () => {
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



    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);
    const pageId = 145;

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

    const tabs = [
        {
            label: "Room Registration",
            to: "/room_registration",
            icon: <KeyIcon fontSize="large" />,
        },
        {
            label: "Verify Documents Room Assignment",
            to: "/verify_document_schedule",
            icon: <MeetingRoomIcon fontSize="large" />,
        },

        {
            label: "Evaluator's Applicant List",
            to: "/evaluator_schedule_room_list",
            icon: <PeopleIcon fontSize="large" />,
        },
        {
            label: "Entrance Exam Room Assignment",
            to: "/assign_entrance_exam",
            icon: <MeetingRoomIcon fontSize="large" />,
        },

        {
            label: "Proctor's Applicant List",
            to: "/admission_schedule_room_list",
            icon: <PeopleIcon fontSize="large" />,
        },

        {
            label: "Subject Management",
            to: "/applicant_exam_subjects",
            icon: <SchoolIcon fontSize="large" />,
        },

        {
            label: "Announcement",
            to: "/announcement_for_admission",
            icon: <CampaignIcon fontSize="large" />,
        },
    ];

    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(5);
    const [clickedSteps, setClickedSteps] = useState(
        Array(tabs.length).fill(false),
    );

    const handleStepClick = (index, to) => {
        setActiveStep(index);
        navigate(to); // this will actually change the page
    };



    const [subjects, setSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState({ name: "", max_score: "" });
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/subjects`);
            setSubjects(res.data || []);
        } catch {
            setSubjects([]);
        }
    };

    const handleChange = (index, field, value) => {
        const updated = [...subjects];
        updated[index][field] = value;
        setSubjects(updated);
    };

    const handleUpdate = async (subject) => {
        try {
            await axios.put(`${API_BASE_URL}/api/subjects/${subject.id}`, subject);
            setSnack({ open: true, message: "Subject updated successfully.", severity: "success" });
            fetchSubjects();
        } catch {
            setSnack({ open: true, message: "Failed to update subject.", severity: "error" });
        }
    };

    const handleCreate = async () => {
        if (!newSubject.name || !newSubject.max_score) {
            setSnack({ open: true, message: "Please fill in all fields.", severity: "warning" });
            return;
        }
        try {
            await axios.post(`${API_BASE_URL}/api/subjects`, newSubject);
            setSnack({ open: true, message: "Subject created successfully.", severity: "success" });
            setNewSubject({ name: "", max_score: "" });
            setShowCreate(false);
            fetchSubjects();
        } catch {
            setSnack({ open: true, message: "Failed to create subject.", severity: "error" });
        }
    };

    const filtered = subjects.filter((s) =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeCount = subjects.filter((s) => s.is_active === 1).length;
    const avgScore = subjects.length
        ? Math.round(subjects.reduce((a, s) => a + Number(s.max_score || 0), 0) / subjects.length)
        : 0;


    if (loading || hasAccess === null) return <LoadingOverlay open={loading} message="Loading..." />;
    if (!hasAccess) return <Unauthorized />;


    return (
        <Box
            sx={{
                height: "calc(100vh - 150px)",
                overflowY: "auto",
                backgroundColor: "transparent",
                mt: 1,
                padding: 2,
                paddingRight: 1,
            }}
        >
            {/* ── Header ── */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 2,
                    mb: 2,
                }}
            >
                <Typography
                    variant="h4"
                    sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
                >
                    SUBJECT MANAGEMENT
                </Typography>

                <TextField
                    size="small"
                    placeholder="Search subjects…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                        width: 320,
                        backgroundColor: "#fff",
                        borderRadius: 1,
                        minWidth: 220,
                        "& .MuiOutlinedInput-root": { borderRadius: "10px" },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: "gray", fontSize: 20 }} />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />

            <br />
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "nowrap", // ❌ prevent wrapping
                    width: "100%",
                    mt: 1,
                    gap: 2,
                }}
            >
                {tabs.map((tab, index) => (
                    <Card
                        key={index}
                        onClick={() => handleStepClick(index, tab.to)}
                        sx={{
                            flex: `1 1 ${100 / tabs.length}%`, // evenly divide row
                            height: 135,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            borderRadius: 2,
                            border: `1px solid ${borderColor}`,
                            backgroundColor:
                                activeStep === index
                                    ? settings?.header_color || "#1976d2"
                                    : "#E8C999",
                            color: activeStep === index ? "#fff" : "#000",
                            boxShadow:
                                activeStep === index
                                    ? "0px 4px 10px rgba(0,0,0,0.3)"
                                    : "0px 2px 6px rgba(0,0,0,0.15)",
                            transition: "0.3s ease",
                            "&:hover": {
                                backgroundColor: activeStep === index ? "#000000" : "#f5d98f",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                            }}
                        >
                            <Box sx={{ fontSize: 40, mb: 1 }}>{tab.icon}</Box>
                            <Typography
                                sx={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}
                            >
                                {tab.label}
                            </Typography>
                        </Box>
                    </Card>
                ))}
            </Box>
            <br />
            <br />

            {/* ── Add Subject Toggle ── */}
            <Box sx={{ mb: 2 }}>
                <Button
                    variant={showCreate ? "outlined" : "contained"}
                    color={showCreate ? "error" : "primary"}
                    startIcon={showCreate ? <ExpandLessIcon /> : <AddCircleOutlineIcon />}
                    endIcon={showCreate ? null : <ExpandMoreIcon />}
                    onClick={() => setShowCreate((p) => !p)}
                    sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        fontWeight: 600
                    }}
                >
                    {showCreate ? "Cancel" : "Add New Subject"}
                </Button>
                <Collapse in={showCreate}>
                    <Card
                        elevation={0}
                        sx={{
                            mt: 2,
                            p: 2.5,
                            borderRadius: 2,
                            border: "1px dashed",
                            borderColor: "primary.main",
                            backgroundColor: "#f5f9ff",
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{ mb: 2, color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}
                        >
                            New Subject
                        </Typography>
                        <Grid container spacing={2} alignItems="flex-end">
                            <Grid item xs={12} sm={5}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Subject Name"
                                    value={newSubject.name}
                                    onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SubjectIcon fontSize="small" sx={{ color: "gray" }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Max Score"
                                    type="number"
                                    value={newSubject.max_score}
                                    onChange={(e) => setNewSubject({ ...newSubject, max_score: e.target.value })}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <ScoreIcon fontSize="small" sx={{ color: "gray" }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    startIcon={<AddCircleOutlineIcon />}
                                    onClick={handleCreate}
                                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, height: 40 }}
                                >
                                    Create Subject
                                </Button>
                            </Grid>
                        </Grid>
                    </Card>
                </Collapse>
            </Box>

            {/* ── Subject Cards ── */}
            {filtered.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                    <SubjectIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography>No subjects found.</Typography>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {filtered.map((subj, i) => {
                        const realIndex = subjects.findIndex((s) => s.id === subj.id);
                        const isActive = subj.is_active === 1;
                        return (
                            <Grid item xs={12} md={6} key={subj.id}>
                                <Card
                                    elevation={0}
                                    sx={{
                                        p: 2.5,
                                        borderRadius: 2,
                                        border: "1px solid",
                                        borderColor: isActive ? "success.light" : "divider",
                                        transition: "box-shadow 0.2s",
                                        "&:hover": { boxShadow: 3 },
                                    }}
                                >
                                    {/* Card Header */}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                                        <Stack direction="row" alignItems="center" gap={1}>
                                            <CircleIcon
                                                sx={{ fontSize: 10, color: isActive ? "success.main" : "text.disabled" }}
                                            />
                                            <Typography variant="subtitle1" fontWeight={700}>
                                                {subj.name || "Unnamed Subject"}
                                            </Typography>
                                        </Stack>
                                        <Chip
                                            label={isActive ? "Active" : "Inactive"}
                                            size="small"
                                            color={isActive ? "success" : "default"}
                                            variant="outlined"
                                            sx={{ fontSize: 11, height: 22 }}
                                        />
                                    </Stack>

                                    <Divider sx={{ mb: 2 }} />

                                    {/* Fields */}
                                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                                        <Grid item xs={12} sm={7}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Subject Name"
                                                value={subj.name}
                                                onChange={(e) => handleChange(realIndex, "name", e.target.value)}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <SubjectIcon fontSize="small" sx={{ color: "gray" }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={5}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                type="number"
                                                label="Max Score"
                                                value={subj.max_score}
                                                onChange={(e) => handleChange(realIndex, "max_score", e.target.value)}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <ScoreIcon fontSize="small" sx={{ color: "gray" }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                            />
                                        </Grid>
                                    </Grid>

                                    {/* Footer */}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Tooltip title={isActive ? "Deactivate subject" : "Activate subject"}>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Switch
                                                    size="small"
                                                    checked={isActive}
                                                    color="success"
                                                    onChange={(e) =>
                                                        handleChange(realIndex, "is_active", e.target.checked ? 1 : 0)
                                                    }
                                                />
                                                <Typography variant="caption" color="text.secondary">
                                                    {isActive ? "Active" : "Inactive"}
                                                </Typography>
                                            </Stack>
                                        </Tooltip>

                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<SaveOutlinedIcon fontSize="small" />}
                                            onClick={() => handleUpdate(subj)}
                                            sx={{
                                                borderRadius: 2,
                                                textTransform: "none",
                                                fontWeight: 600,
                                                fontSize: 13,
                                                px: 2,
                                            }}
                                        >
                                            Save
                                        </Button>
                                    </Stack>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* ── Snackbar ── */}
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    severity={snack.severity}
                    variant="filled"
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    sx={{ borderRadius: 2 }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AdminSubjects;
