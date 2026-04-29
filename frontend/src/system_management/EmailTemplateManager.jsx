import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
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
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  TableContainer,
  Switch,
  FormControlLabel,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";

const API = `${API_BASE_URL}/api/email-templates`;

const actionBtnSx = (bg) => ({
  textTransform: "none",
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#fff",
  backgroundColor: bg,
  borderRadius: "4px",
  px: 1.2,
  py: 0.35,
  minWidth: "auto",
  boxShadow: "none",
  "&:hover": { backgroundColor: bg, opacity: 0.85, boxShadow: "none" },
});

export default function EmailTemplateManager() {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  const [employeeID, setEmployeeID] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    sender_name: "",
    department_id: "",
    employee_id: "",
    is_active: true,
  });
  const [editing, setEditing] = useState(null);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const pageId = 67;
  const permissionHeaders = {
    headers: {
      "x-employee-id": employeeID,
      "x-page-id": pageId,
    },
  };

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.main_button_color) {
      setMainButtonColor(settings.main_button_color);
    }
  }, [settings]);

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
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

  useEffect(() => {
    loadTemplates();
    fetchDepartments();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const showSnack = (message, severity = "info") =>
    setSnack({ open: true, message, severity });

  const resetForm = () => {
    setEditing(null);
    setForm({
      sender_name: "",
      department_id: "",
      employee_id: "",
      is_active: true,
    });
  };

  const checkAccess = async (employeeID) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`,
      );
      if (response.data?.page_privilege === 1) {
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
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await axios.get(API);
      setRows(res.data || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      showSnack("Failed to load templates", "error");
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/departments`);
      setDepartments(res.data || []);
    } catch (err) {
      console.error("Failed to fetch departments", err);
      showSnack("Failed to fetch departments", "error");
    }
  };

  const handleAdd = async () => {
    if (!form.sender_name.trim() || !form.department_id) {
      showSnack("Sender name and department are required", "warning");
      return false;
    }

    if (!canCreate) {
      showSnack("You do not have permission to create items on this page", "error");
      return false;
    }

    try {
      await axios.post(API, form, permissionHeaders);
      showSnack("Template successfully added", "success");
      resetForm();
      loadTemplates();
      return true;
    } catch (err) {
      console.error("Error adding template:", err);
      showSnack(err.response?.data?.error || "Failed to add template", "error");
      return false;
    }
  };

  const handleEdit = (row) => {
    if (!canEdit) {
      showSnack("You do not have permission to edit this item", "error");
      return;
    }

    setEditing(row.template_id);
    setForm({
      sender_name: row.sender_name || "",
      department_id: row.department_id || "",
      employee_id: row.employee_id || "",
      is_active: !!row.is_active,
    });
    setOpenFormDialog(true);
  };

  const handleUpdate = async () => {
    if (!editing) return false;

    if (!canEdit) {
      showSnack("You do not have permission to edit this item", "error");
      return false;
    }

    try {
      await axios.put(`${API}/${editing}`, form, permissionHeaders);
      showSnack("Template updated successfully", "success");
      resetForm();
      loadTemplates();
      return true;
    } catch (err) {
      console.error("Error updating template:", err);
      showSnack(err.response?.data?.error || "Failed to update template", "error");
      return false;
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    if (!canDelete) {
      showSnack("You do not have permission to delete this item", "error");
      return;
    }

    try {
      await axios.delete(`${API}/${templateToDelete.template_id}`, permissionHeaders);
      showSnack("Template deleted successfully", "success");
      loadTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
      showSnack(err.response?.data?.error || "Failed to delete template", "error");
    } finally {
      setOpenDeleteDialog(false);
      setTemplateToDelete(null);
    }
  };

  const filteredRows = rows.filter((row) =>
    [
      row.sender_name,
      row.department_name,
      row.employee_id,
      row.is_active ? "active" : "inactive",
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const showCreateActions = canCreate;
  const showActionColumn = canEdit || canDelete;

  const C = {
    headerBg: mainButtonColor,
    headerText: "#fff",
    subHeaderBg: "#f5f5f5",
    rowOdd: "#fff",
    rowEven: "#fafafa",
    rowHover: "#f0e8e8",
    border: "#ddd",
    editBtn: "#2e7d32",
    deleteBtn: "#9E0000",
    addBtn: mainButtonColor,
  };

  const thSx = {
    fontWeight: 700,
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#444",
    backgroundColor: "#efefef",
    borderBottom: "2px solid #ddd",
    borderRight: "1px solid #e0e0e0",
    py: 1,
    px: 1.5,
    whiteSpace: "nowrap",
  };

  const tdSx = {
    fontSize: "0.8rem",
    color: "#333",
    borderBottom: "1px solid #ebebeb",
    borderRight: "1px solid #ebebeb",
    py: 0.85,
    px: 1.5,
  };

  const pagBtnSx = {
    textTransform: "none",
    fontSize: "0.72rem",
    fontWeight: 600,
    color: "white",
    borderColor: "#ccc",
    borderRadius: "3px",
    minWidth: 48,
    height: 28,
    px: 1,
    py: 0,
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "#f0e8e8",
      borderColor: C.headerBg,
      color: C.headerBg,
    },
    "&.Mui-disabled": { opacity: 0.5, color: "white", borderColor: "white" },
  };

  const pageDropdownSx = {
    fontSize: "0.75rem",
    color: "white",
    height: 28,
    ".MuiOutlinedInput-notchedOutline": { borderColor: "#ccc" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#fff" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#fff" },
    ".MuiSelect-icon": { color: "white" },
    ".MuiSelect-select": { py: 0, px: 1 },
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "3px",
    minWidth: 90,
  };

  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        backgroundColor: "transparent",
        mt: 1,
        p: 2,
      }}
    >
      <Box sx={{ mb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography
            variant="h4"
            sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
          >
            EMAIL TEMPLATE MANAGER
          </Typography>
          <TextField
            variant="outlined"
            placeholder="Search sender / department / employee"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 360,
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
        <hr style={{ border: "1px solid #ccc", marginTop: 14 }} />
      </Box>

      <Box
        sx={{
          border: `1px solid ${C.border}`,
          borderRadius: "4px",
          overflow: "hidden",
          mt: 2,
        }}
      >
        <Box
          sx={{
            backgroundColor: C.headerBg,
            color: C.headerText,
            px: 2,
            py: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ fontSize: "0.9rem", opacity: 0.9, mt: 0.2 }}>
            Manage email sender accounts and department mapping
          </Typography>
        </Box>

        <Box
          sx={{
            backgroundColor: "#fff",
            border: `1px solid ${C.border}`,
            borderTop: "none",
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: "-0.9rem" }}>
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#555",
                textTransform: "uppercase",
                letterSpacing: "-0.05em",
              }}
            >
              Email Accounts
            </Typography>
            <Typography sx={{ fontSize: "0.85rem", color: "#aaa" }}>
              Sender registration and activation settings
            </Typography>
          </Box>
          {showCreateActions && (
            <Button
              variant="contained"
              size="small"
              startIcon={
                <AddCircleOutlineIcon sx={{ fontSize: "14px !important" }} />
              }
              onClick={() => {
                resetForm();
                setOpenFormDialog(true);
              }}
              sx={{
                ...actionBtnSx(C.addBtn),
                px: 2,
                py: 0.65,
                fontSize: "0.75rem",
                border: `1px solid ${C.addBtn}`,
              }}
            >
              Add Entry
            </Button>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            backgroundColor: C.headerBg,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <Typography
            sx={{ fontSize: "0.75rem", color: "white", opacity: 0.9 }}
          >
            Total Registered Email Accounts: {filteredRows.length}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {["First", "Prev"].map((lbl) => (
              <Button
                key={lbl}
                size="small"
                variant="outlined"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage(
                    lbl === "First" ? 1 : (p) => Math.max(p - 1, 1),
                  )
                }
                sx={pagBtnSx}
              >
                {lbl}
              </Button>
            ))}
            <Select
              size="small"
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              sx={pageDropdownSx}
              MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <MenuItem key={page} value={page} sx={{ fontSize: "0.75rem" }}>
                   Page {page}
                  </MenuItem>
                ),
              )}
            </Select>
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "white",
                lineHeight: "28px",
              }}
            >
             out of Page {totalPages}
            </Typography>
            {["Next", "Last"].map((lbl) => (
              <Button
                key={lbl}
                size="small"
                variant="outlined"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage(
                    lbl === "Last"
                      ? totalPages
                      : (p) => Math.min(p + 1, totalPages),
                  )
                }
                sx={pagBtnSx}
              >
                {lbl}
              </Button>
            ))}
          </Box>
        </Box>

        <TableContainer>
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: C.subHeaderBg }}>
                <TableCell sx={thSx} width={60} align="center">
                  #
                </TableCell>
                <TableCell sx={thSx}>Gmail Account</TableCell>
                <TableCell sx={thSx}>Department</TableCell>
                <TableCell sx={thSx}>Employee ID</TableCell>
                <TableCell sx={thSx} width={100} align="center">
                  Active
                </TableCell>
                {showActionColumn && (
                  <TableCell sx={thSx} width={170} align="center">
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showActionColumn ? 6 : 5}
                    sx={{
                      textAlign: "center",
                      py: 5,
                      color: "#aaa",
                      fontSize: "0.8rem",
                    }}
                  >
                    No templates found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row, index) => (
                  <TableRow
                    key={row.template_id}
                    sx={{
                      backgroundColor: index % 2 === 0 ? C.rowOdd : C.rowEven,
                      "&:hover": { backgroundColor: C.rowHover },
                      transition: "background 0.1s",
                    }}
                  >
                    <TableCell sx={tdSx} align="center">
                      {startIndex + index + 1}
                    </TableCell>
                    <TableCell sx={tdSx}>{row.sender_name}</TableCell>
                    <TableCell sx={tdSx}>{row.department_name || "N/A"}</TableCell>
                    <TableCell sx={tdSx}>{row.employee_id || "N/A"}</TableCell>
                    <TableCell sx={tdSx} align="center">
                      {row.is_active ? "Yes" : "No"}
                    </TableCell>
                    {showActionColumn && (
                      <TableCell sx={tdSx} align="center">
                        <Box
                          sx={{
                            display: "flex",
                            gap: 0.75,
                            justifyContent: "center",
                          }}
                        >
                          {canEdit && (
                            <Button
                              size="small"
                              startIcon={
                                <EditIcon sx={{ fontSize: "12px !important" }} />
                              }
                              onClick={() => handleEdit(row)}
                              sx={actionBtnSx(C.editBtn)}
                            >
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="small"
                              startIcon={
                                <DeleteIcon sx={{ fontSize: "12px !important" }} />
                              }
                              onClick={() => {
                                setTemplateToDelete(row);
                                setOpenDeleteDialog(true);
                              }}
                              sx={actionBtnSx(C.deleteBtn)}
                            >
                              Delete
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            backgroundColor: C.headerBg,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "white" }}>
            Showing {filteredRows.length === 0 ? 0 : startIndex + 1}-
            {Math.min(startIndex + rowsPerPage, filteredRows.length)} of{" "}
            {filteredRows.length}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {["First", "Prev"].map((lbl) => (
              <Button
                key={lbl}
                size="small"
                variant="outlined"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage(
                    lbl === "First" ? 1 : (p) => Math.max(p - 1, 1),
                  )
                }
                sx={pagBtnSx}
              >
                {lbl}
              </Button>
            ))}
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "white",
                lineHeight: "28px",
                px: 1,
              }}
            >
              Page {currentPage} / {totalPages}
            </Typography>
            {["Next", "Last"].map((lbl) => (
              <Button
                key={lbl}
                size="small"
                variant="outlined"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage(
                    lbl === "Last"
                      ? totalPages
                      : (p) => Math.min(p + 1, totalPages),
                  )
                }
                sx={pagBtnSx}
              >
                {lbl}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      <Dialog
        open={openDeleteDialog}
        onClose={() => {
          setOpenDeleteDialog(false);
          setTemplateToDelete(null);
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}
      >
        <DialogTitle
          sx={{
            background: "#B22222",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1rem",
            py: 1.5,
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "0.9rem", marginTop: "1.5rem" }}>
            Are you sure you want to delete the email template{" "}
            <strong>{templateToDelete?.sender_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: "1px solid #eee" }}>
          <Button
            onClick={() => {
              setOpenDeleteDialog(false);
              setTemplateToDelete(null);
            }}
            color="error"
            variant="outlined"
            size="small"
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "4px" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={handleDelete}
            sx={{
              ...actionBtnSx(C.deleteBtn),
              px: 2.5,
              py: 0.65,
              fontSize: "0.8rem",
            }}
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openFormDialog}
        onClose={() => {
          setOpenFormDialog(false);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}
      >
        <DialogTitle
          sx={{
            background: C.headerBg,
            color: "#fff",
            fontWeight: 700,
            fontSize: "1rem",
            py: 1.5,
          }}
        >
          {editing ? "Edit Email Template" : "Add Email Template"}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            size="small"
            autoFocus
            label="Sender Name"
            value={form.sender_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sender_name: e.target.value }))
            }
            sx={{ mt: "1.5rem" }}
          />
          <TextField
            select
            fullWidth
            size="small"
            label="Department"
            value={form.department_id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, department_id: e.target.value }))
            }
            sx={{ mt: 2 }}
          >
            <MenuItem value="">Select Department</MenuItem>
            {departments.map((d) => (
              <MenuItem key={d.dprtmnt_id} value={d.dprtmnt_id}>
                {d.dprtmnt_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            size="small"
            label="Employee ID"
            value={form.employee_id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, employee_id: e.target.value }))
            }
            sx={{ mt: 2 }}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={form.is_active}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: "1px solid #eee" }}>
          <Button
            onClick={() => {
              setOpenFormDialog(false);
              resetForm();
            }}
            color="error"
            variant="outlined"
            size="small"
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "4px" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />}
            onClick={async () => {
              const ok = editing ? await handleUpdate() : await handleAdd();
              if (ok) {
                setOpenFormDialog(false);
              }
            }}
            sx={{
              ...actionBtnSx(C.headerBg),
              px: 2.5,
              py: 0.65,
              fontSize: "0.8rem",
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
