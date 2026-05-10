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
    InputLabel,
    Chip,
    IconButton,
    InputAdornment,
    Tooltip,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";

import { SettingsContext } from "../App";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";

/* ─── tiny style tag injected once ─── */
const STYLE_ID = "prof-edu-styles";
function injectPageStyles(accent) {
    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
        tag = document.createElement("style");
        tag.id = STYLE_ID;
        document.head.appendChild(tag);
    }
    tag.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');

    .pe-root * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }

    .pe-card {
        background: #fff;
        border-radius: 14px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 4px rgba(0,0,0,.04);
        overflow: hidden;
    }

    .pe-card-header {
        padding: 18px 22px 14px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .pe-card-body { padding: 22px; }

    /* form fields */
    .pe-field { margin-bottom: 16px; }
    .pe-field label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .04em;
        text-transform: uppercase;
        color: #6b7280;
        margin-bottom: 6px;
    }
    .pe-field label svg { font-size: 14px !important; opacity: .7; }
    .pe-field select, .pe-field input {
        width: 100%;
        padding: 10px 13px;
        border: 1.5px solid #e5e7eb;
        border-radius: 9px;
        font-size: 14px;
        font-family: 'DM Sans', sans-serif;
        color: #111827;
        background: #fafafa;
        outline: none;
        transition: border-color .15s, box-shadow .15s;
        appearance: none;
    }
    .pe-field select:focus, .pe-field input:focus {
        border-color: ${accent};
        box-shadow: 0 0 0 3px ${accent}22;
        background: #fff;
    }

    /* degree badge pills */
    .deg-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        font-weight: 500;
        padding: 3px 9px;
        border-radius: 20px;
    }
    .deg-b { background: #dbeafe; color: #1e40af; }
    .deg-m { background: #d1fae5; color: #065f46; }
    .deg-d { background: #ede9fe; color: #5b21b6; }
    .deg-empty { color: #d1d5db; font-style: italic; font-size: 12px; }

    /* table */
    .pe-table { width: 100%; border-collapse: collapse; }
    .pe-table th {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: #9ca3af;
        padding: 10px 14px;
        text-align: left;
        border-bottom: 1px solid #f0f0f0;
        white-space: nowrap;
    }
    .pe-table td {
        padding: 12px 14px;
        font-size: 13.5px;
        color: #374151;
        border-bottom: 1px solid #f9f9f9;
        vertical-align: middle;
    }
    .pe-table tr:last-child td { border-bottom: none; }
    .pe-table tr { transition: background .12s; }
    .pe-table tr:hover td { background: #f9fafb; }
    .pe-table tr.editing-row td { background: ${accent}08; }

    /* search */
    .pe-search {
        width: 100%;
        padding: 9px 13px 9px 38px;
        border: 1.5px solid #e5e7eb;
        border-radius: 9px;
        font-size: 13.5px;
        font-family: 'DM Sans', sans-serif;
        outline: none;
        color: #111827;
        background: #fafafa;
        transition: border-color .15s, box-shadow .15s;
    }
    .pe-search:focus {
        border-color: ${accent};
        box-shadow: 0 0 0 3px ${accent}22;
        background: #fff;
    }
    .pe-search-wrap { position: relative; }
    .pe-search-icon {
        position: absolute; left: 11px; top: 50%;
        transform: translateY(-50%);
        color: #9ca3af; font-size: 16px; pointer-events: none;
    }

    /* buttons */
    .pe-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 18px;
        border-radius: 9px;
        font-size: 13.5px;
        font-weight: 500;
        font-family: 'DM Sans', sans-serif;
        cursor: pointer;
        border: none;
        transition: filter .15s, transform .1s;
    }
    .pe-btn:active { transform: scale(.97); }
    .pe-btn-primary {
        background: ${accent};
        color: #fff;
        width: 100%;
        justify-content: center;
        padding: 11px 18px;
        font-size: 14px;
    }
    .pe-btn-primary:hover { filter: brightness(1.08); }
    .pe-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        width: 100%;
        justify-content: center;
        padding: 9px 18px;
        font-size: 13.5px;
        margin-top: 8px;
    }
    .pe-btn-secondary:hover { background: #e5e7eb; }
    .pe-btn-edit {
        background: #ecfdf5;
        color: #059669;
        padding: 6px 12px;
        font-size: 12px;
    }
    .pe-btn-edit:hover { background: #d1fae5; }
    .pe-btn-delete {
        background: #fef2f2;
        color: #dc2626;
        padding: 6px 12px;
        font-size: 12px;
    }
    .pe-btn-delete:hover { background: #fee2e2; }

    /* empty state */
    .pe-empty {
        text-align: center;
        padding: 48px 24px;
        color: #9ca3af;
    }
    .pe-empty svg { font-size: 40px; opacity: .3; margin-bottom: 10px; }

    /* page title area */
    .pe-page-title {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 24px;
    }
    .pe-icon-box {
        width: 46px; height: 46px;
        border-radius: 12px;
        background: ${accent}18;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
    }
    .pe-icon-box svg { color: ${accent}; font-size: 22px; }

    /* stat pills */
    .pe-stats {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 20px;
    }
    .pe-stat {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        font-size: 12.5px;
        color: #374151;
        font-weight: 500;
    }
    .pe-stat-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    /* form section divider */
    .pe-form-divider {
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: #d1d5db;
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 18px 0 14px;
    }
    .pe-form-divider::before, .pe-form-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #f0f0f0;
    }

    /* scrollable table container */
    .pe-table-scroll {
        max-height: calc(100vh - 280px);
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #e5e7eb transparent;
    }
    .pe-table-scroll::-webkit-scrollbar { width: 4px; }
    .pe-table-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
    `;
}

const SuperAdminProfessorEducation = () => {
    const settings = useContext(SettingsContext);
    const [mainButtonColor, setMainButtonColor] = useState("#4f46e5");
    const [borderColor, setBorderColor] = useState("#e5e7eb");
    const [titleColor, setTitleColor] = useState("#111827");

    const [profList, setProfList] = useState([]);
    const [personId, setPersonId] = useState("");
    const [bachelor, setBachelor] = useState("");
    const [master, setMaster] = useState("");
    const [doctor, setDoctor] = useState("");
    const [editing, setEditing] = useState(null);
    const [list, setList] = useState([]);
    const [search, setSearch] = useState("");

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
    const accent = mainButtonColor;

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
        if (!settings) return;
        if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.title_color) setTitleColor(settings.title_color);
    }, [settings]);

    useEffect(() => {
        injectPageStyles(accent);
    }, [accent]);

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
            const response = await axios.get(`${API_BASE_URL}/api/page_access/${empID}/${pageId}`);
            const allowed = response.data?.page_privilege === 1;
            setHasAccess(allowed);
            setCanCreate(allowed && Number(response.data?.can_create) === 1);
            setCanEdit(allowed && Number(response.data?.can_edit) === 1);
            setCanDelete(allowed && Number(response.data?.can_delete) === 1);
        } catch {
            setHasAccess(false);
            setCanCreate(false);
            setCanEdit(false);
            setCanDelete(false);
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

    const handleAdd = async () => {
        if (!canCreate) { showSnack("You do not have permission to create education records", "error"); return; }
        if (!personId) { showSnack("Please select a professor", "warning"); return; }
        try {
            await axios.post(`${API_BASE_URL}/person_prof`, { person_id: personId, bachelor, master, doctor }, auditConfig);
            showSnack("Education record added", "success");
            resetForm(); fetchList();
        } catch { showSnack("Failed to add record", "error"); }
    };

    const handleEdit = (row) => {
        if (!canEdit) { showSnack("You do not have permission to edit education records", "error"); return; }
        setEditing(row.person_id);
        setPersonId(row.person_id);
        setBachelor(row.bachelor || "");
        setMaster(row.master || "");
        setDoctor(row.doctor || "");
    };

    const handleUpdate = async () => {
        if (!canEdit) { showSnack("You do not have permission to edit education records", "error"); return; }
        try {
            await axios.put(`${API_BASE_URL}/person_prof/${editing}`, { bachelor, master, doctor }, auditConfig);
            showSnack("Record updated", "success");
            resetForm(); fetchList();
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

    const resetForm = () => { setEditing(null); setPersonId(""); setBachelor(""); setMaster(""); setDoctor(""); };
    const showSnack = (message, severity) => setSnack({ open: true, message, severity });

    // filtered list
    const filtered = list.filter(row => {
        const name = `${row.lname} ${row.fname} ${row.mname || ""}`.toLowerCase();
        return name.includes(search.toLowerCase());
    });

    // stats
    const withBachelor = list.filter(r => r.bachelor).length;
    const withMaster = list.filter(r => r.master).length;
    const withDoctor = list.filter(r => r.doctor).length;

    if (loading || hasAccess === null) return <LoadingOverlay open={loading} message="Loading..." />;
    if (!hasAccess) return <Unauthorized />;

    return (
        <div className="pe-root" style={{ padding: "20px 24px", minHeight: "calc(100vh - 110px)" }}>

            {/* ── Page Header ── */}
            <div className="pe-page-title">
                <div className="pe-icon-box">
                    <SchoolIcon />
                </div>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: titleColor, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                        Professor Education
                    </div>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                        Manage faculty academic credentials
                    </div>
                </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="pe-stats">
                <div className="pe-stat">
                    <span className="pe-stat-dot" style={{ background: accent }} />
                    <span>{list.length} total professors</span>
                </div>
                <div className="pe-stat">
                    <span className="pe-stat-dot" style={{ background: "#1e40af" }} />
                    <span>{withBachelor} with Bachelor's</span>
                </div>
                <div className="pe-stat">
                    <span className="pe-stat-dot" style={{ background: "#059669" }} />
                    <span>{withMaster} with Master's</span>
                </div>
                <div className="pe-stat">
                    <span className="pe-stat-dot" style={{ background: "#7c3aed" }} />
                    <span>{withDoctor} with Doctorate</span>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

                {/* ── LEFT: Form ── */}
                <div className="pe-card">
                    <div className="pe-card-header">
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: editing ? "#fef9c3" : `${accent}18`,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                            {editing
                                ? <EditIcon sx={{ fontSize: 16, color: "#92400e" }} />
                                : <AddIcon sx={{ fontSize: 16, color: accent }} />
                            }
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                                {editing ? "Edit Record" : "Add Education"}
                            </div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>
                                {editing ? "Updating existing entry" : "New faculty entry"}
                            </div>
                        </div>
                    </div>

                    <div className="pe-card-body">

                        {/* Professor selector (only when adding) */}
                        {!editing && (
                            <div className="pe-field">
                                <label><PersonIcon />Professor</label>
                                <select value={personId} onChange={e => setPersonId(e.target.value)}>
                                    <option value="">— Select professor —</option>
                                    {profList.map(p => (
                                        <option key={p.person_id} value={p.person_id}>
                                            {p.lname}, {p.fname} {p.mname || ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {editing && (
                            <div style={{
                                padding: "10px 13px", borderRadius: 9,
                                background: "#fef9c3", border: "1px solid #fde68a",
                                fontSize: 13, color: "#92400e", marginBottom: 16,
                                display: "flex", alignItems: "center", gap: 8
                            }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                                Editing: <strong>{list.find(r => r.person_id === editing)?.lname}, {list.find(r => r.person_id === editing)?.fname}</strong>
                            </div>
                        )}

                        <div className="pe-form-divider">Degrees</div>

                        <div className="pe-field">
                            <label><MenuBookIcon />Bachelor's Degree</label>
                            <input
                                type="text"
                                placeholder="e.g. BS Computer Science"
                                value={bachelor}
                                onChange={e => setBachelor(e.target.value)}
                            />
                        </div>

                        <div className="pe-field">
                            <label><AutoStoriesIcon />Master's Degree</label>
                            <input
                                type="text"
                                placeholder="e.g. MS Information Technology"
                                value={master}
                                onChange={e => setMaster(e.target.value)}
                            />
                        </div>

                        <div className="pe-field">
                            <label><WorkspacePremiumIcon />Doctorate</label>
                            <input
                                type="text"
                                placeholder="e.g. PhD Computer Engineering"
                                value={doctor}
                                onChange={e => setDoctor(e.target.value)}
                            />
                        </div>

                        <div className="pe-form-divider" />

                        <button className="pe-btn pe-btn-primary" onClick={editing ? handleUpdate : handleAdd}>
                            {editing ? <SaveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                            {editing ? "Save Changes" : "Add Record"}
                        </button>

                        {editing && (
                            <button className="pe-btn pe-btn-secondary" onClick={resetForm}>
                                <CloseIcon sx={{ fontSize: 15 }} />
                                Cancel Editing
                            </button>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Table ── */}
                <div className="pe-card">
                    <div className="pe-card-header" style={{ justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <SchoolIcon sx={{ fontSize: 16, color: "#059669" }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Records</div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>{filtered.length} entries</div>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="pe-search-wrap" style={{ width: 220 }}>
                            <SearchIcon className="pe-search-icon" />
                            <input
                                className="pe-search"
                                type="text"
                                placeholder="Search professor..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pe-table-scroll">
                        {filtered.length === 0 ? (
                            <div className="pe-empty">
                                <SchoolIcon />
                                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No records found</div>
                                <div style={{ fontSize: 12 }}>Add a professor's education to get started</div>
                            </div>
                        ) : (
                            <table className="pe-table">
                                <thead>
                                    <tr>
                                        <th>Professor</th>
                                        <th>Bachelor's</th>
                                        <th>Master's</th>
                                        <th>Doctorate</th>
                                        <th style={{ textAlign: "right" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(row => (
                                        <tr key={row.person_id} className={editing === row.person_id ? "editing-row" : ""}>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{
                                                        width: 30, height: 30, borderRadius: "50%",
                                                        background: `${accent}18`, display: "flex",
                                                        alignItems: "center", justifyContent: "center",
                                                        fontSize: 11, fontWeight: 700, color: accent,
                                                        flexShrink: 0
                                                    }}>
                                                        {row.fname?.[0]}{row.lname?.[0]}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500, fontSize: 13, color: "#111827" }}>
                                                            {row.lname}, {row.fname}
                                                        </div>
                                                        {row.mname && (
                                                            <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{row.mname}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {row.bachelor
                                                    ? <span className="deg-badge deg-b">{row.bachelor}</span>
                                                    : <span className="deg-empty">—</span>
                                                }
                                            </td>
                                            <td>
                                                {row.master
                                                    ? <span className="deg-badge deg-m">{row.master}</span>
                                                    : <span className="deg-empty">—</span>
                                                }
                                            </td>
                                            <td>
                                                {row.doctor
                                                    ? <span className="deg-badge deg-d">{row.doctor}</span>
                                                    : <span className="deg-empty">—</span>
                                                }
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                    <button className="pe-btn pe-btn-edit" onClick={() => handleEdit(row)}>
                                                        <EditIcon sx={{ fontSize: 13 }} /> Edit
                                                    </button>
                                                    <button className="pe-btn pe-btn-delete" onClick={() => handleDelete(row.person_id)}>
                                                        <DeleteIcon sx={{ fontSize: 13 }} /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={() => setSnack(s => ({ ...s, open: false }))}
                    sx={{ borderRadius: 2, fontFamily: "'DM Sans', sans-serif" }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default SuperAdminProfessorEducation;
