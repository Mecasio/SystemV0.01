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
    Tooltip,
    Chip,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SubjectIcon from "@mui/icons-material/Subject";
import CircleIcon from "@mui/icons-material/Circle";
import SchoolIcon from "@mui/icons-material/School";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import CampaignIcon from "@mui/icons-material/Campaign";
import KeyIcon from "@mui/icons-material/Key";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PeopleIcon from "@mui/icons-material/People";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";

const AdminSubjects = () => {
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
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (!settings) return;
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
        if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
        if (settings.stepper_color) setStepperColor(settings.stepper_color);
        if (settings.logo_url) setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings.short_term) setShortTerm(settings.short_term);
        if (settings.campus_address) setCampusAddress(settings.campus_address);
        if (settings?.branches) {
            try {
                const parsed = typeof settings.branches === "string" ? JSON.parse(settings.branches) : settings.branches;
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
    const [canCreate, setCanCreate] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);
    const [loading, setLoading] = useState(false);
    const pageId = 145;
    const [employeeID, setEmployeeID] = useState("");
    const auditConfig = {
        headers: {
            "x-audit-actor-id":
                employeeID ||
                localStorage.getItem("employee_id") ||
                localStorage.getItem("email") ||
                "unknown",
            "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
        },
    };

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
                setCanCreate(Number(response.data?.can_create) === 1);
                setCanEdit(Number(response.data?.can_edit) === 1);
                setCanDelete(Number(response.data?.can_delete) === 1);
            } else {
                setHasAccess(false);
                setCanCreate(false);
                setCanEdit(false);
                setCanDelete(false);
            }
        } catch (error) {
            console.error("Error checking access:", error);
            setHasAccess(false);
            setCanCreate(false);
            setCanEdit(false);
            setCanDelete(false);
            setLoading(false);
        }
    };

   const tabs = [
   
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
    const [activeStep, setActiveStep] = useState(4);

    const handleStepClick = (index, to) => {
        setActiveStep(index);
        navigate(to);
    };

    // ── Subjects State ──
    const [subjects, setSubjects] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

    // ── Modal State ──
    const [openDialog, setOpenDialog] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null); // null = Add, object = Edit
    const [modalName, setModalName] = useState("");
    const [modalMaxScore, setModalMaxScore] = useState("");
    const [modalIsActive, setModalIsActive] = useState(1);

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

    const openAddDialog = () => {
        if (!canCreate) {
            setSnack({ open: true, message: "You do not have permission to create subjects.", severity: "error" });
            return;
        }

        setEditingSubject(null);
        setModalName("");
        setModalMaxScore("");
        setModalIsActive(1);
        setOpenDialog(true);
    };

    const openEditDialog = (subject) => {
        if (!canEdit) {
            setSnack({ open: true, message: "You do not have permission to edit subjects.", severity: "error" });
            return;
        }

        setEditingSubject(subject);
        setModalName(subject.name);
        setModalMaxScore(subject.max_score);
        setModalIsActive(subject.is_active);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingSubject(null);
    };

    const handleSave = async () => {
        if (editingSubject && !canEdit) {
            setSnack({ open: true, message: "You do not have permission to edit subjects.", severity: "error" });
            return;
        }

        if (!editingSubject && !canCreate) {
            setSnack({ open: true, message: "You do not have permission to create subjects.", severity: "error" });
            return;
        }

        if (!modalName || !modalMaxScore) {
            setSnack({ open: true, message: "Please fill in all fields.", severity: "warning" });
            return;
        }

        if (editingSubject) {
            // UPDATE
            try {
                await axios.put(`${API_BASE_URL}/api/subjects/${editingSubject.id}`, {
                    ...editingSubject,
                    name: modalName,
                    max_score: modalMaxScore,
                    is_active: modalIsActive,
                }, auditConfig);
                setSnack({ open: true, message: "Subject updated successfully.", severity: "success" });
                handleCloseDialog();
                fetchSubjects();
            } catch {
                setSnack({ open: true, message: "Failed to update subject.", severity: "error" });
            }
        } else {
            // CREATE
            try {
                await axios.post(`${API_BASE_URL}/api/subjects`, {
                    name: modalName,
                    max_score: modalMaxScore,
                    is_active: modalIsActive,
                }, auditConfig);
                setSnack({ open: true, message: "Subject created successfully.", severity: "success" });
                handleCloseDialog();
                fetchSubjects();
            } catch {
                setSnack({ open: true, message: "Failed to create subject.", severity: "error" });
            }
        }
    };

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [subjectToDelete, setSubjectToDelete] = useState(null);

    // Quick toggle active without opening modal
    const handleDeleteSubject = async (subject) => {
        if (!canDelete) {
            setSnack({ open: true, message: "You do not have permission to delete subjects.", severity: "error" });
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/subjects/${subject.id}`, auditConfig);

            setSnack({
                open: true,
                message: "Subject set to inactive successfully.",
                severity: "success",
            });

            fetchSubjects();
        } catch (err) {
            setSnack({
                open: true,
                message: "Failed to delete subject.",
                severity: "error",
            });
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
                paddingRight: 1,
                backgroundColor: "transparent",
                mt: 1,
                padding: 2,
            }}
        >
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
            >
                <Typography variant="h4"
                    sx={{
                        fontWeight: 'bold',
                        color: titleColor,
                        fontSize: '36px',
                    }}
                >
                    SUBJECT MANAGEMENT
                </Typography>


                <TextField
                    size="small"
                    placeholder="Search subjects…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{ width: 320, backgroundColor: "#fff", borderRadius: 1, minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
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

            {/* ── Stats + Add Button Row ── */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>

                <Button
                    variant="contained"

                    onClick={openAddDialog}
                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                >
                    + Add New Subject
                </Button>
            </Stack>

            {/* ── Subject Cards ── */}
            {filtered.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                    <SubjectIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography>No subjects found.</Typography>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {filtered.map((subj) => {
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
                                            <CircleIcon sx={{ fontSize: 10, color: isActive ? "success.main" : "text.disabled" }} />
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

                                    {/* Info Display */}
                                    <Stack direction="row" gap={2} mb={2}>
                                        <Box sx={{ flex: 1, backgroundColor: "#f5f7ff", borderRadius: 2, p: 1.5 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                                                Subject Name
                                            </Typography>
                                            <Typography variant="body1" fontWeight={700} mt={0.5}>
                                                {subj.name}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ width: 110, backgroundColor: "#f5f7ff", borderRadius: 2, p: 1.5 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                                                Max Score
                                            </Typography>
                                            <Typography variant="body1" fontWeight={700} mt={0.5}>
                                                {subj.max_score}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    {/* Footer */}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Tooltip title={isActive ? "Deactivate subject" : "Activate subject"}>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Switch
                                                    size="small"
                                                    checked={isActive}
                                                    color="success"
                                                    onChange={() => handleToggleActive(subj)}
                                                />
                                                <Typography variant="caption" color="text.secondary">
                                                    {isActive ? "Active" : "Inactive"}
                                                </Typography>
                                            </Stack>
                                        </Tooltip>

                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                sx={{
                                                    backgroundColor: "green",
                                                    color: "white",
                                                    borderRadius: "5px",
                                                    padding: "8px 14px",
                                                    width: "100px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "5px",
                                                }}
                                                onClick={() => openEditDialog(subj)}
                                            >
                                                <EditIcon fontSize="small" /> Edit
                                            </Button>

                                            <Button
                                                variant="contained"
                                                size="small"
                                                sx={{
                                                    backgroundColor: "#9E0000",
                                                    color: "white",
                                                    borderRadius: "5px",
                                                    padding: "8px 14px",
                                                    width: "100px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "5px",
                                                }}
                                                onClick={() => {
                                                    setSubjectToDelete(subj);
                                                    setOpenDeleteDialog(true);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" /> Delete
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* ── Add / Edit Dialog ── */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: "bold", backgroundColor: settings?.header_color || "#1976d2", color: "white" }}>
                    {editingSubject ? "Edit Subject" : "Add New Subject"}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography fontWeight="bold" mb={1} mt={2}>
                        Subject Name
                    </Typography>
                    <TextField
                        label="Subject Name"
                        fullWidth
                        value={modalName}
                        onChange={(e) => setModalName(e.target.value)}

                        sx={{ mb: 2, mt: 1 }}
                    />

                    <Typography fontWeight="bold" mb={1} mt={1}>
                        Max Score
                    </Typography>
                    <TextField
                        label="Max Score"
                        fullWidth
                        type="number"
                        value={modalMaxScore}
                        onChange={(e) => setModalMaxScore(e.target.value)}

                        sx={{ mb: 2 }}
                    />

                    <Typography fontWeight="bold" mb={1} mt={1}>
                        Status
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1} mt={1}>
                        <Switch
                            checked={modalIsActive === 1}
                            color="success"
                            onChange={(e) => setModalIsActive(e.target.checked ? 1 : 0)}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {modalIsActive === 1 ? "Active" : "Inactive"}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleCloseDialog} color="error"
                        variant="outlined">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} startIcon={<SaveIcon />} variant="contained" >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Snackbar ── */}
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
                    {snack.message}
                </Alert>
            </Snackbar>

            <Dialog
                open={openDeleteDialog}
                onClose={() => {
                    setOpenDeleteDialog(false);
                    setSubjectToDelete(null);
                }}
            >
                <DialogTitle>Confirm Delete Subject</DialogTitle>

                <DialogContent>
                    <Typography>
                        Are you sure you want to delete the subject{" "}
                        <b>{subjectToDelete?.name}</b>?
                        <br />
                        This will set it to <b>Inactive</b> only (soft delete).
                    </Typography>
                </DialogContent>

                <DialogActions>
                    <Button
                        color="inherit"
                        variant="outlined"
                        onClick={() => {
                            setOpenDeleteDialog(false);
                            setSubjectToDelete(null);
                        }}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={async () => {
                            if (!subjectToDelete) return;

                            try {
                                await axios.delete(
                                    `${API_BASE_URL}/api/subjects/${subjectToDelete.id}`,
                                    auditConfig,
                                );

                                setSnack({
                                    open: true,
                                    message: "Subject set to inactive successfully ✅",
                                    severity: "success",
                                });

                                fetchSubjects();
                            } catch (err) {
                                setSnack({
                                    open: true,
                                    message: "Failed to delete subject ❌",
                                    severity: "error",
                                });
                            }

                            setOpenDeleteDialog(false);
                            setSubjectToDelete(null);
                        }}
                    >
                        Yes, Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminSubjects;
