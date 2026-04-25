import React, { useState, useEffect, useContext, useRef } from "react";
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Container.css';
import Logo from '../assets/Logo.png';
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
  FormControlLabel
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

const Register = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [openReminder, setOpenReminder] = useState(true);

  useEffect(() => {
    if (settings) {
      if (settings.title_color) setTitleColor(settings.title_color);
      if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
      if (settings.border_color) setBorderColor(settings.border_color);
      if (settings.main_button_color) setMainButtonColor(settings.main_button_color);

    }
  }, [settings]);

  // const [capVal, setCapVal] = useState(null);
  const [usersData, setUserData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [resendTimer, setResendTimer] = useState(180);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const navigate = useNavigate();

  const handleChanges = (e) => {
    const { name, value } = e.target;
    setUserData(prevState => ({ ...prevState, [name]: value }));
  };

  const [agreeChecked, setAgreeChecked] = useState(false); // Terms checkbox
  const [reminderChecked, setReminderChecked] = useState(false); // Dialog checkbox

  const [currentYear, setCurrentYear] = useState("");

  useEffect(() => {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    setCurrentYear(new Date(now).getFullYear());
  }, []);

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnack(prev => ({ ...prev, open: false }));
  };

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthday, setBirthday] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [academicProgram, setAcademicProgram] = useState("");
  const [applyingAs, setApplyingAs] = useState("");

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/branches`)
      .then(res => setBranches(res.data))
      .catch(err => console.error(err));
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
  };

  const isDisabled = !registrationOpen;


  useEffect(() => {
    if (!branchId) return;

    const fetchRegistrationStatus = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/registration-status/${branchId}`
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




  const selectedBranch = branches.find(
    (b) => b.id.toString() === branchId
  );

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


  {/* Unified Dialog Style */ }
  const dialogStyles = {
    title: { textAlign: "center", fontWeight: "bold", fontSize: "18px" },
    contentText: { fontSize: "16px", textAlign: "justify", mt: 1 },
    contentTextCenter: { fontSize: "16px", textAlign: "center", mt: 2, },
    actions: { justifyContent: "center", pb: 2 },
    button: { fontWeight: "bold", textTransform: "none", minWidth: "220px" }
  };

  // ✅ Use background from settings or fallback image
  const backgroundImage = settings?.bg_image
    ? `url(${API_BASE_URL}${settings.bg_image})`
    : "url(/default-bg.jpg)";


  if (redirectLoading) {
    return <RedirectLoading message="Account created! Redirecting to login..." />;
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
            style={{ border: "5px solid black", marginLeft: -100, marginTop: "-50px" }}
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
                <strong style={{
                  color: "white",
                }}>{(settings?.company_name || "Company Name")
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
                <label>Campus</label>
                <select
                  value={branchId}
                  onChange={handleBranchSelect}
                  className="border"
                  required
                  style={{
                    height: "45px",
                    border: errors.campus ? "2px solid red" : "2px solid black",
                    width: "100%",
                    appearance: "none",   // 👈 remove default arrow
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

              <div className="TextField" style={{ position: "relative" }}>
                <label>Last Name</label>
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
                  }}
                />
                <BadgeIcon
                  style={{
                    position: "absolute",
                    top: "2.5rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)",
                  }}
                />
                {errors.lastName && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label>First Name</label>
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
                  }}
                />
                <PersonIcon
                  style={{
                    position: "absolute",
                    top: "2.5rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)",
                  }}
                />
                {errors.firstName && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label>Middle Name (Full – e.g., De la Cruz) (Optional)</label>
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
                  }}
                />
                <PersonIcon
                  style={{
                    position: "absolute",
                    top: "2.5rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)",
                  }}
                />
              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label>Birth of Date</label>
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
                  }}
                />
                <CakeIcon
                  style={{
                    position: "absolute",
                    top: "2.5rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)",
                  }}
                />
                {errors.birthday && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
              </div>



              <div className="TextField" style={{ position: "relative" }}>
                <label>Academic Program</label>
                <select
                  required
                  value={academicProgram}
                  disabled={fieldDisabled}
                  onChange={(e) => setAcademicProgram(e.target.value)}
                  className="border"
                  style={{
                    paddingLeft: "1rem",
                    height: "45px",
                    border: errors.academicProgram ? "2px solid red" : "2px solid black",
                    width: "100%",
                    appearance: "none",   // 👈 remove default arrow
                    WebkitAppearance: "none",
                    MozAppearance: "none",
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
                    right: "10px", // 👈 like margin-right
                    top: getIconTop(errors.academicProgram),
                    transform: "translateY(-50%)",
                    fontSize: "30px", // 👈 BIGGER icon
                    color: "black",
                    pointerEvents: "none", // 👈 allow clicking select
                  }}
                />


              </div>


              <div className="TextField" style={{ position: "relative" }}>
                <label>Applying As</label>
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
                  }}

                  className="border"
                  style={{
                    paddingLeft: "1rem",
                    height: "45px",
                    border: errors.academicProgram ? "2px solid red" : "2px solid black",
                    width: "100%",
                    appearance: "none",   // 👈 remove default arrow
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                >
                  <option value="">Select Applying</option>

                  {(() => {
                    const selectedProgram = selectedBranch?.academicPrograms?.find(
                      (prog) => prog.id.toString() === academicProgram
                    );

                    if (!selectedProgram) return null;

                    const name = selectedProgram.name.toLowerCase();

                    if (name.includes("undergraduate")) {
                      return (
                        <>

                          <option value="1">Senior High School Graduate</option>
                          <option value="2">Senior High School Graduating Student</option>
                          <option value="3">ALS (Alternative Learning System) Passer</option>
                          <option value="4">Transferee from other University/College</option>
                          <option value="5">Cross Enrolee Student</option>
                          <option value="6">Foreign Applicant/Student</option>
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
                    right: "10px", // 👈 like margin-right
                    top: getIconTop(errors.applyingAs), // ✅ dynamic
                    transform: "translateY(-50%)",
                    fontSize: "30px", // 👈 BIGGER icon
                    color: "black",
                    pointerEvents: "none", // 👈 allow clicking select
                  }}
                />


              </div>



              <div className="TextField" style={{ position: "relative" }}>
                <label htmlFor="email">Email Address</label>
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
                  style={{ paddingLeft: "2.5rem", border: errors.email ? "2px solid red" : "2px solid black", }}
                />
                <EmailIcon
                  style={{
                    position: "absolute",
                    top: "2.5rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)"
                  }}
                />
                {errors.email && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
                <span style={{ fontSize: "14px", color: "red", mt: 2}}>
                  Note: Each email can only be used once. Use a valid and unused Gmail account.
                </span>
              </div>


              <div className="TextField" style={{ position: "relative" }}>
                <label htmlFor="password">Password</label>
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
                  style={{ paddingLeft: "2.5rem", border: errors.confirmPassword ? "2px solid red" : "2px solid black", }}
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
                    color: "rgba(0,0,0,0.3)",
                    outline: "none",
                    position: "absolute",
                    top: "2.5rem",
                    right: "1rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  {showPassword ? (
                    <Visibility sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                  ) : (
                    <VisibilityOff sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                  )}

                </button>
                {errors.password && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
              </div>

              <div className="TextField" style={{ position: "relative", }}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="border"
                  id="confirmPassword"
                  name="confirmPassword"

                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDownRegister}
                  required
                  disabled={!usersData.password} // ✅ Disabled until password is filled
                  style={{
                    paddingLeft: "2.5rem",
                    border: errors.confirmPassword ? "2px solid red" : "2px solid black",
                    backgroundColor: !usersData.password ? "#f0f0f0" : "white", // Optional: gray background when disabled
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
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    color: "rgba(0,0,0,0.3)",
                    outline: "none",
                    position: "absolute",
                    top: "2.5rem",
                    right: "1rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  {showPassword ? (
                    <Visibility sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                  ) : (
                    <VisibilityOff sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                  )}

                </button>
                {errors.password && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    This field is required
                  </span>
                )}
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
                      In order to proceed to the online application, please indicate by checking the box that you have read and agreed to EARIST requirements.
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
                      message: "Registration is currently closed for this campus.",
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
                  opacity:
                    registrationOpen && branchSelected
                      ? 1
                      : 0.5,

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
                  ? "Registration Closed"
                  : isSubmitting
                    ? "Registering..."
                    : "Register"}
              </div>


              <div className="LinkContainer RegistrationLink" style={{ margin: '0.1rem 0rem' }}>
                <p>Already Have an Account?</p>
                <span><Link to={'/login_applicant'}>Sign In here</Link></span>
              </div>
            </div>

            <div className="Footer">
              <div className="FooterText">
                &copy; {currentYear} {settings?.company_name || "EARIST"} <br />
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
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} onClose={handleClose} sx={{ width: '100%' }}>
            {snack.message}
          </Alert>
        </Snackbar>



        {/* Important Reminder Dialog */}
        <Dialog
          open={openReminder}
          onClose={() => setOpenReminder(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={dialogStyles.title}>
            ⚠️ Important Reminder for Applicants
          </DialogTitle>

          <DialogContent>
            <Typography sx={dialogStyles.contentText}>
              Please make sure that all information you provide in your application is correct and complete before submitting.
            </Typography>

            <Typography sx={{ ...dialogStyles.contentText, mt: 2 }}>
              Creating multiple accounts or submitting more than one application is strictly not allowed. Each applicant should only register and apply once.
            </Typography>

            <Typography sx={{ ...dialogStyles.contentText, mt: 2 }}>
              If multiple accounts or duplicate applications are detected, your application may be rejected or automatically disqualified from the admission process.
            </Typography>

            <Typography sx={{ ...dialogStyles.contentText, mt: 2 }}>
              Please wait for the official announcement regarding the results of the application screening.
            </Typography>

            <Typography sx={dialogStyles.contentTextCenter}>
              Thank you for your cooperation.
            </Typography>

            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreeChecked}
                    onChange={(e) => setAgreeChecked(e.target.checked)}
                  />
                }
                label={<Typography sx={{ fontSize: "15px" }}>I understand and agree to submit only one application.</Typography>}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={dialogStyles.actions}>
            <Button
              variant="contained"
              disabled={!agreeChecked}
              onClick={() => setOpenReminder(false)}
              sx={dialogStyles.button}
            >
              I Agree & Continue
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
              Registration is currently closed. Please wait for the official announcement.
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
        >
          <DialogTitle sx={dialogStyles.title}>
            📢 Admissions Currently Closed
          </DialogTitle>

          <DialogContent>
            <Typography sx={dialogStyles.contentText}>
              We sincerely apologize that during this time, this campus is not currently accepting applications.
              Registration is only available during the officially designated hours, and any submissions outside this period cannot be processed.
            </Typography>

            <Typography sx={{ ...dialogStyles.contentText, mt: 2 }}>
              Kindly return during the authorized registration hours to complete your application.
              We highly encourage reviewing the official schedule to ensure timely submission.
            </Typography>

            {selectedBranch?.start_date && selectedBranch?.end_date && (
              <Box sx={{ textAlign: "center", mt: 2.5, p: 2, background: "#f8fafc", borderRadius: "12px", border: "1.5px solid #e2e8f0" }}>
                <Typography sx={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, mb: 0.5 }}>
                  Registration Hours
                </Typography>
                <Typography sx={{ fontSize: "28px", fontWeight: 700, color: "#1a1a2e", fontFamily: "'DM Sans', sans-serif" }}>
                  {new Date(selectedBranch.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}
                  {" – "}
                  {new Date(selectedBranch.end_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}
                </Typography>
              </Box>
            )}

            <Typography sx={dialogStyles.contentTextCenter}>
              We sincerely appreciate your patience and understanding.
            </Typography>
          </DialogContent>


          <DialogActions sx={dialogStyles.actions}>
            <Button
              variant="contained"
              onClick={() => setOpenBranchDialog(false)}
              sx={dialogStyles.button}
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