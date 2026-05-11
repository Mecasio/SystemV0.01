import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import {
    Box,
    Typography,
    Button,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Grid,
    Snackbar,
    Alert,
    TableContainer,
    FormControl,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";

import { SettingsContext } from "../App";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import Autocomplete from "@mui/material/Autocomplete";

const SuperAdminProfessorEducation = () => {
    const settings = useContext(SettingsContext);
    const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
    const [borderColor, setBorderColor] = useState("#000000");
    const [titleColor, setTitleColor] = useState("#000000");
    const headerColor = settings?.header_color || "#1976d2";

    const [profList, setProfList] = useState([]);
    const [list, setList] = useState([]);

    /* form state */
    const [personId, setPersonId] = useState("");
    const [bachelor, setBachelor] = useState("");
    const [master, setMaster] = useState("");
    const [doctor, setDoctor] = useState("");
    const [editing, setEditing] = useState(null);

    /* dialog state */
    const [openFormDialog, setOpenFormDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    /* pagination */
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 5;
    const totalPages = Math.max(1, Math.ceil(list.length / rowsPerPage));
    const paginatedRows = list.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    /* auth / access */
    const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [hasAccess, setHasAccess] = useState(null);
    const [canCreate, setCanCreate] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);
    const [loading, setLoading] = useState(false);
    const [employeeID, setEmployeeID] = useState("");

    const pageId = 109;

    const auditConfig = {
        headers: {
            "x-audit-actor-id": employeeID || localStorage.getItem("employee_id") || localStorage.getItem("email") || "unknown",
            "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
        },
    };

    useEffect(() => {
        if (!settings) return;
        if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.title_color) setTitleColor(settings.title_color);
    }, [settings]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/prof_dropdown`)
            .then(res => setProfList(res.data))
            .catch(() => showSnack("Failed to load professors", "error"));
    }, []);

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
            if (storedRole === "registrar") checkAccess(storedEmployeeID);
            else window.location.href = "/login";
        } else {
            window.location.href = "/login";
        }
    }, []);

    const checkAccess = async (empID) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/page_access/${empID}/${pageId}`);
            const allowed = response.data?.page_privilege === 1;
            setHasAccess(allowed);
            setCanCreate(allowed && Number(response.data?.can_create) === 1);
            setCanEdit(allowed && Number(response.data?.can_edit) === 1);
            setCanDelete(allowed && Number(response.data?.can_delete) === 1);
        } catch {
            setHasAccess(false);
        }
    };

    const fetchList = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/person_prof_list`);
            setList(res.data);
        } catch {
            showSnack("Failed to fetch records", "error");
        }
    };

    useEffect(() => { fetchList(); }, []);

    /* ── CRUD ── */
    const handleAdd = async () => {
        if (!canCreate) { showSnack("You do not have permission to create education records", "error"); return; }
        if (!personId) { showSnack("Please select a professor", "warning"); return; }
        try {
            await axios.post(`${API_BASE_URL}/person_prof`, { person_id: personId, bachelor, master, doctor }, auditConfig);
            showSnack("Education record added", "success");
            resetForm();
            fetchList();
            setOpenFormDialog(false);
        } catch { showSnack("Failed to add record", "error"); }
    };

    const handleEdit = (row) => {
        if (!canEdit) { showSnack("You do not have permission to edit education records", "error"); return; }
        setEditing(row.person_id);
        setPersonId(row.person_id);
        setBachelor(row.bachelor || "");
        setMaster(row.master || "");
        setDoctor(row.doctor || "");
        setOpenFormDialog(true);
    };

    const handleUpdate = async () => {
        if (!canEdit) { showSnack("You do not have permission to edit education records", "error"); return; }
        try {
            await axios.put(`${API_BASE_URL}/person_prof/${editing}`, { bachelor, master, doctor }, auditConfig);
            showSnack("Record updated", "success");
            resetForm();
            fetchList();
            setOpenFormDialog(false);
        } catch { showSnack("Failed to update record", "error"); }
    };

    const handleDelete = async (id) => {
        if (!canDelete) { showSnack("You do not have permission to delete education records", "error"); return; }
        try {
            await axios.delete(`${API_BASE_URL}/person_prof/${id}`, auditConfig);
            showSnack("Record deleted", "success");
            fetchList();
        } catch { showSnack("Failed to delete record", "error"); }
    };

    const resetForm = () => {
        setEditing(null);
        setPersonId("");
        setBachelor("");
        setMaster("");
        setDoctor("");
    };

    const showSnack = (message, severity) => setSnack({ open: true, message, severity });

    /* shared pagination toolbar */
    const PaginationToolbar = ({ showAddButton = false }) => (
        <TableContainer component={Paper} sx={{ width: "100%" }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell
                            colSpan={10}
                            sx={{
                                border: `1px solid ${borderColor}`,
                                py: 0.8,
                                backgroundColor: headerColor,
                                color: "white",
                            }}
                        >
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography fontSize="14px" fontWeight="bold" color="white">
                                    Total Education Records: {list.length}
                                </Typography>

                                <Box display="flex" alignItems="center" gap={1}>
                                    {/* First */}
                                    <Button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        variant="outlined"
                                        size="small"
                                        sx={paginationBtnSx}
                                    >
                                        First
                                    </Button>

                                    {/* Prev */}
                                    <Button
                                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                        disabled={currentPage === 1}
                                        variant="outlined"
                                        size="small"
                                        sx={paginationBtnSx}
                                    >
                                        Prev
                                    </Button>

                                    {/* Page dropdown */}
                                    <FormControl size="small" sx={{ minWidth: 80 }}>
                                        <Select
                                            value={currentPage}
                                            onChange={e => setCurrentPage(Number(e.target.value))}
                                            sx={pageSelectSx}
                                            MenuProps={{ PaperProps: { sx: { maxHeight: 200, backgroundColor: "#fff" } } }}
                                        >
                                            {Array.from({ length: totalPages }, (_, i) => (
                                                <MenuItem key={i + 1} value={i + 1}>Page {i + 1}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    <Typography fontSize="11px" color="white">
                                        of {totalPages} page{totalPages > 1 ? "s" : ""}
                                    </Typography>

                                    {/* Next */}
                                    <Button
                                        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        variant="outlined"
                                        size="small"
                                        sx={paginationBtnSx}
                                    >
                                        Next
                                    </Button>

                                    {/* Last */}
                                    <Button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        variant="outlined"
                                        size="small"
                                        sx={paginationBtnSx}
                                    >
                                        Last
                                    </Button>

                                    {showAddButton && (
                                        <Button
                                            variant="contained"
                                            sx={{
                                                backgroundColor: "#1976d2",
                                                color: "#fff",
                                                fontWeight: "bold",
                                                borderRadius: "8px",
                                                width: "250px",
                                                textTransform: "none",
                                                px: 2,
                                            }}
                                            onClick={() => {
                                                resetForm();
                                                setOpenFormDialog(true);
                                            }}
                                        >
                                            + Add Education Record
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        </TableCell>
                    </TableRow>
                </TableHead>
            </Table>
        </TableContainer>
    );

    if (loading || hasAccess === null) return <LoadingOverlay open={loading} message="Loading..." />;
    if (!hasAccess) return <Unauthorized />;

    return (
        <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>

            {/* ── Page Header ── */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", mb: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}>
                    PROFESSOR EDUCATION
                </Typography>
            </Box>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />
            <br />

            {/* ── Top Toolbar ── */}
            <PaginationToolbar showAddButton />

            {/* ── Table ── */}
            <Grid item xs={12}>
                <Box
                    sx={{
                        maxHeight: 420,
                        overflowY: "auto",
                        backgroundColor: "#f5f5f5",
                        color: "black",
                        border: `1px solid ${borderColor}`,
                        borderRadius: 1,
                    }}
                >
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {["#", "Professor", "Bachelor's Degree", "Master's Degree", "Doctorate", "Actions"].map(col => (
                                    <TableCell
                                        key={col}
                                        sx={{ border: `1px solid ${borderColor}`, backgroundColor: "#F5F5F5", color: "#000", fontWeight: 600 }}
                                    >
                                        {col}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {list.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ border: `1px solid ${borderColor}` }}>
                                        No education records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedRows.map((row, index) => (
                                    <TableRow key={row.person_id}>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {(currentPage - 1) * rowsPerPage + index + 1}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.lname}, {row.fname} {row.mname || ""}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.bachelor || "N/A"}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.master || "N/A"}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            {row.doctor || "N/A"}
                                        </TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}` }}>
                                            <Box sx={{ display: "flex", gap: 1 }}>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: "green",
                                                        color: "white",
                                                        borderRadius: "5px",
                                                        padding: "8px 14px",
                                                        width: "100px",
                                                        height: "40px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: "5px",
                                                        textTransform: "none",
                                                    }}
                                                    onClick={() => handleEdit(row)}
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
                                                        height: "40px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: "5px",
                                                        textTransform: "none",
                                                    }}
                                                    onClick={() => {
                                                        setRecordToDelete(row);
                                                        setOpenDeleteDialog(true);
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" /> Delete
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Box>
            </Grid>

            {/* ── Bottom Toolbar ── */}
            <PaginationToolbar />

            {/* ── Add / Edit Dialog ── */}
            <Dialog
                open={openFormDialog}
                onClose={() => { setOpenFormDialog(false); resetForm(); }}
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", boxShadow: 6 } }}
            >
                <DialogTitle
                    sx={{
                        background: headerColor,
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "1.2rem",
                        py: 2,
                    }}
                >
                    {editing ? "Edit Education Record" : "New Education Record"}
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, mt: 2 }}>
                        Professor's Name:
                    </Typography>

                    <Grid container spacing={2}>
                        {/* Professor selector — only when adding */}
                        {!editing && (
                            <Grid item xs={12}>
                                <Autocomplete
                                    fullWidth
                                    options={profList}
                                    value={
                                        profList.find(p => String(p.person_id) === String(personId)) || null
                                    }
                                    onChange={(event, newValue) => {
                                        setPersonId(newValue ? newValue.person_id : "");
                                    }}
                                    getOptionLabel={(option) =>
                                        `${option.lname}, ${option.fname} ${option.mname || ""}`
                                    }
                                    isOptionEqualToValue={(option, value) =>
                                        option.person_id === value.person_id
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Professor"
                                            placeholder="Search professor..."
                                            fullWidth
                                        />
                                    )}
                                    renderOption={(props, option) => (
                                        <li {...props} key={option.person_id}>
                                            {option.lname}, {option.fname} {option.mname || ""}
                                        </li>
                                    )}
                                />
                            </Grid>
                        )}

                        {editing && (
                            <Grid item xs={12}>
                                <Box
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        background: "#fff8e1",
                                        border: "1px solid #ffe082",
                                        fontSize: 13,
                                        color: "#6d4c00",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <EditIcon sx={{ fontSize: 16 }} />
                                    Editing:{" "}
                                    <strong>
                                        {list.find(r => r.person_id === editing)?.lname},{" "}
                                        {list.find(r => r.person_id === editing)?.fname}
                                    </strong>
                                </Box>
                            </Grid>
                        )}


                        <Grid item xs={12}>

                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, mt: 1 }}>
                                Education Details:
                            </Typography>
                            <TextField
                                fullWidth
                                label="Bachelor's Degree"
                                placeholder="e.g. BS Computer Science"
                                value={bachelor}
                                onChange={e => setBachelor(e.target.value)}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Master's Degree"
                                placeholder="e.g. MS Information Technology"
                                value={master}
                                onChange={e => setMaster(e.target.value)}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Doctorate"
                                placeholder="e.g. PhD Computer Engineering"
                                value={doctor}
                                onChange={e => setDoctor(e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #e0e0e0" }}>
                    <Button
                        color="error"
                        variant="outlined"
                        onClick={() => { setOpenFormDialog(false); resetForm(); }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ px: 4, fontWeight: 600, textTransform: "none" }}
                        onClick={async () => {
                            if (editing) await handleUpdate();
                            else await handleAdd();
                        }}
                    >
                        <SaveIcon fontSize="small" sx={{ mr: 0.5 }} /> Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Confirm Delete Dialog ── */}
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                <DialogTitle>Confirm Delete Record</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete the education record for{" "}
                        <strong>
                            {recordToDelete?.lname}, {recordToDelete?.fname}
                        </strong>
                        ?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button color="error" variant="outlined" onClick={() => setOpenDeleteDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => {
                            handleDelete(recordToDelete.person_id);
                            setOpenDeleteDialog(false);
                            setRecordToDelete(null);
                        }}
                    >
                        Yes, Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Snackbar ── */}
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ width: "100%" }}>
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

/* ── shared MUI sx helpers ── */
const paginationBtnSx = {
    minWidth: 80,
    color: "white",
    borderColor: "white",
    backgroundColor: "transparent",
    "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
    "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
};

const pageSelectSx = {
    fontSize: "12px",
    height: 36,
    color: "white",
    border: "1px solid white",
    backgroundColor: "transparent",
    ".MuiOutlinedInput-notchedOutline": { borderColor: "white" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
    "& svg": { color: "white" },
};

export default SuperAdminProfessorEducation;
