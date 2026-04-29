import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";

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

const SemesterPanel = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  const [employeeID, setEmployeeID] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const [semesterDescription, setSemesterDescription] = useState("");
  const [semesterCode, setSemesterCode] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [searchQuery, setSearchQuery] = useState("");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const pageId = 58;

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
    fetchSemesters();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const checkAccess = async (employeeID) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`,
      );
      if (response.data?.page_privilege === 1) {
        setHasAccess(true);
        setCanCreate(Number(response.data?.can_create) === 1);
        setCanDelete(Number(response.data?.can_delete) === 1);
        setCanEdit(Number(response.data?.can_edit) === 1);
      } else {
        setHasAccess(false);
        setCanCreate(false);
        setCanDelete(false);
        setCanEdit(false);
      }
    } catch (err) {
      console.error("Error checking access:", err);
      setHasAccess(false);
      setCanCreate(false);
      setCanDelete(false);
      setCanEdit(false);
      toast("Failed to check access", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesters = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/get_semester`);
      setSemesters(res.data);
    } catch (err) {
      console.error("Error fetching semesters:", err);
      toast("Failed to fetch semesters", "error");
    }
  };

  const resetForm = () => {
    setSemesterDescription("");
    setSemesterCode("");
    setEditingId(null);
  };

  const toast = (message, severity) =>
    setSnackbar({ open: true, message, severity });

  const handleAdd = async () => {
    if (!semesterDescription.trim() || !semesterCode.trim()) {
      toast("Semester description and code are required", "warning");
      return;
    }

    if (!canCreate) {
      toast("No permission to create", "error");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/semesters`, {
        semester_description: semesterDescription.trim(),
        semester_code: semesterCode.trim(),
      });
      toast("Semester added!", "success");
      resetForm();
      fetchSemesters();
    } catch (err) {
      toast(err.response?.data?.error || "Failed to save semester", "error");
    }
  };

  const handleEdit = (semester) => {
    if (!canEdit) {
      toast("No permission to edit", "error");
      return;
    }

    setSemesterDescription(semester.semester_description || "");
    setSemesterCode(String(semester.semester_code || ""));
    setEditingId(semester.semester_id);
    setOpenEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!semesterDescription.trim() || !semesterCode.trim()) {
      toast("Semester description and code are required", "warning");
      return;
    }

    if (!canEdit) {
      toast("No permission to edit", "error");
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/semesters/${editingId}`, {
        semester_description: semesterDescription.trim(),
        semester_code: semesterCode.trim(),
      });
      toast("Semester updated!", "success");
      resetForm();
      setOpenEditDialog(false);
      fetchSemesters();
    } catch (err) {
      toast(err.response?.data?.error || "Failed to save semester", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!semesterToDelete || !canDelete) {
      toast("No permission to delete", "error");
      setOpenDeleteDialog(false);
      return;
    }

    try {
      await axios.delete(
        `${API_BASE_URL}/semesters/${semesterToDelete.semester_id}`,
      );
      toast("Semester deleted!", "success");
      fetchSemesters();
    } catch (err) {
      console.error("Error deleting semester:", err);
      toast(err.response?.data?.error || "Delete failed!", "error");
    } finally {
      setOpenDeleteDialog(false);
      setSemesterToDelete(null);
    }
  };

  const filteredSemesters = semesters.filter((semester) =>
    [
      semester.semester_description,
      semester.semester_code?.toString(),
      semester.semester_id?.toString(),
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSemesters.length / rowsPerPage),
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginated = filteredSemesters.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

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
    textMuted: mainButtonColor,
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

  const InlineEntryForm = () => (
    <Box
      sx={{
        backgroundColor: "#fff",
        border: `1px solid ${C.border}`,
        borderTop: "none",
        px: 2,
        py: 1.5,
        display: "flex",
        alignItems: "center",
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
          New Entry
        </Typography>
        <Typography sx={{ fontSize: "0.85rem", color: "#aaa" }}>
          Semester Details
        </Typography>
      </Box>

      <TextField
        size="small"
        placeholder="Enter semester description"
        value={semesterDescription}
        onChange={(e) => setSemesterDescription(e.target.value)}
        sx={{
          width: 320,
          "& .MuiOutlinedInput-root": {
            borderRadius: "4px",
            fontSize: "0.8rem",
            height: 32,
            "& fieldset": { borderColor: "#ccc" },
            "&:hover fieldset": { borderColor: "#999" },
            "&.Mui-focused fieldset": { borderColor: C.headerBg },
          },
        }}
      />

      <TextField
        size="small"
        placeholder="Enter semester code"
        value={semesterCode}
        onChange={(e) => setSemesterCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && canCreate && handleAdd()}
        sx={{
          width: 180,
          "& .MuiOutlinedInput-root": {
            borderRadius: "4px",
            fontSize: "0.8rem",
            height: 32,
            "& fieldset": { borderColor: "#ccc" },
            "&:hover fieldset": { borderColor: "#999" },
            "&.Mui-focused fieldset": { borderColor: C.headerBg },
          },
        }}
      />

      <Button
        variant="contained"
        size="small"
        startIcon={
          <AddCircleOutlineIcon sx={{ fontSize: "14px !important" }} />
        }
        onClick={handleAdd}
        disabled={!canCreate}
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
    </Box>
  );

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
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <Typography
            variant="h4"
            sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px", }}
          >
            SEMESTER PANEL FORM
          </Typography>
          <TextField
            variant="outlined"
            placeholder="Search semester / code"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 340,
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
          <Box>
            <Typography sx={{ fontSize: "0.9rem", opacity: 0.9, mt: 0.2 }}>
              Manage semesters and their code settings
            </Typography>
          </Box>
        </Box>

        <InlineEntryForm />

        {totalPages >= 1 && (
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
              Total Number of Semesters: {filteredSemesters.length}
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
               out  of Page {totalPages}
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
        )}

        <TableContainer>
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: C.subHeaderBg }}>
                <TableCell sx={thSx} width={60} align="center">
                  #
                </TableCell>
                <TableCell sx={thSx}>Semester Description</TableCell>
                <TableCell sx={thSx} width={120} align="center">
                  Code
                </TableCell>
                {showActionColumn && (
                  <TableCell sx={thSx} width={160} align="center">
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showActionColumn ? 5 : 4}
                    sx={{
                      textAlign: "center",
                      py: 5,
                      color: "#aaa",
                      fontSize: "0.8rem",
                    }}
                  >
                    No semesters found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((semester, i) => (
                  <TableRow
                    key={semester.semester_id}
                    sx={{
                      backgroundColor: i % 2 === 0 ? C.rowOdd : C.rowEven,
                      "&:hover": { backgroundColor: C.rowHover },
                      transition: "background 0.1s",
                    }}
                  >
                    <TableCell sx={tdSx} align="center">
                      {startIndex + i + 1}
                    </TableCell>
                    <TableCell
                      sx={{
                        ...tdSx,
                        color: C.textMuted,
                        fontWeight: 500,
                        opacity: 0.8,
                      }}
                    >
                      {semester.semester_description}
                    </TableCell>
                    <TableCell sx={tdSx} align="center">
                      {semester.semester_code}
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
                              onClick={() => handleEdit(semester)}
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
                                setSemesterToDelete(semester);
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

        {totalPages >= 1 && (
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
              Showing {filteredSemesters.length === 0 ? 0 : startIndex + 1}-
              {Math.min(startIndex + rowsPerPage, filteredSemesters.length)} of{" "}
              {filteredSemesters.length}
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
        )}
      </Box>

      <Dialog
        open={openEditDialog}
        onClose={() => {
          setOpenEditDialog(false);
          resetForm();
        }}
        maxWidth="xs"
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
          Edit Semester
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            size="small"
            autoFocus
            placeholder="Enter semester description"
            value={semesterDescription}
            variant="outlined"
            label="Description"
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setSemesterDescription(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "4px",
                fontSize: "1rem",
                "&.Mui-focused fieldset": { borderColor: C.headerBg },
              },
              "& .MuiInputLabel-root.Mui-focused": {
                color: C.headerBg,
              },
              mt: "1.5rem",
            }}
          />

          <TextField
            fullWidth
            size="small"
            placeholder="Enter semester code"
            value={semesterCode}
            variant="outlined"
            label="Code"
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setSemesterCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "4px",
                fontSize: "1rem",
                "&.Mui-focused fieldset": { borderColor: C.headerBg },
              },
              "& .MuiInputLabel-root.Mui-focused": {
                color: C.headerBg,
              },
              mt: 2,
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: "1px solid #eee" }}>
          <Button
            onClick={() => {
              setOpenEditDialog(false);
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
            onClick={handleEditSubmit}
            startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />}
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

      <Dialog
        open={openDeleteDialog}
        onClose={() => {
          setOpenDeleteDialog(false);
          setSemesterToDelete(null);
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
            Are you sure you want to delete {" "}
            <strong>{semesterToDelete?.semester_description}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: "1px solid #eee" }}>
          <Button
            onClick={() => {
              setOpenDeleteDialog(false);
              setSemesterToDelete(null);
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
            onClick={handleConfirmDelete}
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SemesterPanel;
