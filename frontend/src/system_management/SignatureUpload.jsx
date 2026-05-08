import { useState, useEffect, useContext } from "react";
import API_BASE_URL from "../apiConfig";
import {
    Box,
    Button,
    Card,
    CardContent,
    TextField,
    Typography,
    CircularProgress,
    Alert
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import { SettingsContext } from "../App";
import axios from "axios";

const SignatureUpload = () => {
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
            try {
                setBranches(JSON.parse(settings.branches));
            } catch (err) {
                console.error("Invalid branches JSON", err);
            }
        }

    }, [settings]);


    const [fullName, setFullName] = useState("");
    const [signature, setSignature] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [dbSignature, setDbSignature] = useState(null);

    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [hasAccess, setHasAccess] = useState(null);

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

    const pageId = 114;

    useEffect(() => {
        const fetchLatestSignature = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/signature`);
                const data = await res.json();

                if (data.success) {
                    setDbSignature(data.data);
                    setFullName(data.data.full_name); // auto-fill
                }
            } catch (err) {
                console.error(err);
            }
        };

        fetchLatestSignature();
    }, []);



    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!fullName || !signature) {
            setMessage("Please fill in all fields");
            return;
        }

        const formData = new FormData();
        formData.append("full_name", fullName);
        formData.append("signature", signature);
        formData.append("audit_actor_id", employeeID || localStorage.getItem("employee_id") || "");
        formData.append("audit_actor_role", userRole || localStorage.getItem("role") || "registrar");

        try {
            setLoading(true);
            setMessage("");

            const res = await fetch(`${API_BASE_URL}/api/signature`, {
                method: "POST",
                headers: {
                    "x-employee-id": employeeID || localStorage.getItem("employee_id") || "",
                    "x-page-id": pageId,
                    "x-audit-actor-id": employeeID || localStorage.getItem("employee_id") || "",
                    "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
                },
                body: formData
            });

            const data = await res.json();
            console.log("API RESPONSE:", data);

            if (data.success) {
                setMessage("Signature uploaded successfully");
                setDbSignature(data.data);
            }
        } catch (err) {
            setMessage("Server error");
        } finally {
            setLoading(false);
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

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',

                    mb: 2,

                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 'bold',
                        color: titleColor,
                        fontSize: '36px',
                    }}
                >
                    NAME AND DESIGNATION SIGNATURE
                </Typography>


            </Box>


            <hr style={{ border: "1px solid #ccc", width: "100%" }} />
            <br />

            <Box
                sx={{
                    maxWidth: 600,
                    mx: "auto",
                    mt: 4
                }}
            >
                <Card
                    sx={{
                        borderRadius: 3,
                        boxShadow: 3,
                        border: `1px solid ${borderColor}`
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Typography
                            variant="h5"
                            sx={{ fontWeight: "bold", mb: 1, color: titleColor }}
                        >
                            Upload Signature
                        </Typography>

                        <Typography
                            variant="body2"
                            sx={{ mb: 3, color: subtitleColor }}
                        >
                            Upload your official signature to be used in documents.
                        </Typography>

                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            display="flex"
                            flexDirection="column"
                            gap={3}
                        >
                            <TextField
                                label="Full Name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                fullWidth
                            />

                            {/* Upload Box */}
                            <Box
                                sx={{
                                    border: `2px dashed ${borderColor}`,
                                    borderRadius: 2,
                                    p: 3,
                                    textAlign: "center",
                                    cursor: "pointer",
                                    transition: "0.2s",
                                    "&:hover": {
                                        backgroundColor: "#f9f9f9"
                                    }
                                }}
                                component="label"
                            >
                                <UploadFileIcon sx={{ fontSize: 40, mb: 1 }} />

                                <Typography variant="body2">
                                    {signature ? signature.name : "Click to upload signature"}
                                </Typography>

                                <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => setSignature(e.target.files[0])}
                                />
                            </Box>

                            {/* Preview */}
                            {signature && (
                                <Box
                                    component="img"
                                    src={URL.createObjectURL(signature)}
                                    alt="Preview"
                                    sx={{
                                        width: "100%",
                                        maxHeight: 150,
                                        objectFit: "contain",
                                        border: "1px solid #ddd",
                                        borderRadius: 2,
                                        p: 1
                                    }}
                                />
                            )}

                            <Button
                                type="submit"
                                variant="contained"
                                disabled={loading || !fullName || !signature}
                                sx={{
                                    backgroundColor: mainButtonColor,
                                    py: 1.5,
                                    fontWeight: "bold",
                                    borderRadius: 2
                                }}
                            >
                                {loading ? <CircularProgress size={24} /> : "Upload Signature"}
                            </Button>

                            {message && (
                                <Alert severity={message.includes("success") ? "success" : "error"}>
                                    {message}
                                </Alert>
                            )}
                        </Box>
                    </CardContent>
                </Card>

                {/* Display Saved Signature */}
                {dbSignature && (
                    <Card
                        sx={{
                            mt: 3,
                            borderRadius: 3,
                            boxShadow: 2,
                             border: `1px solid ${borderColor}`
                        }}
                    >
                        <CardContent>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Saved Signature
                            </Typography>

                            <Typography sx={{ mb: 2 }}>
                                <strong>{dbSignature.full_name}</strong>
                            </Typography>

                            <Box
                                component="img"
                                src={`${API_BASE_URL}/uploads/${dbSignature.signature_image}`}
                                alt="Signature"
                                sx={{
                                    width: "100%",
                                    maxHeight: 150,
                                    objectFit: "contain",
                                    border: "1px solid #ccc",
                                    borderRadius: 2,
                                    p: 1
                                }}
                            />
                        </CardContent>
                    </Card>
                )}
            </Box>
        </Box>
    );
};

export default SignatureUpload;
