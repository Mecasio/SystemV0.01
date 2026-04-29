import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Button,
  Select,
  MenuItem,
  Typography,
  Paper,
  Grid,
  Snackbar,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  Alert
} from "@mui/material";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";


const DepartmentRoom = () => {
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
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
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
    if (settings.branches) {
      setBranches(
        typeof settings.branches === "string"
          ? JSON.parse(settings.branches)
          : settings.branches
      );
    }

  }, [settings]);



  // 🧠 Snackbar State
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // 🎓 Data States
  const [room, setRoom] = useState({ room_id: "", dprtmnt_id: "" });
  const [assignedRoomIds, setAssignedRoomIds] = useState([]);
  const [departmentList, setDepartmentList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [assignedRooms, setAssignedRooms] = useState({});

  // 🔐 Access Control
  const [userID, setUserID] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const pageId = 22;

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
  }, [settings]);

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUserRole(storedRole);
      setUserID(storedID);
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
      setHasAccess(response.data?.page_privilege === 1);
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
    }
  };

  const fetchDepartment = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/get_department`);
      setDepartmentList(response.data);
    } catch (err) {
      console.error("Error fetching departments:", err);
    }
  };

  const fetchRoomList = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/room_list`);
      setRoomList(response.data);
    } catch (err) {
      console.log("Error fetching room list:", err);
    }
  };

  const fetchRoomAssignments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/assignments`);
      const assignments = response.data;

      const groupedAssignments = assignments.reduce((acc, assignment) => {
        const deptId = assignment.dprtmnt_id;
        if (!acc[deptId]) acc[deptId] = [];
        acc[deptId].push({
          room_id: assignment.dprtmnt_room_id,
          room_description: assignment.room_description,
        });
        return acc;
      }, {});

      const assignedIds = assignments.map((a) => a.room_id || a.dprtmnt_room_id);
      setAssignedRoomIds(assignedIds);
      setAssignedRooms(groupedAssignments);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  useEffect(() => {
    fetchDepartment();
    fetchRoomList();
    fetchRoomAssignments();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoom((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [department, setDepartment] = useState({
    dep_name: "",
    dep_code: "",
  });

  const handleAssignRoom = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/assign`, room);
      fetchRoomAssignments();
      setRoom({ room_id: "", dprtmnt_id: "" });

      setSnackbar({
        open: true,
        message: "Room assigned successfully!",
        severity: "success",
      });
    } catch (err) {
      console.log("Error assigning room:", err);
      setSnackbar({
        open: true,
        message: "Failed to assign room. Please try again.",
        severity: "error",
      });
    }
  };

  const handleAddingDepartment = async () => {
    try {
      if (editMode) {
        await axios.put(`${API_BASE_URL}/update_department`, department);
      } else {
        await axios.post(`${API_BASE_URL}/add_department`, department);
      }

      fetchDepartment(); // refresh list

      setSnackbar({
        open: true,
        message: editMode
          ? "Department updated successfully!"
          : "Department added successfully!",
        severity: "success",
      });

      setOpenModal(false);
      setDepartment({ dep_name: "", dep_code: "" });

    } catch (err) {
      console.error("Error saving department:", err);
      setSnackbar({
        open: true,
        message: "Failed to save department.",
        severity: "error",
      });
    }
  };

  const handleChangesForEverything = (e) => {
    const { name, value } = e.target;
    setDepartment((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const [openUnassignDialog, setOpenUnassignDialog] = useState(false);
  const [roomToUnassign, setRoomToUnassign] = useState(null);


  const handleUnassignRoom = async (dprtmnt_room_id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/unassign/${dprtmnt_room_id}`);
      fetchRoomAssignments();

      setSnackbar({
        open: true,
        message: "Room unassigned successfully!",
        severity: "info",
      });
    } catch (err) {
      console.log("Error unassigning room:", err);
      setSnackbar({
        open: true,
        message: "Failed to unassign room.",
        severity: "error",
      });
    }
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
        sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px", mb: 2 }}
      >
        DEPARTMENT ROOM
      </Typography>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="body1" sx={{ color: subtitleColor }}>
         Assign room to each Department
          </Typography>
        </Box>

        <Button
          variant="contained"
          sx={{
            textTransform: "none",
            fontWeight: 600,
            px: 4,
        
          }}
          onClick={() => {
            setEditMode(false);
            setDepartment({ dep_name: "", dep_code: "" });
            setOpenModal(true);
          }}
        >
          + Add Department
        </Button>
      </Box>



      <br />
      <br />

      <Typography variant="h6" gutterBottom>
        Department Room Assignments
      </Typography>

      <Grid container spacing={1}>
        {departmentList.map((dept) => (
          <Grid item xs={12} md={4} key={dept.dprtmnt_id}>
            <Paper elevation={2} style={{ padding: "10px", border: `1px solid ${borderColor}` }}>
              <Typography variant="subtitle2" style={{ fontSize: "14px", marginBottom: "8px" }}>
                {dept.dprtmnt_name}
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {assignedRooms[dept.dprtmnt_id]?.length > 0 ? (
                  assignedRooms[dept.dprtmnt_id].map((room) => (
                    <Box
                      key={room.room_id}
                      sx={{
                        backgroundColor: mainButtonColor,
                        color: "white",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "12px",
                        position: "relative",
                      }}
                    >
                      Room {room.room_description}
                      <Button
                        onClick={() => {
                          setRoomToUnassign({
                            id: room.room_id || room.dprtmnt_room_id,
                            description: room.room_description,
                          });
                          setOpenUnassignDialog(true);
                        }}
                        size="small"
                        sx={{
                          position: "absolute",
                          top: "-6px",
                          right: "-6px",
                          minWidth: "22px",
                          height: "22px",
                          padding: "0",
                          color: "white",
                          backgroundColor: "rgba(0,0,0,0.4)",
                          borderRadius: "50%",
                          fontSize: "14px",
                          "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" },
                        }}
                      >
                        ×
                      </Button>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" style={{ fontSize: "12px" }}>
                    No rooms assigned.
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={openUnassignDialog}
        onClose={() => setOpenUnassignDialog(false)}
      >
        <DialogTitle>Confirm Unassign Room</DialogTitle>

        <DialogContent>
          <Typography>
            Are you sure you want to unassign{" "}
            <b>Room {roomToUnassign?.description}</b> from this department?
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
        color="error"
            variant="outlined"

            onClick={() => setOpenUnassignDialog(false)}>
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={() => {
              handleUnassignRoom(roomToUnassign.id);
              setOpenUnassignDialog(false);
              setRoomToUnassign(null);
            }}
          >
            Yes, Unassign
          </Button>
        </DialogActions>
      </Dialog>


      {/* ✅ Snackbar Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>


      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: 6
          }
        }}
      >
        {/* HEADER */}
        <DialogTitle
          sx={{
            background: settings?.header_color || "#1976d2",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.1rem",
            py: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          {editMode ? "Edit Department" : "Add New Department"}

          <IconButton
            onClick={() => setOpenModal(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* CONTENT */}
        <DialogContent sx={{ p: 3 }}>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography fontWeight="bold" mt={2}>
              Department Name:
            </Typography>

            <TextField
              label="Department Name"
              name="dep_name"
              value={department.dep_name}
              onChange={handleChangesForEverything}
              fullWidth
            />

            <Typography fontWeight="bold" mt={2}>
              Department Code:
            </Typography>

            <TextField
              label="Department Code"
              name="dep_code"
              value={department.dep_code}
              onChange={handleChangesForEverything}
              fullWidth
            />
          </Box>
        </DialogContent>

        {/* ACTIONS */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: "1px solid #e0e0e0"
          }}
        >
          <Button
   color="error"
            variant="outlined"
            sx={{ textTransform: "none", fontWeight: 600 }}
            onClick={() => setOpenModal(false)}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            sx={{
              px: 4,
              fontWeight: 600,
              textTransform: "none",
      
            }}
            onClick={handleAddingDepartment}
          >
           <SaveIcon fontSize="small" /> Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepartmentRoom;
