import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
    Box,
    Button,
    TextField,
    InputLabel,
    Typography,
    Paper,
    Divider,
    Snackbar,
    Alert,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    MenuItem,
    Stack,
} from "@mui/material";
import API_BASE_URL from "../apiConfig";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import EaristLogo from "../assets/EaristLogo.png";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SchoolIcon from "@mui/icons-material/School";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import UpdateIcon from "@mui/icons-material/Update";

// ─── Static design tokens (mirrors Settings.jsx pattern) ──────────────────
const C = {
    cream: "#fafaf7",
    textMain: "#1a1a2e",
    textMuted: "#6b6b80",
    white: "#ffffff",
    greenDark: "#1a5c36",
    greenMid: "#2e7d52",
    redDark: "#8b1a1a",
    redMid: "#b52020",
};

// ─── SectionHeader — identical API to Settings.jsx ────────────────────────
function SectionHeader({ icon, title, subtitle, headerColor }) {
    return (
        <Box
            sx={{
                backgroundColor: headerColor,
                px: 3,
                py: 1.75,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
            }}
        >
            <Box sx={{ color: C.white, display: "flex", alignItems: "center", opacity: 0.9 }}>
                {icon}
            </Box>
            <Box>
                <Typography
                    sx={{
                        fontWeight: 700,
                        fontSize: "0.97rem",
                        color: C.white,
                        letterSpacing: "0.02em",
                        lineHeight: 1.2,
                    }}
                >
                    {title}
                </Typography>
                {subtitle && (
                    <Typography
                        sx={{
                            fontSize: "0.72rem",
                            color: "rgba(255,255,255,0.60)",
                            mt: 0.25,
                            letterSpacing: "0.03em",
                        }}
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

// ─── LabeledField — identical API to Settings.jsx ─────────────────────────
function LabeledField({ label, value, onChange, select, children, borderColor, width }) {
    return (
        <Stack spacing={0.75} sx={{ width: width || "100%" }}>
            <InputLabel
                sx={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: C.textMuted,
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </InputLabel>
            <TextField
                value={value}
                onChange={onChange}
                fullWidth
                size="small"
                select={select}
                sx={{
                    "& .MuiOutlinedInput-root": {
                        fontSize: "0.88rem",
                        borderRadius: 2,
                        backgroundColor: C.cream,
                        "& fieldset": { borderColor: borderColor },
                        "&:hover fieldset": { borderColor: borderColor, opacity: 0.7 },
                        "&.Mui-focused fieldset": { borderColor: borderColor, borderWidth: "2px" },
                    },
                }}
            >
                {children}
            </TextField>
        </Stack>
    );
}

// ─── SaveButton ───────────────────────────────────────────────────────────
function SaveButton({ isEdit, onClick, headerColor, borderColor, disabled = false }) {
    return (
        <Button
            variant="contained"
            startIcon={isEdit
                ? <UpdateIcon sx={{ fontSize: "16px" }} />
                : <AddCircleOutlineIcon sx={{ fontSize: "16px" }} />
            }
            onClick={onClick}
            disabled={disabled}
            sx={{
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                py: 1,
                px: 2.5,
                borderRadius: 2,
                backgroundColor: headerColor,
                color: C.white,
                border: `1px solid ${borderColor}`,
                boxShadow: "none",
                whiteSpace: "nowrap",
                alignSelf: "flex-end",
                opacity: disabled ? 0.5 : 1,
                "&:hover": {
                    backgroundColor: headerColor,
                    opacity: 0.88,
                    boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
                },
                transition: "all 0.2s ease",
            }}
        >
            {isEdit ? "Update" : "Add Entry"}
        </Button>
    );
}

// ─── ActionButton ─────────────────────────────────────────────────────────
function ActionButton({ label, icon, onClick, color = "green", disabled = false }) {
    const isGreen = color === "green";
    return (
        <Button
            variant="contained"
            size="small"
            startIcon={icon}
            onClick={onClick}
            disabled={disabled}
            sx={{
                fontWeight: 700,
                fontSize: "0.75rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: C.white,
                borderRadius: 1.5,
                px: 2,
                py: 0.75,
                minWidth: 88,
                opacity: disabled ? 0.5 : 1,
                background: isGreen
                    ? `linear-gradient(135deg, ${C.greenDark}, ${C.greenMid})`
                    : `linear-gradient(135deg, ${C.redDark}, ${C.redMid})`,
                boxShadow: "none",
                "&:hover": {
                    background: isGreen
                        ? `linear-gradient(135deg, #154d2e, #236041)`
                        : `linear-gradient(135deg, #6e1414, #9e2020)`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.20)",
                },
                transition: "all 0.2s ease",
            }}
        >
            {label}
        </Button>
    );
}

// ─── PillBadge ────────────────────────────────────────────────────────────
function PillBadge({ label, bg, color }) {
    return (
        <Box
            sx={{
                display: "inline-block",
                px: 1.4,
                py: 0.25,
                borderRadius: "20px",
                background: bg,
                fontSize: "0.72rem",
                fontWeight: 700,
                color: color,
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </Box>
    );
}

// ─── ThCell ───────────────────────────────────────────────────────────────
function ThCell({ children, headerColor, borderColor }) {
    return (
        <TableCell
            sx={{
                color: C.white,
                backgroundColor: headerColor,
                textAlign: "center",
                py: 1.2,
                px: 2,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                border: `1px solid rgba(255,255,255,0.15)`,
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </TableCell>
    );
}

// ─── TdCell ───────────────────────────────────────────────────────────────
function TdCell({ children, borderColor, sx }) {
    return (
        <TableCell
            sx={{
                textAlign: "center",
                border: `1px solid ${borderColor}`,
                py: 1.1,
                px: 2,
                fontSize: "0.83rem",
                color: C.textMain,
                ...sx,
            }}
        >
            {children}
        </TableCell>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────
const GradeConversionAdmin = () => {
    const settings = useContext(SettingsContext);

    // ── Settings state ──
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

    const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
    const handleCloseSnack = (_, reason) => {
        if (reason !== "clickaway") setSnack((p) => ({ ...p, open: false }));
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
        if (settings?.branches) {
            try {
                const parsed = typeof settings.branches === "string"
                    ? JSON.parse(settings.branches)
                    : settings.branches;
                setBranches(parsed);
            } catch (err) {
                console.error("Failed to parse branches:", err);
                setBranches([]);
            }
        }
    }, [settings]);

    // ── Resolved dynamic colors (same pattern as Settings.jsx) ──
    const resolvedHeader = settings?.header_color || mainButtonColor || "#1976d2";
    const resolvedBorder = borderColor || "#000000";

    // ── Auth / access ──
    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [hasAccess, setHasAccess] = useState(null);
    const [canCreate, setCanCreate] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);
    const [loading, setLoading] = useState(false);
    const pageId = 144;
    const [employeeID, setEmployeeID] = useState("");
    const permissionHeaders = {
        headers: {
            "x-employee-id": employeeID,
            "x-page-id": pageId,
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
            const response = await axios.get(
                `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`
            );
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

    // ── Grade Conversion state ──
    const [rows, setRows] = useState([]);
    const [form, setForm] = useState({
        id: null,
        min_score: "",
        max_score: "",
        equivalent_grade: "",
        descriptive_rating: "",
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/admin/grade-conversion`);
            setRows(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasAccess) fetchData();
    }, [hasAccess]);

    const handleSave = async () => {
        if (form.id && !canEdit) {
            setSnack({ open: true, message: "You do not have permission to edit this item", severity: "error" });
            return;
        }

        if (!form.id && !canCreate) {
            setSnack({ open: true, message: "You do not have permission to create items on this page", severity: "error" });
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/admin/grade-conversion`, form, permissionHeaders);
            setForm({ id: null, min_score: "", max_score: "", equivalent_grade: "", descriptive_rating: "" });
            fetchData();
            setSnack({ open: true, message: "Grade entry saved successfully!", severity: "success" });
        } catch (err) {
            console.error(err);
            setSnack({ open: true, message: "Save failed. Please try again.", severity: "error" });
        }
    };

    const handleEdit = (row) => {
        if (!canEdit) {
            setSnack({ open: true, message: "You do not have permission to edit this item", severity: "error" });
            return;
        }
        setForm(row);
    };

    const handleDelete = async (id) => {
        if (!canDelete) {
            setSnack({ open: true, message: "You do not have permission to delete this item", severity: "error" });
            return;
        }
        await axios.delete(`${API_BASE_URL}/admin/grade-conversion/${id}`, permissionHeaders);
        fetchData();
        setSnack({ open: true, message: "Entry deleted.", severity: "info" });
    };

    // ── Honors state ──
    const [honors, setHonors] = useState([]);
    const [honorForm, setHonorForm] = useState({
        id: null,
        title: "",
        min_grade: "",
        max_allowed_grade: "",
        type: 0, // default = semester
    });

    const fetchHonors = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/honors-rules`);
            setHonors(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (hasAccess) {
            fetchData();
            fetchHonors();
        }
    }, [hasAccess]);

    const handleSaveHonor = async () => {
        if (honorForm.id && !canEdit) {
            setSnack({ open: true, message: "You do not have permission to edit this item", severity: "error" });
            return;
        }

        if (!honorForm.id && !canCreate) {
            setSnack({ open: true, message: "You do not have permission to create items on this page", severity: "error" });
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/admin/honors-rules`, honorForm, permissionHeaders);
            setHonorForm({ id: null, title: "", min_grade: "", max_allowed_grade: "", type: "semester" });
            fetchHonors();
            setSnack({ open: true, message: "Honors rule saved!", severity: "success" });
        } catch (err) {
            setSnack({ open: true, message: "Save failed. Please try again.", severity: "error" });
        }
    };

    const handleDeleteHonor = async (id) => {
        if (!canDelete) {
            setSnack({ open: true, message: "You do not have permission to delete this item", severity: "error" });
            return;
        }
        await axios.delete(`${API_BASE_URL}/admin/honors-rules/${id}`, permissionHeaders);
        fetchHonors();
        setSnack({ open: true, message: "Honors rule deleted.", severity: "info" });
    };

    // ── Guard renders ──
    if (loading || hasAccess === null)
        return <LoadingOverlay open={loading} message="Loading..." />;
    if (!hasAccess) return <Unauthorized />;

    const showCreateActions = canCreate;
    const showActionColumn = canEdit || canDelete;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Box
            sx={{
                height: "calc(100vh - 150px)",
                overflowY: "auto",
                backgroundColor: "transparent",
                mt: 1,
                padding: 2,
                paddingRight: 1,
                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-track": { background: "transparent" },
                "&::-webkit-scrollbar-thumb": {
                    background: "rgba(0,0,0,0.18)",
                    borderRadius: "8px",
                },
            }}
        >
            {/* ── Page Title (mirrors Settings.jsx) ── */}
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
                    sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
                >
                    GRADE MANAGEMENT / ACADEMIC'S AWARD
                </Typography>
            </Box>
            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />
            <br />

            {/* ══════════════════════════════════════════════
                CARD 1 — GRADE CONVERSION
            ══════════════════════════════════════════════ */}
            <Paper
                elevation={1}
                sx={{
                    border: `1px solid ${resolvedBorder}`,
                    borderRadius: 3,
                    overflow: "hidden",
                    mb: 3,
                }}
            >
                <SectionHeader
                    icon={<SchoolIcon fontSize="small" />}
                    title="Grade Conversion Table"
                    subtitle="Map raw scores to equivalent grades and descriptive ratings"
                    headerColor={resolvedHeader}
                />

                {/* Form */}
                <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
                    <Typography
                        sx={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: C.textMuted,
                            mb: 1.5,
                        }}
                    >
                        {form.id ? "Edit Entry" : "New Entry"}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-end">
                        <LabeledField
                            label="Min Score"
                            value={form.min_score}
                            onChange={(e) => setForm({ ...form, min_score: e.target.value })}
                            borderColor={resolvedBorder}
                            width={110}
                        />
                        <LabeledField
                            label="Max Score"
                            value={form.max_score}
                            onChange={(e) => setForm({ ...form, max_score: e.target.value })}
                            borderColor={resolvedBorder}
                            width={110}
                        />
                        <LabeledField
                            label="Equivalent Grade"
                            value={form.equivalent_grade}
                            onChange={(e) => setForm({ ...form, equivalent_grade: e.target.value })}
                            borderColor={resolvedBorder}
                            width={150}
                        />
                        <LabeledField
                            label="Descriptive Rating"
                            value={form.descriptive_rating}
                            onChange={(e) => setForm({ ...form, descriptive_rating: e.target.value })}
                            borderColor={resolvedBorder}
                            width={170}
                        />
                        {showCreateActions || (form.id && canEdit) ? (
                            <SaveButton
                                isEdit={!!form.id}
                                onClick={handleSave}
                                headerColor={resolvedHeader}
                                borderColor={resolvedBorder}
                                disabled={form.id ? !canEdit : !canCreate}
                            />
                        ) : null}
                    </Stack>
                </Box>

                <Divider sx={{ borderColor: resolvedBorder }} />

                {/* Table */}
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {["Min Score", "Max Score", "Equivalent Grade", "Descriptive Rating", ...(showActionColumn ? ["Actions"] : [])].map((h) => (
                                    <ThCell key={h} headerColor={resolvedHeader} borderColor={resolvedBorder}>
                                        {h}
                                    </ThCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        sx={{
                                            textAlign: "center",
                                            py: 4,
                                            color: "rgba(107,107,128,0.5)",
                                            fontSize: "0.82rem",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        No grade conversion entries yet. Use the form above to add one.
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((row, idx) => (
                                <TableRow
                                    key={row.id}
                                    sx={{
                                        background: idx % 2 === 0 ? C.white : C.cream,
                                        "&:hover": { background: "rgba(0,0,0,0.03)" },
                                        transition: "background 0.12s",
                                    }}
                                >
                                    <TdCell borderColor={resolvedBorder}>{row.min_score}</TdCell>
                                    <TdCell borderColor={resolvedBorder}>{row.max_score}</TdCell>
                                    <TdCell borderColor={resolvedBorder}>
                                        <Box sx={{ fontWeight: 700, color: resolvedHeader }}>
                                            {row.equivalent_grade}
                                        </Box>
                                    </TdCell>
                                    <TdCell borderColor={resolvedBorder}>
                                        <PillBadge
                                            label={row.descriptive_rating}
                                            bg={`${resolvedHeader}18`}
                                            color={resolvedHeader}
                                        />
                                    </TdCell>
                                    {showActionColumn && (
                                        <TdCell borderColor={resolvedBorder}>
                                            <Stack direction="row" spacing={1} justifyContent="center">
                                                {canEdit && (
                                                    <ActionButton
                                                        label="Edit"
                                                        icon={<EditIcon sx={{ fontSize: "14px" }} />}
                                                        onClick={() => handleEdit(row)}
                                                        color="green"
                                                    />
                                                )}
                                                {canDelete && (
                                                    <ActionButton
                                                        label="Delete"
                                                        icon={<DeleteIcon sx={{ fontSize: "14px" }} />}
                                                        onClick={() => handleDelete(row.id)}
                                                        color="red"
                                                    />
                                                )}
                                            </Stack>
                                        </TdCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* ══════════════════════════════════════════════
                CARD 2 — HONORS RULES
            ══════════════════════════════════════════════ */}
            <Paper
                elevation={1}
                sx={{
                    border: `1px solid ${resolvedBorder}`,
                    borderRadius: 3,
                    overflow: "hidden",
                    mb: 3,
                }}
            >
                <SectionHeader
                    icon={<EmojiEventsIcon fontSize="small" />}
                    title="Honors & Academic Awards Rules"
                    subtitle="Define criteria for semester honors and graduation latin awards"
                    headerColor={resolvedHeader}
                />

                {/* Form */}
                <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
                    <Typography
                        sx={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: C.textMuted,
                            mb: 1.5,
                        }}
                    >
                        {honorForm.id ? "Edit Honor Rule" : "New Honor Rule"}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-end">
                        <LabeledField
                            label="Title (e.g. Dean's Lister)"
                            value={honorForm.title}
                            onChange={(e) => setHonorForm({ ...honorForm, title: e.target.value })}
                            borderColor={resolvedBorder}
                            width={200}
                        />
                        <LabeledField
                            label="Max Allowed Grade"
                            value={honorForm.max_allowed_grade}
                            onChange={(e) => setHonorForm({ ...honorForm, max_allowed_grade: e.target.value })}
                            borderColor={resolvedBorder}
                            width={155}
                        />
                        <LabeledField
                            label="Min Grade (Latin Honors)"
                            value={honorForm.min_grade}
                            onChange={(e) => setHonorForm({ ...honorForm, min_grade: e.target.value })}
                            borderColor={resolvedBorder}
                            width={170}
                        />
                        <LabeledField
                            label="Max Grade"
                            value={honorForm.max_allowed_grade}
                            onChange={(e) => setHonorForm({ ...honorForm, max_allowed_grade: e.target.value })}
                            borderColor={resolvedBorder}
                            width={120}
                        />
                        <LabeledField
                            label="Type"
                            value={honorForm.type}
                            onChange={(e) => setHonorForm({ ...honorForm, type: e.target.value })}
                            borderColor={resolvedBorder}
                            width={130}
                            select
                        >
                            <MenuItem value={1}>Semester</MenuItem>
                            <MenuItem value={2}>Graduation</MenuItem>
                        </LabeledField>
                        {showCreateActions || (honorForm.id && canEdit) ? (
                            <SaveButton
                                isEdit={!!honorForm.id}
                                onClick={handleSaveHonor}
                                headerColor={resolvedHeader}
                                borderColor={resolvedBorder}
                                disabled={honorForm.id ? !canEdit : !canCreate}
                            />
                        ) : null}
                    </Stack>
                </Box>

                <Divider sx={{ borderColor: resolvedBorder }} />

                {/* Table */}
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {["Title", "Max Grade", "Min Grade", "Type", ...(showActionColumn ? ["Actions"] : [])].map((h) => (
                                    <ThCell key={h} headerColor={resolvedHeader} borderColor={resolvedBorder}>
                                        {h}
                                    </ThCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {honors.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        sx={{
                                            textAlign: "center",
                                            py: 4,
                                            color: "rgba(107,107,128,0.5)",
                                            fontSize: "0.82rem",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        No honors rules configured yet. Use the form above to add one.
                                    </TableCell>
                                </TableRow>
                            ) : honors.map((row, idx) => (
                                <TableRow
                                    key={row.id}
                                    sx={{
                                        background: idx % 2 === 0 ? C.white : C.cream,
                                        "&:hover": { background: "rgba(0,0,0,0.03)" },
                                        transition: "background 0.12s",
                                    }}
                                >
                                    <TdCell borderColor={resolvedBorder}>
                                        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
                                            <EmojiEventsIcon sx={{ fontSize: "14px", color: resolvedHeader, opacity: 0.75 }} />
                                            <Box sx={{ fontWeight: 700, color: C.textMain }}>{row.title}</Box>
                                        </Stack>
                                    </TdCell>
                                    <TdCell borderColor={resolvedBorder}>
                                        <PillBadge
                                            label={row.max_allowed_grade}
                                            bg="rgba(139,26,26,0.09)"
                                            color={C.redDark}
                                        />
                                    </TdCell>
                                    <TdCell borderColor={resolvedBorder}>
                                        <PillBadge
                                            label={row.min_grade}
                                            bg="rgba(26,92,54,0.09)"
                                            color={C.greenDark}
                                        />
                                    </TdCell>
                                    <TdCell borderColor={resolvedBorder}>
                                        <PillBadge
                                            label={row.type === 2 ? "Graduation" : "Semester"}
                                            bg={
                                                row.type === 2
                                                    ? `${resolvedHeader}20`
                                                    : "rgba(26,26,46,0.07)"
                                            }
                                            color={
                                                row.type === 2 ? resolvedHeader : C.textMain
                                            }
                                        />
                                    </TdCell>
                                    {showActionColumn && (
                                        <TdCell borderColor={resolvedBorder}>
                                            <Stack direction="row" spacing={1} justifyContent="center">
                                                {canEdit && (
                                                    <ActionButton
                                                        label="Edit"
                                                        icon={<EditIcon sx={{ fontSize: "14px" }} />}
                                                        onClick={() => {
                                                            setHonorForm(row);
                                                        }}
                                                        color="green"
                                                    />
                                                )}
                                                {canDelete && (
                                                    <ActionButton
                                                        label="Delete"
                                                        icon={<DeleteIcon sx={{ fontSize: "14px" }} />}
                                                        onClick={() => handleDeleteHonor(row.id)}
                                                        color="red"
                                                    />
                                                )}
                                            </Stack>
                                        </TdCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* ── Snackbar (mirrors Settings.jsx) ── */}
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={handleCloseSnack}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={handleCloseSnack}
                    sx={{ width: "100%", fontWeight: 500, borderRadius: 2.5 }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default GradeConversionAdmin;
