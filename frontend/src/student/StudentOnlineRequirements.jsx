import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import {
    Box,
    Button,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    Container,
    TableHead,
    TableRow,
    Snackbar,
    Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import axios from "axios";
import ErrorIcon from "@mui/icons-material/Error";
import API_BASE_URL from "../apiConfig";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";

const StudentOnlineRequirements = () => {
    const settings = useContext(SettingsContext);

    const [titleColor, setTitleColor] = useState("#000000");
    const [subtitleColor, setSubtitleColor] = useState("#555555");
    const [borderColor, setBorderColor] = useState("#000000");
    const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

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
        if (settings.main_button_color)
            setMainButtonColor(settings.main_button_color);

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

    const [requirements, setRequirements] = useState([]); // ✅ dynamic requirements

    const [uploads, setUploads] = useState([]);
    const [userID, setUserID] = useState("");
    const [selectedFiles, setSelectedFiles] = useState({});
    const [allRequirementsCompleted, setAllRequirementsCompleted] = useState(
        localStorage.getItem("requirementsCompleted") === "1",
    );
    const [snack, setSnack] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    useEffect(() => {
        const StudentPersonId = localStorage.getItem("person_id");

        if (!StudentPersonId) {
            console.log("No Student person id detected.")
        }

        fetchStudentDocuments(StudentPersonId)

    }, []);

    const fetchStudentDocuments = async (StudentPersonId) => {
        try {
            const res = await axios.get(
                `${API_BASE_URL}/api/student-documents/${StudentPersonId}`
            );

            const data = res.data.data;

            console.log("Student documents:", data);

            // Normalize shape for UI
            const normalized = data.map((doc) => ({
                id: doc.requirements_id,
                description: doc.description,
                category: doc.category,
                is_required: doc.is_required,
                is_optional: doc.is_optional,

                upload_id: doc.upload_id,
                original_name: doc.original_name,
                file_path: doc.file_path,
                status: doc.status,
                remarks: doc.remarks,
            }));

            setRequirements(normalized);
            setUploads(normalized);

            const rebuiltSelectedFiles = {};

            normalized.forEach((doc) => {
                if (doc.original_name) {
                    rebuiltSelectedFiles[doc.id] = doc.original_name;
                }
            });

            setSelectedFiles(rebuiltSelectedFiles);

        } catch (err) {
            console.error("Error fetching student documents:", err);
        }
    };



    const [openModal, setOpenModal] = useState(false);
    const [openConfirmModal, setOpenConfirmModal] = useState(false);


    useEffect(() => {
        const completed = localStorage.getItem("requirementsCompleted");

        if (completed === "1") {
            setOpenModal(true); // 🎉 show success modal ONLY on revisit
        }
    }, []);

    useEffect(() => {
        const personId = localStorage.getItem("person_id");

        if (personId) {
            setUserID(personId);
        }
    }, []);


    const [totalRequirements, setTotalRequirements] = useState(0);

    useEffect(() => {
        const fetchTotalRequirements = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/total-requirements`);
                setTotalRequirements(res.data.total);
            } catch (err) {
                console.error("Error fetching total requirements:", err);
            }
        };

        fetchTotalRequirements();
    }, []);

    const handleUpload = async (key, file) => {
        if (!file) return;

        // ✅ 4MB check
        const maxSize = 4 * 1024 * 1024;

        if (file.size > maxSize) {
            setSnack({
                open: true,
                severity: "error",
                message: "File must not exceed 4MB",
            });
            return; // ❌ STOP upload
        }

        setSelectedFiles((prev) => ({ ...prev, [key]: file.name }));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("requirements_id", key);
        formData.append("person_id", userID);

        try {
            await axios.post(`${API_BASE_URL}/api/upload/enrollment`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            setSnack({
                open: true,
                severity: "success",
                message: "File uploaded successfully",
            });

            fetchStudentDocuments(localStorage.getItem("person_id"));

        } catch (err) {
            console.error("Upload error:", err);

            setSnack({
                open: true,
                severity: "error",
                message: err.response?.data?.error || "Upload failed",
            });
        }
    };

    const handleDelete = async (uploadId) => {
        try {
            await axios.delete(
                `${API_BASE_URL}/api/student-upload/${uploadId}`
            );

            setSnack({
                open: true,
                severity: "success",
                message: "File deleted successfully",
            });

            fetchStudentDocuments(localStorage.getItem("person_id"));

        } catch (err) {
            console.error("Delete error:", err);

            setSnack({
                open: true,
                severity: "error",
                message: "Failed to delete file",
            });
        }
    };
    
    const isFormValid = () => {
        // ✅ Get MAIN required requirements
        const requiredMain = requirements.filter(
            (r) => r.category === "Main" && Number(r.is_required) === 1,
        );

        // ✅ Get uploaded requirement IDs
        const uploadedIds = new Set(uploads.map((u) => Number(u.requirements_id)));

        // ✅ Find missing ones
        const missing = requiredMain.filter(
            (req) => !uploadedIds.has(Number(req.id)),
        );

        if (missing.length > 0) {
            const names = missing.map((m) => m.description).join(", ");

            setSnack({
                open: true,
                severity: "warning",
                message: `Please upload all required MAIN requirements: ${names}`,
            });

            return false;
        }

        return true;
    };

    const handleClose = (_, reason) => {
        if (reason === "clickaway") return;
        setSnack((prev) => ({ ...prev, open: false }));
    };

    const renderRow = (doc) => {
        const uploaded = doc.upload_id ? doc : null;

        return (
            <TableRow key={doc.id}>
                <TableCell
                    sx={{
                        fontWeight: "bold",
                        width: "25%",
                        border: `1px solid ${borderColor}`,
                    }}
                >
                    {doc.description}
                    {doc.is_optional === 1 && (
                        <span style={{ marginLeft: 2 }}>(Optional)</span>
                    )}

                    {doc.is_required === 1 && (
                        <span style={{ color: "red", marginLeft: 5 }}>*</span>
                    )}
                </TableCell>
                <TableCell
                    sx={{
                        width: "25%",
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        verticalAlign: "middle", // ✅ center vertically in cell
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center", // ✅ center horizontally
                            gap: 1,
                            width: "100%",
                        }}
                    >
                        <Box sx={{ width: "220px", flexShrink: 0, textAlign: "center" }}>
                            {selectedFiles[doc.id] ? (
                                <Box
                                    sx={{
                                        backgroundColor: "#e0e0e0",
                                        padding: "6px 12px",
                                        borderRadius: "4px",
                                        fontSize: "14px",
                                        fontWeight: "bold",
                                        height: "40px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                    title={selectedFiles[doc.id]}
                                >
                                    {selectedFiles[doc.id]}
                                </Box>
                            ) : (
                                <Box sx={{ height: "40px" }} />
                            )}
                        </Box>

                        <Box sx={{ flexShrink: 0 }}>
                            <Button
                                variant="contained"
                                component="label"
                                startIcon={<CloudUploadIcon />}
                                sx={{
                                    backgroundColor: "#F0C03F",
                                    color: "white",
                                    fontWeight: "bold",
                                    height: "40px",
                                    textTransform: "none",
                                    minWidth: "140px",
                                }}
                            >
                                Browse File
                                <input
                                    key={selectedFiles[doc.id] || doc.id}
                                    hidden
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={(e) => handleUpload(doc.id, e.target.files[0])}
                                />
                            </Button>
                        </Box>
                    </Box>
                </TableCell>

                <TableCell sx={{ width: "25%", border: `1px solid ${borderColor}` }}>
                    {typeof uploaded?.remarks === "string" &&
                        uploaded.remarks.trim() !== "" && (
                            <Typography
                                sx={{
                                    fontStyle: "normal",
                                    color: "inherit",
                                }}
                            >
                                {uploaded.remarks}
                            </Typography>
                        )}

                    {uploaded?.status == 1 || uploaded?.status == 2 ? (
                        <Typography
                            sx={{
                                mt: 0.5,
                                fontSize: "14px",
                                color: uploaded?.status == 1 ? "green" : "red",
                                fontWeight: "bold",
                            }}
                        >
                            {uploaded?.status == 1 ? "Verified" : "Rejected"}
                        </Typography>
                    ) : null}
                </TableCell>

                <TableCell sx={{ width: "10%", border: `1px solid ${borderColor}` }}>
                    {uploaded && (
                        <Button
                            variant="contained"
                            color="primary"
                            href={`${API_BASE_URL}/StudentOnlineDocuments/${uploaded.file_path}`}
                            target="_blank"
                            startIcon={<VisibilityIcon />}
                            sx={{
                                height: "40px",
                                textTransform: "none",
                                minWidth: "100px",
                                width: "100%",
                            }}
                        >
                            Preview
                        </Button>
                    )}
                </TableCell>

                <TableCell sx={{ width: "10%", border: `1px solid ${borderColor}` }}>
                    {uploaded && (
                        <Button
                            onClick={() => handleDelete(uploaded.upload_id)}
                            startIcon={<DeleteIcon />}
                            sx={{
                                backgroundColor: "#9E0000",
                                color: "white",
                           
                                fontWeight: "bold",
                                height: "40px",
                                textTransform: "none",
                                minWidth: "100px",
                                width: "100%",
                            }}
                        >
                            Delete
                        </Button>
                    )}
                </TableCell>
            </TableRow>
        );
    };

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
            {/* ✅ Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={5000}
                onClose={handleClose}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={handleClose}
                    sx={{ width: "100%" }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>



            <Dialog
                open={openConfirmModal}
                onClose={() => setOpenConfirmModal(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: "bold", textAlign: "center" }}>
                    📄 Review Your Uploaded Requirements
                </DialogTitle>

                <DialogContent>
                    <Typography sx={{ mb: 2, textAlign: "center" }}>
                        Please review your uploaded documents before final submission.
                    </Typography>

                    {/* 🔹 Requirements List */}
                    {requirements
                        .filter((r) => r.category === "Main")
                        .map((doc) => {
                            const uploaded = uploads.find(
                                (u) => Number(u.requirements_id) === Number(doc.id),
                            );

                            return (
                                <Box
                                    key={doc.id}
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        border: "1px solid #ccc",
                                        borderRadius: "8px",
                                        p: 1.5,
                                        mb: 1,
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: "bold" }}>
                                            {doc.description}
                                        </Typography>

                                        <Typography sx={{ fontSize: "13px", color: "#555" }}>
                                            {uploaded?.original_name || "No file uploaded"}
                                        </Typography>
                                    </Box>

                                    {uploaded && (
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<VisibilityIcon />}
                                            href={`${API_BASE_URL}/StudentOnlineDocuments/${uploaded.file_path}`}
                                            target="_blank"
                                        >
                                            Preview
                                        </Button>
                                    )}
                                </Box>
                            );
                        })}

                    {/* 🔔 Notice */}
                    <Box
                        sx={{
                            mt: 3,
                            p: 2,
                            backgroundColor: "#fff3cd",
                            border: "1px solid #ffeeba",
                            borderRadius: "8px",
                        }}
                    >
                        <Typography sx={{ fontSize: "14px" }}>
                            ⚠ <strong>Notice:</strong> Please ensure that all uploaded
                            documents are correct and clear.
                        </Typography>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
                    {/* Cancel */}
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => setOpenConfirmModal(false)}
                    >
                        Cancel
                    </Button>

                    {/* Final Submit */}
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => {
                            // ✅ VALIDATION CHECK
                            if (!isFormValid()) {
                                return; // STOP submission
                            }

                            setOpenConfirmModal(false);

                            localStorage.setItem("requirementsCompleted", "1");

                            setSnack({
                                open: true,
                                severity: "success",
                                message: "Requirements submitted successfully.",
                            });

                            window.location.href = "/student_dashboard";
                        }}
                    >
                        Submit Requirements
                    </Button>
                </DialogActions>
            </Dialog>

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
                    sx={{
                        fontWeight: "bold",
                        color: titleColor,
                        fontSize: "36px",
                    }}
                >
                    STUDENT'S REQUIREMENTS
                </Typography>
            </Box>
            <hr style={{ border: "1px solid #ccc", width: "100%" }} />

            <br />

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    mt: 2,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        gap: 2,
                        width: "100%",
                        p: 2,
                        borderRadius: "10px",
                        backgroundColor: "#fffaf5",
                        border: "1px solid #6D2323",
                        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
                    }}
                >
                    {/* Icon */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#600000",
                            borderRadius: "8px",
                            width: 50,
                            height: 50,
                            flexShrink: 0,
                        }}
                    >
                        <ErrorIcon sx={{ color: "white", fontSize: 36 }} />
                    </Box>

                    {/* Text */}
                    <Typography
                        sx={{
                            fontSize: "18px",
                            fontFamily: "Poppins, sans-serif",
                            color: "#3e3e3e",
                            lineHeight: 1.6,
                        }}
                    >
                        <strong style={{ color: "#600000" }}>Notice:</strong> Students are required to submit all{" "}
                        <strong>Main Requirements (required documents)</strong> to complete their enrollment records.
                        <strong> Optional documents</strong> are not required but may be uploaded if available.

                        Only files in <strong>JPG, JPEG, PNG, or PDF</strong> format are allowed for upload.
                        Please ensure that the file you are submitting does not exceed the
                        <strong> maximum file size of 4 MB</strong>. Any file that exceeds the allowed size
                        limit or is not in the required format will not be accepted by the system.

                        <br />
                        <br />

                        To avoid delays in the processing of your records, kindly review and verify the file’s
                        format and size before uploading. Please also ensure that all submitted documents are
                        clear and legible. Thank you for your cooperation.
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ px: 2, marginLeft: "-10px" }}>
                {Object.entries(
                    requirements.reduce((acc, r) => {
                        const cat = r.category || "Main";
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(r);
                        return acc;
                    }, {}),
                ).map(([category, docs]) => (
                    <Box key={category} sx={{ mt: 4 }}>
                        <Container>
                            <h1
                                style={{
                                    fontSize: "45px",
                                    fontWeight: "bold",
                                    textAlign: "center",
                                    color: subtitleColor,
                                    marginTop: "25px",
                                }}
                            >
                                {category === "Medical"
                                    ? "MEDICAL REQUIREMENTS"
                                    : category === "Others"
                                        ? "OTHER REQUIREMENTS"
                                        : "MAIN REQUIREMENTS"}
                            </h1>

                            {/* 📝 Show message only below MAIN DOCUMENTS title */}
                            {category !== "Medical" && category !== "Others" && (
                                <div
                                    style={{
                                        textAlign: "center",
                                        fontSize: "18px",
                                        marginTop: "10px",
                                        marginBottom: "30px",
                                        color: "#333",
                                    }}
                                >
                                    <div style={{ textAlign: "center" }}>
                                        Complete the student form to secure your place for the
                                        upcoming academic year at{" "}
                                        {shortTerm ? (
                                            <>
                                                <strong>{shortTerm.toUpperCase()}</strong> <br />
                                                {companyName || ""}
                                            </>
                                        ) : (
                                            companyName || ""
                                        )}
                                        .
                                    </div>
                                </div>
                            )}
                        </Container>

                        <TableContainer
                            component={Paper}
                            sx={{ width: "95%", mt: 2, border: `1px solid ${borderColor}` }}
                        >
                            <Table>
                                <TableHead
                                    sx={{
                                        backgroundColor: settings?.header_color || "#1976d2",
                                        border: `1px solid ${borderColor}`,
                                    }}
                                >
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                color: "white",
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            Document
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                color: "white",
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            Upload
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                color: "white",
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            Remarks
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                color: "white",
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            Preview
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                color: "white",
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            Delete
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {docs.map((doc) =>
                                        renderRow({
                                            id: doc.id,
                                            description: doc.description,
                                            is_required: doc.is_required,
                                            is_optional: doc.is_optional,
                                            upload_id: doc.upload_id,
                                            original_name: doc.original_name,
                                            file_path: doc.file_path,
                                            status: doc.status,
                                            remarks: doc.remarks,
                                        }),
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default StudentOnlineRequirements;
