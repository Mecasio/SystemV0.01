import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import {
    Box,
    Typography,
    TextField,
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
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from "@mui/material";

import { SettingsContext } from "../App";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";

const SuperAdminProfessorEducation = () => {
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

    }, [settings]);

    const [profList, setProfList] = useState([]);

    // 🎓 FORM STATES
    const [personId, setPersonId] = useState("");
    const [bachelor, setBachelor] = useState("");
    const [master, setMaster] = useState("");
    const [doctor, setDoctor] = useState("");
    const [editing, setEditing] = useState(null);


    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/prof_dropdown`)
            .then(res => setProfList(res.data))
            .catch(() => showSnack("Failed to load professors", "error"));
    }, []);

    // 📋 LIST
    const [list, setList] = useState([]);

    // 🔔 SNACKBAR
    const [snack, setSnack] = useState({
        open: false,
        message: "",
        severity: "info",
    });
    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const pageId = 109;

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


    // 📥 FETCH DATA
    const fetchList = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/person_prof_list`);
            setList(res.data);
        } catch {
            showSnack("Failed to fetch records", "error");
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    // ➕ ADD
    const handleAdd = async () => {
        if (!personId) {
            showSnack("Person ID is required", "warning");
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/person_prof`, {
                person_id: personId,
                bachelor,
                master,
                doctor,
            });

            showSnack("Education added successfully", "success");
            resetForm();
            fetchList();
        } catch {
            showSnack("Failed to add record", "error");
        }
    };

    // ✏️ EDIT
    const handleEdit = (row) => {
        setEditing(row.person_id);
        setPersonId(row.person_id);
        setBachelor(row.bachelor || "");
        setMaster(row.master || "");
        setDoctor(row.doctor || "");
    };

    // 🔄 UPDATE
    const handleUpdate = async () => {
        try {
            await axios.put(`${API_BASE_URL}/person_prof/${editing}`, {
                bachelor,
                master,
                doctor,
            });

            showSnack("Education updated successfully", "success");
            resetForm();
            fetchList();
        } catch {
            showSnack("Failed to update record", "error");
        }
    };

    // ❌ DELETE
    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API_BASE_URL}/person_prof/${id}`);
            showSnack("Record deleted", "success");
            fetchList();
        } catch {
            showSnack("Failed to delete record", "error");
        }
    };

    const resetForm = () => {
        setEditing(null);
        setPersonId("");
        setBachelor("");
        setMaster("");
        setDoctor("");
    };

    const showSnack = (message, severity) => {
        setSnack({ open: true, message, severity });
    };

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
                PROFESSOR EDUCATION LEVEL
            </Typography>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />


            <Grid container spacing={4} mt={1}>
                {/* FORM */}
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 3, border: `1px solid ${borderColor}`, }}>
                        <Typography variant="h6">
                            {editing ? "Edit Education" : "Add Education"}
                        </Typography>

                        {!editing && (
                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Professor</InputLabel>
                                <Select
                                    value={personId}
                                    label="Professor"
                                    onChange={(e) => setPersonId(e.target.value)}
                                >
                                    {profList.map((p) => (
                                        <MenuItem key={p.person_id} value={p.person_id}>
                                            {p.lname}, {p.fname} {p.mname || ""}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                        )}

                        <TextField
                            fullWidth
                            label="Bachelor"
                            value={bachelor}
                            onChange={(e) => setBachelor(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Master"
                            value={master}
                            onChange={(e) => setMaster(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Doctor"
                            value={doctor}
                            onChange={(e) => setDoctor(e.target.value)}
                            sx={{ mb: 2 }}
                        />

                        <Button
                            fullWidth
                            variant="contained"
                            onClick={editing ? handleUpdate : handleAdd}
                        >
                            {editing ? "Update" : "Save"}
                        </Button>
                    </Paper>
                </Grid>

                {/* TABLE */}
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 3, border: `1px solid ${borderColor}`, }}>
                        <Typography variant="h6">Records</Typography>

                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>
                                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>Professor</TableCell>
                                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>Bachelor</TableCell>
                                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>Master</TableCell>
                                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>Doctor</TableCell>
                                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody sx={{ border: `1px solid ${borderColor}`, }}>
                                {list.map((row) => (
                                    <TableRow key={row.person_id}>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>{row.lname}, {row.fname} {row.mname || ""}</TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>{row.bachelor}</TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>{row.master}</TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>{row.doctor}</TableCell>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center" }}>
                                            <Box sx={{ display: "flex", gap: 1 }}>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: "green",
                                                        color: "white",
                                                    }}
                                                    onClick={() => handleEdit(row)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: "#B22222",
                                                        color: "white",
                                                    }}
                                                    onClick={() => handleDelete(row.person_id)}
                                                >
                                                    Delete
                                                </Button>
                                            </Box>

                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
            </Grid>

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack({ ...snack, open: false })}
            >
                <Alert severity={snack.severity}>{snack.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default SuperAdminProfessorEducation;
