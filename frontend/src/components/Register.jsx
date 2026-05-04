import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Container.css";
import Logo from "../assets/Logo.png";
import {
  Container,
  Box,
  Snackbar,
  Alert,
  TextField,
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem
} from "@mui/material";
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Badge as BadgeIcon,
  Cake as CakeIcon,
} from "@mui/icons-material";
// import ReCAPTCHA from "react-google-recaptcha";
import { SettingsContext } from "../App"; // ✅ Access settings from context
import API_BASE_URL from "../apiConfig";
import AnnouncementSlider from "../components/AnnouncementSlider";
import RedirectLoading from "../components/RedirectLoading";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import CampaignIcon from "@mui/icons-material/Campaign";

const Register = () => {
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
  const [openReminder, setOpenReminder] = useState(true);

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

  const getBranchLabel = (branchId) => {
    const branch = branches.find((item) => String(item.id) === String(branchId));
    return branch?.branch || "—";
  };

  // const [capVal, setCapVal] = useState(null);
  const [usersData, setUserData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [resendTimer, setResendTimer] = useState(180);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const navigate = useNavigate();

  const handleChanges = (e) => {
    const { name, value } = e.target;
    setUserData((prevState) => ({ ...prevState, [name]: value }));
  };

  const [agreeChecked, setAgreeChecked] = useState(false); // Terms checkbox
  const [reminderChecked, setReminderChecked] = useState(false); // Dialog checkbox

  const [currentYear, setCurrentYear] = useState("");

  useEffect(() => {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    setCurrentYear(new Date(now).getFullYear());
  }, []);

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthday, setBirthday] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [academicProgram, setAcademicProgram] = useState("");
  const [applyingAs, setApplyingAs] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [curriculumOptions, setCurriculumOptions] = useState([]);

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/branches`)
      .then((res) => setBranches(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/applied_program`)
      .then((res) => setCurriculumOptions(res.data))
      .catch((err) => console.error("Error fetching curriculum options:", err));
  }, []);

  const handleOtpChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }

    if (e.key === "Enter" && !loadingOtp) {
      verifyOtp();
    }
  };

  const [errors, setErrors] = useState({});

  const handleRegister = async () => {
    if (isSubmitting) return;
    if (!reminderChecked) {
      setSnack({
        open: true,
        message:
          "You must agree to the Terms and Conditions before registering.",
        severity: "warning",
      });
      return;
    }

    if (!isFormValid()) {
      setSnack({
        open: true,
        message: "Please fill up all required fields!",
        severity: "warning",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!branchId || !registrationOpen) {
      setSnack({
        open: true,
        message: "Registration is closed for this campus.",
        severity: "error",
      });
      return;
    }

    if (!emailRegex.test(usersData.email)) {
      setSnack({
        open: true,
        message: "Please enter a valid email address!",
        severity: "error",
      });
      return;
    }

    if (usersData.password !== confirmPassword) {
      setSnack({
        open: true,
        message: "Passwords do not match!",
        severity: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await axios.post(`${API_BASE_URL}/auth/request-otp`, {
        email: usersData.email,
      });

      setTempEmail(usersData.email);
      setOtp(["", "", "", "", "", ""]);
      setShowOtpModal(true);
      startResendTimer();

      setSnack({
        open: true,
        message: "OTP sent to your email",
        severity: "success",
      });
    } catch (error) {
      setSnack({
        open: true,
        message: error.response?.data?.message || "Failed to send OTP",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const [programAvailability, setProgramAvailability] = useState([]);
  const [activeYearId, setActiveYearId] = useState(null);
  const [activeSemesterId, setActiveSemesterId] = useState(null);

  useEffect(() => {
    const fetchActiveYearAndAvailability = async () => {
      const yearRes = await axios.get(`${API_BASE_URL}/active_school_year`);
      const activeYear = yearRes.data[0];
      console.log(activeYear);

      if (activeYear) {
        setActiveYearId(activeYear.year_id);
        setActiveSemesterId(activeYear.semester_id);

        const availRes = await axios.get(
          `${API_BASE_URL}/api/programs/availability`,
          {
            params: {
              year_id: activeYear.year_id,
              semester_id: activeYear.semester_id,
            },
          }
        );

        setProgramAvailability(availRes.data);
        console.log("Program Availability:", availRes.data);
      }
    };

    fetchActiveYearAndAvailability();
  }, []);

  const availabilityMap = React.useMemo(() => {
    const map = {};
    programAvailability.forEach((p) => {
      map[p.curriculum_id] = {
        remaining: Number(p.remaining),
        isFull: Number(p.remaining) <= 0,
      };
    });
    return map;
  }, [programAvailability]);

  useEffect(() => {
    if (!selectedCurriculum) return;

    const availability = availabilityMap[selectedCurriculum];
    const isFull = availability?.isFull;

    if (isFull) {
      setSelectedCurriculum("");

      setSnack({
        open: true,
        message: "Selected course is now FULL. Please choose another.",
        severity: "warning",
      });
    }
  }, [availabilityMap]);

  const isFormValid = () => {
    let newErrors = {};
    let isValid = true;

    if (!branchId) {
      newErrors.campus = true;
      isValid = false;
    }

    if (!lastName) {
      newErrors.lastName = true;
      isValid = false;
    }

    if (!firstName) {
      newErrors.firstName = true;
      isValid = false;
    }

    if (!birthday) {
      newErrors.birthday = true;
      isValid = false;
    }

    if (!academicProgram) {
      newErrors.academicProgram = true;
      isValid = false;
    }

    if (!applyingAs) {
      newErrors.applyingAs = true;
      isValid = false;
    }

    if (!selectedCurriculum) {
      newErrors.selectedCurriculum = true;
      isValid = false;
    }

    if (!usersData.email) {
      newErrors.email = true;
      isValid = false;
    }

    if (!usersData.password) {
      newErrors.password = true;
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = true;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const getIconTop = (hasError) => {
    return hasError ? "55%" : "70%";
  };

  const startResendTimer = () => {
    setResendTimer(60);

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resendOtp = async () => {
    try {
      setLoadingOtp(true);

      await axios.post(`${API_BASE_URL}/auth/request-otp`, {
        email: tempEmail,
      });

      startResendTimer();
      setSnack({ open: true, message: "OTP resent!", severity: "success" });
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || "Failed to resend OTP",
        severity: "error",
      });
    }

    setLoadingOtp(false);
  };

  const [redirectLoading, setRedirectLoading] = useState(false);

  const verifyOtp = async () => {
    const otpValue = otp.join("");

    if (!/^\d{6}$/.test(otpValue)) {
      setSnack({
        open: true,
        message: "Enter complete 6-digit OTP",
        severity: "error",
      });
      return;
    }

    setLoadingOtp(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        ...usersData,
        campus: branchId,
        lastName,
        firstName,
        middleName,
        birthday,
        academicProgram,
        applyingAs,
        program: selectedCurriculum,
        otp: otpValue,
      });

      if (!response.data.success) {
        setSnack({
          open: true,
          message: response.data.message,
          severity: "error",
        });
        return;
      }

      setShowOtpModal(false);
      setRedirectLoading(true);

      setTimeout(() => {
        navigate("/login_applicant");
      }, 3000);
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || "Something went wrong.",
        severity: "error",
      });
    } finally {
      setLoadingOtp(false);
    }
  };

  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [openClosedDialog, setOpenClosedDialog] = useState(false);

  const [openBranchDialog, setOpenBranchDialog] = useState(false);

  const handleBranchSelect = (e) => {
    const selectedId = e.target.value;
    setBranchId(selectedId);
    setAcademicProgram("");
    setApplyingAs("");
    setSelectedCurriculum("");
  };

  const isDisabled = !registrationOpen;

  useEffect(() => {
    if (!branchId) return;

    const fetchRegistrationStatus = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/registration-status/${branchId}`,
        );

        const isOpen = res.data.registration_open === 1;

        setRegistrationOpen(isOpen);

        if (!isOpen) {
          setOpenBranchDialog(true); // ✅ THIS is your "closed" indicator
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchRegistrationStatus();
  }, [branchId]);

  const branchSelected = !!branchId;

  const fieldDisabled = !branchSelected || !registrationOpen;

  const selectedBranch = branches.find((b) => b.id.toString() === branchId);

  const filteredCurriculum = curriculumOptions.filter((item) => {
    if (branchId && Number(item.components) !== Number(branchId)) {
      return false;
    }

    if (
      academicProgram &&
      Number(item.academic_program) !== Number(academicProgram)
    ) {
      return false;
    }

    return true;
  });

  const handleKeyDownRegister = (e) => {
    if (e.key === "Enter" && !isSubmitting) {
      if (!branchId) {
        setSnack({
          open: true,
          message: "Please select a branch!",
          severity: "warning",
        });
        return;
      }

      if (!registrationOpen) {
        setSnack({
          open: true,
          message: "Registration is closed for this campus.",
          severity: "error",
        });
        return;
      }
      handleRegister();
    }
  };

  const handleKeyDownOtp = (e) => {
    if (e.key === "Enter" && !loadingOtp) {
      verifyOtp();
    }
  };

  const [branchStatusMessage, setBranchStatusMessage] = useState("");

  {
    /* Unified Dialog Style */
  }
  const dialogStyles = {
    title: { textAlign: "center", fontWeight: "bold", fontSize: "18px" },
    contentText: { fontSize: "16px", textAlign: "justify", mt: 1 },
    contentTextCenter: { fontSize: "16px", textAlign: "center", mt: 2 },
    actions: { justifyContent: "center", pb: 2 },
    button: { fontWeight: "bold", textTransform: "none", minWidth: "220px" },
  };

  // ✅ Use background from settings or fallback image
  const backgroundImage = settings?.bg_image
    ? `url(${API_BASE_URL}${settings.bg_image})`
    : "url(/default-bg.jpg)";

  if (redirectLoading) {
    return (
      <RedirectLoading message="Account created! Redirecting to login..." />
    );
  }
  return (
    <>
      <Box
        sx={{
          backgroundImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Container
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          maxWidth={false}
        >
          <AnnouncementSlider style={{ marginTop: "-350px" }} />
          <div
            style={{
              border: "5px solid black",
              marginLeft: -100,
              marginTop: "-50px",
            }}
            className="Container"
          >
            <div
              className="Header"
              style={{
                backgroundColor: settings?.header_color || "#1976d2", // ✅ default blue
                padding: "1rem 0",
                borderBottom: "3px solid black",
              }}
            >
              <div className="HeaderTitle">
                <div className="CircleCon">
                  <img
                    src={
                      settings?.logo_url
                        ? `${API_BASE_URL}${settings.logo_url}`
                        : Logo
                    }
                    alt="Logo"
                  />
                </div>
              </div>
              <div className="HeaderBody">
                <strong
                  style={{
                    color: "white",
                  }}
                >
                  {(settings?.company_name || "Company Name")
                    .split(" ")
                    .reduce((acc, word, index) => {
                      if (index % 4 === 0 && index !== 0) {
                        acc.push(<br key={`br-${index}`} />);
                      }
                      acc.push(word + " ");
                      return acc;
                    }, [])}
                </strong>
                <p>Student Information System</p>
              </div>
            </div>

            <div className="Body">
              <div className="TextField">
                <label style={{ color: "black" }}>Campus<span style={{ color: "red" }}> *</span></label>
                <select
                  value={branchId}
                  onChange={handleBranchSelect}
                  className="border"
                  required
                  style={{
                    height: "45px",
                    border: errors.campus ? "2px solid red" : "2px solid black",
                    width: "100%",
                    appearance: "none", // 👈 remove default arrow
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                >
                  <option value="">Select Campus</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch}
                    </option>
                  ))}
                </select>
                <ArrowDropDownIcon
                  sx={{
                    position: "absolute",
                    right: "10px", // 👈 like margin-right
                    top: "70%",
                    transform: "translateY(-50%)",
                    fontSize: "30px", // 👈 BIGGER icon
                    color: "black",
                    pointerEvents: "none", // 👈 allow clicking select
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />

                <span style={{ margin: "0 1rem", fontWeight: "600", color: "#555" }}>
                  Personal Informations
                </span>

                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>


              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                {/* Last Name */}
                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>
                    Last Name<span style={{ color: "red" }}> *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your last name"
                    required
                    disabled={fieldDisabled}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDownRegister}
                    className="border"
                    style={{
                      paddingLeft: "2.5rem",
                      border: errors.lastName ? "2px solid red" : "2px solid black",
                      width: "100%",
                    }}
                  />
                  <BadgeIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem" }} />
                  {errors.lastName && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      This field is required
                    </span>
                  )}
                </div>

                {/* First Name */}
                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>
                    First Name<span style={{ color: "red" }}> *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your first name"
                    value={firstName}
                    disabled={fieldDisabled}
                    onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDownRegister}
                    className="border"
                    style={{
                      paddingLeft: "2.5rem",
                      border: errors.firstName ? "2px solid red" : "2px solid black",
                      width: "100%",
                    }}
                  />
                  <PersonIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem" }} />
                  {errors.firstName && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      This field is required
                    </span>
                  )}
                </div>

                {/* Middle Name */}
                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>
                    Middle Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your middle name"
                    value={middleName}
                    disabled={fieldDisabled}
                    onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDownRegister}
                    className="border"
                    style={{
                      paddingLeft: "2.5rem",
                      border: "2px solid black",
                      width: "100%",
                    }}
                  />
                  <PersonIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem" }} />
                </div>

                {/* Birthday */}
                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>
                    Birth Date<span style={{ color: "red" }}> *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={birthday}
                    disabled={fieldDisabled}
                    onChange={(e) => setBirthday(e.target.value)}
                    onKeyDown={handleKeyDownRegister}
                    className="border"
                    style={{
                      paddingLeft: "2.5rem",
                      border: errors.birthday ? "2px solid red" : "2px solid black",
                      width: "100%",
                    }}
                  />
                  <CakeIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem" }} />
                  {errors.birthday && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      This field is required
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />

                <span style={{ margin: "0 1rem", fontWeight: "600", color: "#555" }}>
                  Academic Information
                </span>

                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>


              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>

                {/* Academic Program */}
                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>
                    Academic Program<span style={{ color: "red" }}> *</span>
                  </label>

                  <select
                    required
                    value={academicProgram}
                    disabled={fieldDisabled}
                    onChange={(e) => {
                      setAcademicProgram(e.target.value);
                      setApplyingAs("");
                      setSelectedCurriculum("");
                    }}
                    className="border"
                    style={{
                      paddingLeft: "1rem",
                      height: "45px",
                      border: errors.academicProgram
                        ? "2px solid red"
                        : "2px solid black",
                      width: "100%",
                      appearance: "none",
                    }}
                  >
                    <option value="">Select Program</option>
                    {selectedBranch?.academicPrograms
                      ?.filter((prog) => prog.open === 1)
                      .map((prog) => (
                        <option key={prog.id} value={prog.id}>
                          {prog.name}
                        </option>
                      ))}
                  </select>

                  {errors.academicProgram && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      This field is required
                    </span>
                  )}

                  <ArrowDropDownIcon
                    sx={{
                      position: "absolute",
                      right: "10px",
                      top: getIconTop(errors.academicProgram),
                      transform: "translateY(-50%)",
                      fontSize: "30px",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                {/* Applying As */}
                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>
                    Applying As<span style={{ color: "red" }}> *</span>
                  </label>

                  <select
                    required
                    value={applyingAs}
                    disabled={fieldDisabled}
                    onChange={(e) => {
                      if (!academicProgram) {
                        setSnack({
                          open: true,
                          message: "Please select Academic Program first.",
                          severity: "warning",
                        });
                        return;
                      }

                      setApplyingAs(e.target.value);
                      setSelectedCurriculum("");
                    }}
                    className="border"
                    style={{
                      paddingLeft: "1rem",
                      height: "45px",
                      border: errors.applyingAs
                        ? "2px solid red"
                        : "2px solid black",
                      width: "100%",
                      appearance: "none",
                    }}
                  >
                    <option value="">Select Applying</option>

                    {(() => {
                      const selectedProgram =
                        selectedBranch?.academicPrograms?.find(
                          (prog) => prog.id.toString() === academicProgram,
                        );

                      if (!selectedProgram) return null;

                      const name = selectedProgram.name.toLowerCase();

                      if (name.includes("undergraduate")) {
                        return (
                          <>
                            <option value="1">Senior High School Graduate</option>
                            <option value="2">Senior High School Graduating Student</option>
                            <option value="3">ALS Passer</option>
                            <option value="4">Transferee</option>
                            <option value="5">Cross Enrollee</option>
                            <option value="6">Foreign Applicant</option>
                          </>
                        );
                      }

                      if (
                        name.includes("graduate") ||
                        name.includes("master") ||
                        name.includes("baccalaureate")
                      ) {
                        return (
                          <>
                            <option value="7">Baccalaureate Graduate</option>
                            <option value="8">Master Degree Graduate</option>
                          </>
                        );
                      }

                      return null;
                    })()}
                  </select>

                  {errors.applyingAs && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      This field is required
                    </span>
                  )}

                  <ArrowDropDownIcon
                    sx={{
                      position: "absolute",
                      right: "10px",
                      top: getIconTop(errors.applyingAs),
                      transform: "translateY(-50%)",
                      fontSize: "30px",
                      pointerEvents: "none",
                    }}
                  />
                </div>

              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label style={{ color: "black" }}>Course Applied<span style={{ color: "red" }}> *</span></label>
                <select
                  required
                  value={selectedCurriculum}
                  disabled={fieldDisabled || !academicProgram}
                  onChange={(e) => {
                    const value = e.target.value;

                    const selected = filteredCurriculum.find(
                      (c) => String(c.curriculum_id) === String(value)
                    );

                    const availability = availabilityMap[selected?.curriculum_id];
                    const isFull = availability?.isFull;

                    if (isFull) {
                      setSnack({
                        open: true,
                        message: "This course is already FULL.",
                        severity: "error",
                      });
                      return;
                    }

                    setSelectedCurriculum(value);
                  }}
                  className="border"
                  style={{
                    paddingLeft: "1rem",
                    height: "45px",
                    border: errors.selectedCurriculum
                      ? "2px solid red"
                      : "2px solid black",
                    width: "100%",
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                >
                  <option value="">Select Curriculum / Course</option>

                  {filteredCurriculum.map((item, index) => {
                    const availability = availabilityMap[item.curriculum_id];
                    const remaining = availability?.remaining ?? 0;
                    const isFull = availability?.isFull;

                    return (
                      <option
                        key={index}
                        value={item.curriculum_id}
                        disabled={isFull}
                        style={{
                          color: isFull ? "red" : "green",
                          fontWeight: isFull ? "normal" : "normal",
                        }}
                      >
                        {`(${item.program_code}): ${item.program_description}${item.major ? ` (${item.major})` : ""
                          } (${getBranchLabel(item.components)})`}
                        {isFull
                          ? " — FULL (0 slots left)"
                          : ` — (${remaining} slots left)`}
                      </option>
                    );
                  })}
                </select>

                {errors.selectedCurriculum && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
                <ArrowDropDownIcon
                  sx={{
                    position: "absolute",
                    right: "10px",
                    top: getIconTop(errors.selectedCurriculum),
                    transform: "translateY(-50%)",
                    fontSize: "30px",
                    color: "black",
                    pointerEvents: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />

                <span style={{ margin: "0 1rem", fontWeight: "600", color: "#555" }}>
                  Account Information
                </span>

                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label style={{ color: "black" }}>Email Address<span style={{ color: "red" }}> *</span></label>
                <input
                  required
                  type="email"
                  disabled={fieldDisabled}
                  className="border"
                  id="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={usersData.email}
                  onChange={handleChanges}
                  onKeyDown={handleKeyDownRegister}
                  style={{
                    paddingLeft: "2.5rem",
                    border: errors.email ? "2px solid red" : "2px solid black",
                  }}
                />
                <EmailIcon
                  style={{
                    position: "absolute",
                    top: "2.5rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)",
                  }}
                />
                {errors.email && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
                <span style={{ fontSize: "14px", color: "red", mt: 2 }}>
                  Note: Each email can only be used once. Use a valid and unused
                  Gmail account.
                </span>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                {/* Password */}
                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>
                    Password<span style={{ color: "red" }}> *</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="border"
                    id="password"
                    disabled={fieldDisabled}
                    name="password"
                    placeholder="Enter your password"
                    value={usersData.password}
                    onChange={handleChanges}
                    onKeyDown={handleKeyDownRegister}
                    required
                    style={{
                      paddingLeft: "2.5rem",
                      border: errors.password
                        ? "2px solid red"
                        : "2px solid black",
                      width: "100%",
                    }}
                  />

                  <LockIcon
                    style={{
                      position: "absolute",
                      top: "2.5rem",
                      left: "0.7rem",
                      color: "rgba(0,0,0,0.4)",
                      fontSize: "26px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      top: "2.5rem",
                      right: "1rem",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </button>

                  {errors.password && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      This field is required
                    </span>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>
                    Confirm Password<span style={{ color: "red" }}> *</span>
                  </label>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="border"
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKeyDownRegister}
                    required
                    disabled={!usersData.password}
                    style={{
                      paddingLeft: "2.5rem",
                      border: errors.confirmPassword
                        ? "2px solid red"
                        : "2px solid black",
                      width: "100%",
                      backgroundColor: !usersData.password ? "#f0f0f0" : "white",
                      cursor: !usersData.password ? "not-allowed" : "text",
                    }}
                  />

                  <LockIcon
                    style={{
                      position: "absolute",
                      top: "2.5rem",
                      left: "0.7rem",
                      color: "rgba(0,0,0,0.4)",
                      fontSize: "26px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    style={{
                      position: "absolute",
                      top: "2.5rem",
                      right: "1rem",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {showConfirmPassword ? <Visibility /> : <VisibilityOff />}
                  </button>

                  {errors.confirmPassword && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      Passwords do not match
                    </span>
                  )}
                </div>
              </div>

              {/* CAPTCHA */}
              {/* <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <ReCAPTCHA
                  sitekey="6Lfem44rAAAAAEeAexdQxvN0Lpm1V4KPu1bBxaGy"
                  onChange={(val) => setCapVal(val)}
                />
              </Box> */}

              {/* Terms and Conditions Checkbox */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "20px",
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reminderChecked}
                      onChange={(e) => setReminderChecked(e.target.checked)}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: "14px" }}>
                      I have read and agree to the admission requirements and policies of {settings?.company_name || ""}
                      before proceeding.
                    </Typography>
                  }
                />
              </Box>

              {/* Register Button — disabled until CAPTCHA is solved */}
              <div
                onClick={() => {
                  if (!branchSelected) {
                    setSnack({
                      open: true,
                      message: "Please select a branch first!",
                      severity: "warning",
                    });
                    return;
                  }

                  if (!registrationOpen) {
                    setSnack({
                      open: true,
                      message:
                        "Registration is currently closed for this campus.",
                      severity: "error",
                    });
                    return;
                  }

                  if (!reminderChecked) {
                    setSnack({
                      open: true,
                      message:
                        "Please agree to the Terms and Conditions before registering.",
                      severity: "warning",
                    });
                    return;
                  }

                  if (!isSubmitting) {
                    handleRegister();
                  }
                }}
                style={{
                  opacity: registrationOpen && branchSelected ? 1 : 0.5,

                  cursor: "pointer",
                  marginTop: "40px",
                  backgroundColor: mainButtonColor,
                  height: "50px",
                  border: "2px solid black",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                {!registrationOpen
                  ? "REGISTRATION CLOSED"
                  : isSubmitting
                    ? "REGISTERING..."
                    : "SUBMIT APPLICATION"}
              </div>

              <div
                className="LinkContainer RegistrationLink"
                style={{ margin: "0.1rem 0rem" }}
              >
                <p>Already Have an Account?</p>
                <span>
                  <Link to={"/login_applicant"}>Sign In here</Link>
                </span>
              </div>
            </div>

            <div className="Footer">
              <div className="FooterText">
                &copy; {currentYear} {settings?.company_name || ""} <br />
                Student Information System. <br />
                All rights reserved.
              </div>
            </div>
          </div>
        </Container>

        <Modal open={showOtpModal} onClose={() => setShowOtpModal(false)}>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 440,
              bgcolor: "#fff",
              borderRadius: "20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              p: 4,
              border: "1px solid #eee",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setShowOtpModal(false)}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                backgroundColor: "black",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "34px",
                height: "34px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              ✕
            </button>

            {/* Title */}
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              Verify your email
            </h2>

            {/* Description */}
            <p
              style={{
                color: "#666",
                fontSize: "14px",
                lineHeight: 1.6,
                marginBottom: "20px",
              }}
            >
              We sent a 6-digit verification code to your registered email
              address.
            </p>

            {/* OTP */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 1.5,
                mb: 3,
              }}
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, index)}
                  onKeyDown={(e) => handleOtpKeyDown(e, index)}
                  style={{
                    width: "54px",
                    height: "60px",
                    fontSize: "24px",
                    fontWeight: 700,
                    textAlign: "center",
                    borderRadius: "14px",
                    border: "2px solid #ddd",
                    outline: "none",
                    transition: "all 0.2s ease",
                  }}
                />
              ))}
            </Box>

            {/* Helper text */}
            <p
              style={{
                fontSize: "13px",
                color: "#777",
                marginBottom: "18px",
                textAlign: "center",
              }}
            >
              This email can only be used once for admission verification.
            </p>

            {/* Verify */}
            <button
              onClick={verifyOtp}
              disabled={loadingOtp}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: mainButtonColor,
                color: "white",
                fontWeight: 700,
                fontSize: "15px",
                cursor: loadingOtp ? "not-allowed" : "pointer",
              }}
            >
              {loadingOtp ? "Verifying..." : "Verify & Continue"}
            </button>

            {/* Resend */}
            <button
              onClick={resendOtp}
              disabled={resendTimer > 0}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 600,
                color: resendTimer > 0 ? "#999" : "#333",
              }}
            >
              {resendTimer > 0
                ? `Resend code in ${resendTimer}s`
                : "Resend code"}
            </button>

            {/* Support hint */}
            <p
              style={{
                marginTop: "14px",
                fontSize: "12px",
                color: "#999",
                textAlign: "center",
              }}
            >
              Didn’t receive the code? Check your spam folder.
            </p>
          </Box>
        </Modal>

        {/* Snackbar Notification */}
        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
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

        {/* Important Reminder Dialog */}
        <Dialog
          open={openReminder}
          onClose={() => setOpenReminder(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.28)",
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              backgroundColor: "#f5f5f5",
              borderBottom: "1px solid #e0e0e0",
              py: 1.5,
              px: 2.5,
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "#f5a623",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <WarningAmberIcon sx={{ color: "#fff", fontSize: 16 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "15px", color: "#222" }}>
              Important Reminder for Applicants
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
            <Typography
              sx={{
                fontSize: "13.5px",
                color: "#333",
                lineHeight: 1.6,
                mb: 1.5,
              }}
            >
              <Box sx={{ mt: 3 }}>
                Please ensure all information is accurate and complete. Submitting{" "}
                <strong>multiple accounts or duplicate applications is strictly prohibited</strong>{" "}
                and may result in automatic disqualification.
              </Box>
            </Typography>

            <Typography
              sx={{
                fontSize: "13.5px",
                color: "#333",
                lineHeight: 1.6,
              }}
            >
              <Box sx={{ mt: 3 }}>
                Each applicant must register and submit only one application. Await the official
                announcement for screening results.
              </Box>
            </Typography>

            <Box
              component="label"
              htmlFor="agreeCheck"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                border: "1.5px solid #cc3333",
                borderRadius: "4px",
                px: 1.5,
                py: 1.25,
                mt: 3,
                mb: 0.5,
                cursor: "pointer",
                "&:hover": { backgroundColor: "#fff5f5" },
                transition: "background 0.15s",
              }}
            >
              <Checkbox
                id="agreeCheck"
                checked={agreeChecked}
                onChange={(e) => setAgreeChecked(e.target.checked)}
                sx={{
                  p: 0,
                  color: "#cc3333",
                  "&.Mui-checked": { color: "#cc3333" },
                }}
                size="small"
              />
              <Typography sx={{ fontSize: "13px", color: "#333", userSelect: "none" }}>
                I understand and agree to submit only one application.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ justifyContent: "center", px: 3, pb: 2.5, pt: 1, mt: 2 }}>
            <Button
              variant="contained"
              disabled={!agreeChecked}
              onClick={() => setOpenReminder(false)}
              sx={{
                backgroundColor: agreeChecked ? mainButtonColor : "#b0b8c8",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
                px: 4,
                py: 1.25,
                borderRadius: "4px",
                textTransform: "none",
                letterSpacing: "0.02em",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: agreeChecked ? mainButtonColor : "#b0b8c8",
                  boxShadow: "none",
                },
                "&.Mui-disabled": {
                  backgroundColor: "#b0b8c8",
                  color: "#fff",
                  opacity: 0.7,
                },
              }}
            >
              I Agree — Continue to Registration
            </Button>
          </DialogActions>
        </Dialog>

        {/* Registration Closed Dialog */}
        <Dialog open={openClosedDialog} maxWidth="sm" fullWidth>
          <DialogTitle sx={dialogStyles.title}>
            🚫 Registration Closed
          </DialogTitle>

          <DialogContent>
            <Typography sx={{ fontSize: "16px", textAlign: "center" }}>
              Registration is currently closed. Please wait for the official
              announcement.
            </Typography>
          </DialogContent>

          <DialogActions sx={dialogStyles.actions}>
            <Button
              variant="contained"
              onClick={() => navigate("/login_applicant")}
              sx={dialogStyles.button}
            >
              Go to Login
            </Button>
          </DialogActions>
        </Dialog>

        {/* Branch Admissions Closed Dialog */}
        <Dialog
          open={openBranchDialog}
          onClose={() => setOpenBranchDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.28)",
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              backgroundColor: "#f5f5f5",
              borderBottom: "1px solid #e0e0e0",
              py: 1.5,
              px: 2.5,
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "#f5a623",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CampaignIcon sx={{ color: "#fff", fontSize: 16 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "15px", color: "#222" }}>
              Admissions Currently Closed
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
            <Typography sx={{ fontSize: "13.5px", color: "#333", lineHeight: 1.6, mb: 1.5, mt: 3 }}>
              We sincerely apologize that during this time, this campus is not currently
              accepting applications. Registration is only available during the officially
              designated hours, and any submissions outside this period cannot be processed.
            </Typography>

            <Typography sx={{ fontSize: "13.5px", color: "#333", lineHeight: 1.6 }}>
              Kindly return during the authorized registration hours to complete your
              application. We highly encourage reviewing the official schedule to ensure
              timely submission.
            </Typography>

            {selectedBranch?.start_date && selectedBranch?.end_date && (
              <Box
                sx={{
                  textAlign: "center",
                  mt: 3,
                  p: 2,
                  background: "#fff9ec",
                  borderRadius: "4px",
                  border: "1.5px solid #e2e8f0",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "11px",
                    color: "red",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    mb: 0.5,
                  }}
                >
                  Registration Hours
                </Typography>
                <Typography
                  sx={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: "#1a1a2e",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {new Date(selectedBranch.start_date).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Manila",
                  })}
                  {" – "}
                  {new Date(selectedBranch.end_date).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Manila",
                  })}
                </Typography>
              </Box>
            )}

            <Typography
              sx={{
                fontSize: "13.5px",
                color: "#333",
                lineHeight: 1.6,
                textAlign: "center",
                fontStyle: "italic",
                mt: 2,
                mb: 0.5,
              }}
            >
              We sincerely appreciate your patience and understanding.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ justifyContent: "center", px: 3, pb: 2.5, pt: 1 }}>
            <Button
              variant="contained"
              onClick={() => setOpenBranchDialog(false)}
              sx={{
                backgroundColor: mainButtonColor,
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
                px: 4,
                py: 1.25,
                borderRadius: "4px",
                textTransform: "none",
                letterSpacing: "0.02em",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: mainButtonColor,
                  boxShadow: "none",
                },
              }}
            >
              Okay
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default Register;
