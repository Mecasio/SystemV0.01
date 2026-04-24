import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Typography,
  Snackbar,
  Alert,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import SaveIcon from "@mui/icons-material/Save";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

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

const SchoolYearPanel = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  const [userID, setUserID] = useState("");
  const [userRole, setUserRole] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const pageId = 55;
  const permissionHeaders = {
    headers: {
      "x-employee-id": employeeID,
      "x-page-id": pageId,
    },
  };

  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [editID, setEditID] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [schoolYearToDelete, setSchoolYearToDelete] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const getSchoolYearId = (sy) => sy?.school_year_id ?? sy?.id;

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
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
      setUserID(storedID);
      setUserRole(storedRole);
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
    fetchYears();
    fetchSemesters();
    fetchSchoolYears();
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
        setCanEdit(Number(response.data?.can_edit) === 1);
        setCanDelete(Number(response.data?.can_delete) === 1);
      } else {
        setHasAccess(false);
        setCanCreate(false);
        setCanEdit(false);
        setCanDelete(false);
      }
    } catch {
      setHasAccess(false);
      setCanCreate(false);
      setCanEdit(false);
      setCanDelete(false);
      setSnackbar({
        open: true,
        message: "Failed to check access",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchYears = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/year_table`);
      setYears(res.data);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to fetch years",
        severity: "error",
      });
    }
  };

  const fetchSemesters = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/get_semester`);
      setSemesters(res.data);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to fetch semesters",
        severity: "error",
      });
    }
  };

  const fetchSchoolYears = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/school_years`);
      setSchoolYears(res.data);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to fetch school years",
        severity: "error",
      });
    }
  };

  const formatYearRange = (year) => {
    const start = parseInt(year.year_description);
    return `${start}-${start + 1}`;
  };

  const resetForm = () => {
    setSelectedYear("");
    setSelectedSemester("");
    setEditID(null);
  };

  const handleSubmitOrUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!selectedYear || !selectedSemester) {
      setSnackbar({
        open: true,
        message: "Please select both Year and Semester",
        severity: "warning",
      });
      return false;
    }

    if (editID && !canEdit) {
      setSnackbar({
        open: true,
        message: "You do not have permission to edit this item",
        severity: "error",
      });
      return false;
    }

    if (!editID && !canCreate) {
      setSnackbar({
        open: true,
        message: "You do not have permission to create items on this page",
        severity: "error",
      });
      return false;
    }

    if (editID) {
      try {
        await axios.put(
          `${API_BASE_URL}/edit_school_years/${editID}`,
          {
            year_id: selectedYear,
            semester_id: selectedSemester,
          },
          permissionHeaders,
        );
        setSnackbar({
          open: true,
          message: "School year updated successfully!",
          severity: "success",
        });
        setEditID(null);
        setSelectedYear("");
        setSelectedSemester("");
        fetchSchoolYears();
        return true;
      } catch {
        setSnackbar({
          open: true,
          message: "Failed to update school year",
          severity: "error",
        });
        return false;
      }
    }

    const duplicate = schoolYears.find(
      (sy) =>
        sy.year_id === selectedYear && sy.semester_id === selectedSemester,
    );
    if (duplicate) {
      setSnackbar({
        open: true,
        message: "This school year already exists",
        severity: "error",
      });
      return false;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/school_years`,
        {
          year_id: selectedYear,
          semester_id: selectedSemester,
          activator: 0,
        },
        permissionHeaders,
      );
      setSelectedYear("");
      setSelectedSemester("");
      fetchSchoolYears();
      setSnackbar({
        open: true,
        message: "School year added successfully!",
        severity: "success",
      });
      return true;
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to save school year",
        severity: "error",
      });
      return false;
    }
  };

  const handleEdit = (sy) => {
    if (!canEdit) {
      setSnackbar({
        open: true,
        message: "You do not have permission to edit this item",
        severity: "error",
      });
      return;
    }
    setSelectedYear(sy.year_id);
    setSelectedSemester(sy.semester_id);
    setEditID(getSchoolYearId(sy));
    setOpenDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!schoolYearToDelete) return;

    if (!canDelete) {
      setSnackbar({
        open: true,
        message: "You do not have permission to delete this item",
        severity: "error",
      });
      setOpenDeleteDialog(false);
      setSchoolYearToDelete(null);
      return;
    }

    try {
      await axios.delete(
        `${API_BASE_URL}/school_years/${getSchoolYearId(schoolYearToDelete)}`,
        permissionHeaders,
      );
      setSnackbar({
        open: true,
        message: "School year deleted successfully!",
        severity: "success",
      });
      fetchSchoolYears();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to delete school year",
        severity: "error",
      });
    } finally {
      setOpenDeleteDialog(false);
      setSchoolYearToDelete(null);
    }
  };

  const filteredSchoolYears = schoolYears.filter(
    (sy) =>
      String(sy.year_description).includes(searchQuery) ||
      sy.semester_description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSchoolYears.length / rowsPerPage),
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedSchoolYears = filteredSchoolYears.slice(startIndex, endIndex);

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
          School Year And Semester
        </Typography>
      </Box>

      <FormControl size="small" sx={{ minWidth: 220 }}>
        <Select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          displayEmpty
          sx={{ backgroundColor: "#fff", fontSize: "0.8rem" }}
        >
          <MenuItem value="">Select School Year</MenuItem>
          {years.map((year) => (
            <MenuItem key={year.year_id} value={year.year_id}>
              {formatYearRange(year)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 220 }}>
        <Select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          displayEmpty
          sx={{ backgroundColor: "#fff", fontSize: "0.8rem" }}
        >
          <MenuItem value="">Select Semester</MenuItem>
          {semesters.map((semester) => (
            <MenuItem key={semester.semester_id} value={semester.semester_id}>
              {semester.semester_description}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {showCreateActions && (
        <Button
          variant="contained"
          size="small"
          startIcon={
            <AddCircleOutlineIcon sx={{ fontSize: "14px !important" }} />
          }
          onClick={async () => {
            const isSaved = await handleSubmitOrUpdate();
            if (isSaved) {
              resetForm();
            }
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
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography
            variant="h4"
            sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
          >
            SCHOOL YEAR PANEL
          </Typography>

          <TextField
            variant="outlined"
            placeholder="Search School Year..."
            size="small"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
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
          <Typography sx={{ fontSize: "0.9rem", opacity: 0.9, mt: 0.2 }}>
            Manage school year and semester mapping
          </Typography>
        </Box>

        <InlineEntryForm />

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
            Total School Years: {filteredSchoolYears.length}
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
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              size="small"
              sx={pageDropdownSx}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 200,
                    backgroundColor: "#fff",
                  },
                },
              }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <MenuItem key={page} value={page}>
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
                <TableCell sx={thSx}>Year Level</TableCell>
                <TableCell sx={thSx}>Semester</TableCell>
                <TableCell sx={thSx} width={110} align="center">
                  Status
                </TableCell>
                {showActionColumn && (
                  <TableCell sx={thSx} width={170} align="center">
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedSchoolYears.length > 0 ? (
                paginatedSchoolYears.map((sy, index) => (
                  <TableRow
                    key={getSchoolYearId(sy) ?? index}
                    sx={{
                      backgroundColor:
                        sy.astatus === 1 ? "#d4edda" : index % 2 === 0 ? C.rowOdd : C.rowEven,
                      color: sy.astatus === 1 ? "#155724" : "inherit",
                      "&:hover": { backgroundColor: C.rowHover },
                    }}
                  >
                    <TableCell sx={tdSx} align="center">
                      {startIndex + index + 1}
                    </TableCell>
                    <TableCell
                      sx={{
                        ...tdSx,
                        color: C.textMuted,
                        fontWeight: 500,
                        opacity: 0.8,
                      }}
                    >{`${sy.year_description}-${parseInt(sy.year_description) + 1}`}</TableCell>
                    <TableCell sx={tdSx}>{sy.semester_description}</TableCell>
                    <TableCell sx={tdSx} align="center">
                      {sy.astatus === 1 ? "Active" : "Inactive"}
                    </TableCell>
                    {showActionColumn && (
                      <TableCell sx={tdSx} align="center">
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "6px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {canEdit && (
                            <Button
                              size="small"
                              sx={actionBtnSx(C.editBtn)}
                              onClick={() => {
                                handleEdit(sy);
                              }}
                            >
                              <EditIcon sx={{ fontSize: "12px !important", mr: 0.5 }} />
                              Edit
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              size="small"
                              sx={actionBtnSx(C.deleteBtn)}
                              onClick={() => {
                                setSchoolYearToDelete(sy);
                                setOpenDeleteDialog(true);
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: "12px !important", mr: 0.5 }} />
                              Delete
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
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
                    No school years found.
                  </TableCell>
                </TableRow>
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
            Showing {filteredSchoolYears.length === 0 ? 0 : startIndex + 1}-
            {Math.min(endIndex, filteredSchoolYears.length)} of{" "}
            {filteredSchoolYears.length}
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
          setSchoolYearToDelete(null);
        }}
      >
        <DialogTitle>Confirm Delete School Year</DialogTitle>

        <DialogContent>
          <Typography>
            Are you sure you want to delete the school year{" "}
            <b>
              {schoolYearToDelete
                ? `${schoolYearToDelete.year_description}-${
                    parseInt(schoolYearToDelete.year_description) + 1
                  }`
                : ""}
            </b>{" "}
            ({schoolYearToDelete?.semester_description})?
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            color="error"
            variant="outlined"
            onClick={() => {
              setOpenDeleteDialog(false);
              setSchoolYearToDelete(null);
            }}
          >
            Cancel
          </Button>

          <Button variant="contained" onClick={handleConfirmDelete}>
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          resetForm();
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: 6,
          },
        }}
      >
        <DialogTitle
          sx={{
            background: settings?.header_color || "#1976d2",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.1rem",
            py: 2,
          }}
        >
          {editID ? "Edit School Year" : "Add School Year"}
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box display="flex" flexDirection="column" gap={3}>
            <Box>
              <Typography fontWeight="bold" mb={1} mt={2}>
                School Year
              </Typography>

              <FormControl fullWidth size="small">
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  displayEmpty
                  sx={{
                    borderRadius: "8px",
                  }}
                >
                  <MenuItem value="">-- Select School Year --</MenuItem>

                  {years.map((year) => (
                    <MenuItem key={year.year_id} value={year.year_id}>
                      {formatYearRange(year)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography fontWeight="bold" mb={1}>
                Semester
              </Typography>

              <FormControl fullWidth size="small">
                <Select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  displayEmpty
                  sx={{
                    borderRadius: "8px",
                  }}
                >
                  <MenuItem value="">-- Select Semester --</MenuItem>

                  {semesters.map((semester) => (
                    <MenuItem
                      key={semester.semester_id}
                      value={semester.semester_id}
                    >
                      {semester.semester_description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: "1px solid #e0e0e0",
          }}
        >
          <Button
            onClick={() => {
              setOpenDialog(false);
              resetForm();
            }}
            color="error"
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={async (e) => {
              const isSaved = await handleSubmitOrUpdate(e);
              if (isSaved) {
                setOpenDialog(false);
              }
            }}
            sx={{
              px: 4,
              fontWeight: 600,
              textTransform: "none",
            }}
          >
            <SaveIcon fontSize="small" /> Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchoolYearPanel;
