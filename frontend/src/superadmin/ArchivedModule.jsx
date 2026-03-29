import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RestoreIcon from "@mui/icons-material/Restore";
import DeleteIcon from "@mui/icons-material/Delete";
import API_BASE_URL from "../apiConfig";
import { SettingsContext } from "../App";
import LoadingOverlay from "../components/LoadingOverlay";

const pageId = 142;

const formatDate = (value) => {
  if (!value) return "N/A";

  const dateOnly = String(value).split("T")[0];
  const date = new Date(dateOnly);

  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatName = (account) => {
  const name = [account?.last_name, account?.first_name]
    .filter(Boolean)
    .join(", ");
  const suffix = [account?.middle_name, account?.extension]
    .filter(Boolean)
    .join(" ");

  return [name, suffix].filter(Boolean).join(" ");
};

const ArchivedModule = () => {
  const settings = useContext(SettingsContext);

  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [archivedAccounts, setArchivedAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const [canDelete, setCanDelete] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [dialogType, setDialogType] = useState("");
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    if (!settings) return;

    if (settings.border_color) {
      setBorderColor(settings.border_color);
    }

    if (settings.main_button_color) {
      setMainButtonColor(settings.main_button_color);
    }

    if (settings?.branches) {
      try {
        const parsed =
          typeof settings.branches === "string"
            ? JSON.parse(settings.branches)
            : settings.branches;

        setBranches(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error("Failed to parse branches:", error);
        setBranches([]);
      }
    }
  }, [settings]);

  const showSnack = (message, severity = "info") => {
    setSnack({
      open: true,
      message,
      severity,
    });
  };

  const fetchArchivedAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/auth/archived-accounts`,
      );
      setArchivedAccounts(response.data?.data || []);
    } catch (error) {
      console.error("Error fetching archived accounts:", error);
      showSnack("Failed to load archived accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedEmployeeID = localStorage.getItem("employee_id") || "";
    setEmployeeID(storedEmployeeID);
    fetchArchivedAccounts();
  }, []);

  useEffect(() => {
    if (!employeeID) return;

    axios
      .get(`${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`)
      .then((response) => {
        setCanDelete(Number(response.data?.can_delete) === 1);
        setCanEdit(Number(response.data?.can_edit) === 1);
      })
      .catch((error) => {
        console.error("Error fetching archived module permissions:", error);
        setCanDelete(false);
        setCanEdit(false);
      });
  }, [employeeID]);

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return archivedAccounts;
    }

    return archivedAccounts.filter((account) => {
      const values = [
        account.applicant_number,
        account.email,
        formatName(account),
      ].filter(Boolean);

      return values.some((value) =>
        String(value).toLowerCase().includes(query),
      );
    });
  }, [archivedAccounts, searchQuery]);

  const getCampusName = (campusId) => {
    const branch = branches.find(
      (item) => String(item?.id) === String(campusId),
    );

    return branch?.branch || campusId || "N/A";
  };

  const closeDialog = () => {
    if (actionLoading) return;
    setDialogType("");
    setSelectedAccount(null);
  };

  const openDialog = (type, account) => {
    setDialogType(type);
    setSelectedAccount(account);
  };

  const handleRestore = async () => {
    if (!selectedAccount?.person_id) return;

    try {
      setActionLoading(true);

      await axios.put(
        `${API_BASE_URL}/auth/restore-account/${selectedAccount.person_id}`,
        {},
        {
          headers: {
            "x-employee-id": employeeID,
            "x-page-id": pageId,
          },
        },
      );

      setArchivedAccounts((prev) =>
        prev.filter((item) => item.person_id !== selectedAccount.person_id),
      );
      setDialogType("");
      setSelectedAccount(null);
      showSnack("Account restored successfully", "success");
    } catch (error) {
      console.error("Restore account error:", error);
      showSnack(
        error.response?.data?.message || "Failed to restore account",
        "error",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedAccount?.person_id) return;

    try {
      setActionLoading(true);

      await axios.delete(
        `${API_BASE_URL}/auth/permanent-delete-account/${selectedAccount.person_id}`,
        {
          headers: {
            "x-employee-id": employeeID,
            "x-page-id": pageId,
          },
        },
      );

      setArchivedAccounts((prev) =>
        prev.filter((item) => item.person_id !== selectedAccount.person_id),
      );
      setDialogType("");
      setSelectedAccount(null);
      showSnack("Account permanently deleted", "success");
    } catch (error) {
      console.error("Permanent delete error:", error);
      showSnack(
        error.response?.data?.message || "Failed to permanently delete account",
        "error",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSnackClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <LoadingOverlay open={loading} message="Loading archived accounts..." />
    );
  }

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 150px)",
        mt: 1,
        p: 2,
      }}
    >
      <Typography variant="h5" fontWeight="bold" mb={1}>
        Archived Accounts
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Restore archived items or permanently delete them from the system.
      </Typography>

      <Paper
        sx={{
          p: 2,
          mb: 2,
          border: `1px solid ${borderColor}`,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search by applicant number, name, or email"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "gray" }} />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer
        component={Paper}
        sx={{ border: `1px solid ${borderColor}` }}
      >
        <Table size="small">
          <TableHead
            sx={{
              backgroundColor: settings?.header_color || mainButtonColor,
            }}
          >
            <TableRow>
              <TableCell sx={{ color: "white", textAlign: "center" }}>
                #
              </TableCell>
              <TableCell sx={{ color: "white", textAlign: "center" }}>
                Applicant Number
              </TableCell>
              <TableCell sx={{ color: "white" }}>Name</TableCell>
              <TableCell sx={{ color: "white" }}>Email</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center" }}>
                Campus
              </TableCell>
              <TableCell sx={{ color: "white", textAlign: "center" }}>
                Application Date
              </TableCell>
              <TableCell sx={{ color: "white", textAlign: "center" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: "center", py: 4 }}>
                  No archived accounts found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account, index) => (
                <TableRow key={account.person_id} hover>
                  <TableCell sx={{ textAlign: "center" }}>
                    {index + 1}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {account.applicant_number || "N/A"}
                  </TableCell>
                  <TableCell>{formatName(account) || "N/A"}</TableCell>
                  <TableCell>{account.email || "N/A"}</TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {getCampusName(account.campus)}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {formatDate(account.created_at)}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 1,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<RestoreIcon />}
                        disabled={!canEdit}
                        onClick={() => openDialog("restore", account)}
                        sx={{
                          backgroundColor: "#2e7d32",
                          "&:hover": { backgroundColor: "#1b5e20" },
                          "&.Mui-disabled": {
                            backgroundColor: "#C9C9C9",
                            color: "#666666",
                          },
                        }}
                      >
                        Restore
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<DeleteIcon />}
                        disabled={!canDelete}
                        onClick={() => openDialog("delete", account)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogType === "restore"}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm Restore</DialogTitle>
        <DialogContent>
          <Typography>
            Restore this archived account for{" "}
            <b>{formatName(selectedAccount) || "this item"}</b>?
          </Typography>
          <Typography sx={{ mt: 2 }} color="text.secondary">
            This will return the item to the active list.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleRestore}
            variant="contained"
            disabled={actionLoading}
            sx={{
              backgroundColor: "#2e7d32",
              "&:hover": { backgroundColor: "#1b5e20" },
            }}
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialogType === "delete"}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm Permanent Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete{" "}
            <b>{formatName(selectedAccount) || "this item"}</b>?
          </Typography>
          <Typography sx={{ mt: 2, color: "#b71c1c", fontWeight: "bold" }}>
            Warning: this action cannot be undone. Once deleted, the item cannot
            be recovered.
          </Typography>
          <Typography sx={{ mt: 1 }} color="text.secondary">
            This will permanently remove the archived account and related
            applicant records from the system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handlePermanentDelete}
            variant="contained"
            color="error"
            disabled={actionLoading}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        onClose={handleSnackClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackClose}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ArchivedModule;
