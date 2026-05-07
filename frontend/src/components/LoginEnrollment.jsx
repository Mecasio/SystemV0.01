import React, { useState, useRef, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Modal, TextField } from "@mui/material";
import {
  Container,
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import "../styles/Container.css";
import CloseIcon from "@mui/icons-material/Close";
import Logo from "../assets/Logo.png";
import { SettingsContext } from "../App";
import LoadingOverlay from "./LoadingOverlay";
import API_BASE_URL from "../apiConfig";

function accessToSet(list = []) {
  return new Set(list.map(Number));
}

// Determine Registrar Subtype Based on Access
function getRegistrarDashboard(accessSet) {
  if (accessSet.has(101)) return "/registrar_dashboard";                 // Clinic Registrar
  if (accessSet.has(102)) return "/enrollment_officer_dashboard";     // Enrollment Registrar
  if (accessSet.has(103)) return "/admission_officer_dashboard";      // Admission Registrar
  return "/registrar_dashboard";                                      // Default Registrar
}

// Master router function (Only 3 roles)
function getUserDashboard(role, accessList = []) {
  const accessSet = accessToSet(accessList);

  if (role === "registrar") {
    return getRegistrarDashboard(accessSet);
  }
  if (role === "faculty") return "/faculty_dashboard";
  return "/student_dashboard"; // default if not registrar or faculty
}

const LoginEnrollment = ({ setIsAuthenticated }) => {
  const settings = useContext(SettingsContext);

  // // REMOVE startup loader when LoginEnrollment mounts
  // useEffect(() => {
  //   const loader = document.getElementById("startup-loader");
  //   if (loader) {
  //     loader.style.opacity = "0";
  //     loader.style.transition = "opacity 0.4s ease";
  //     setTimeout(() => loader.remove(), 400);
  //   }
  // }, []);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  useEffect(() => {
    if (settings) {
      if (settings.title_color) setTitleColor(settings.title_color);
      if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
      if (settings.border_color) setBorderColor(settings.border_color);
      if (settings.main_button_color) setMainButtonColor(settings.main_button_color);

    }
  }, [settings]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);


  const otpRefs = useRef([]);

  const handleOtpChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }

    if (e.key === "Enter") {
      verifyOtp();
    }
  };


  const [showOtpModal, setShowOtpModal] = useState(false);
  const [tempLoginData, setTempLoginData] = useState(null);
  const [resendTimer, setResendTimer] = useState(60);
  const [lockout, setLockout] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [loading3, setLoading3] = useState(false);
  const [currentYear, setCurrentYear] = useState("");
  const [loginType, setLoginType] = useState("user"); // ✅ Added for dropdown
  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  useEffect(() => {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    const year = new Date(now).getFullYear();
    setCurrentYear(year);
  }, []);

  const backgroundImage = settings?.bg_image
    ? `url(${API_BASE_URL}${settings.bg_image})`
    : "linear-gradient(to right, #f5f5f5, #fafafa)";
  const logoSrc = settings?.logo_url
    ? `${API_BASE_URL}${settings.logo_url}`
    : Logo;

  const [errors, setErrors] = useState({});

  const [applyingAs, setApplyingAs] = useState("");

  useEffect(() => {
    const storedApplyingAs = localStorage.getItem("applyingAs") || "";
    setApplyingAs(storedApplyingAs);
  }, []);

  const handleLogin = async () => {
    if (!isFormValid()) {
      setSnack({
        open: true,
        message: "Please fill in all fields",
        severity: "warning",
      });
      return;
    }
    try {
      setLoading(true);

      const apiUrl =
        loginType === "applicant"
          ? `${API_BASE_URL}/auth/login_applicant`
          : `${API_BASE_URL}/auth/login`;

      const res = await axios.post(apiUrl, {
        email,
        password,
        audit_log_db: "db3",
      });

      // 🔒 If locked, block login
      if (res.data.message?.includes("Locked")) {
        if (!lockout) {
          setLockout(true);
          setSnack({ open: true, message: res.data.message, severity: "error" });

          let timeLeft = 180;
          setLockoutTimer(timeLeft);
          const interval = setInterval(() => {
            timeLeft -= 1;
            setLockoutTimer(timeLeft);
            if (timeLeft <= 0) {
              clearInterval(interval);
              setLockout(false);
              setLockoutTimer(0);
            }
          }, 1000);
        }
        return;
      }

      if (!res.data.success) {
        setSnack({
          open: true,
          message: res.data.message,
          severity: "error",
        });
        return;
      }

      // ✔ Save temporary response (for OTP)
      setTempLoginData(res.data);

      // 📌 Applicants don't use OTP
      if (loginType === "applicant") {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("email", res.data.email);
        localStorage.setItem("role", res.data.role);
        localStorage.setItem("person_id", res.data.person_id);
        localStorage.setItem("applyingAs", res.data.applyingAs);

        setIsAuthenticated(true);
        navigate("/applicant_dashboard");
        return;
      }

      // 🔥 OPTIONAL OTP CHECK
      if (res.data.requireOtp === false) {
        // 🚫 OTP NOT REQUIRED → Login instantly
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("email", res.data.email);
        localStorage.setItem("role", res.data.role);
        localStorage.setItem("person_id", res.data.person_id);
        localStorage.setItem("department", res.data.department || "");
        localStorage.setItem("employee_id", res.data.employee_id);

        setIsAuthenticated(true);

        const dashboard = getUserDashboard(res.data.role, res.data.accessList);
        navigate(dashboard); return;

        return;
      }

      // 🔐 OTP REQUIRED → Show modal
      if (res.data.requireOtp === true) {
        setShowOtpModal(true);
        startResendTimer();

        setSnack({
          open: true,
          message: "OTP sent to your email",
          severity: "success",
        });

        return;
      }

    } catch (error) {
      const msg = error.response?.data?.message || "Login failed";
      setSnack({ open: true, message: msg, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    let newErrors = {};
    let isValid = true;

    if (!email) {
      newErrors.email = true;
      isValid = false;
    }

    if (!password) {
      newErrors.password = true;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const verifyOtp = async () => {
    try {
      setLoading3(true); // show overlay when verifying OTP

      await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        email: tempLoginData.email,
        otp: otp.join(""),
      });


      localStorage.setItem("token", tempLoginData.token);
      localStorage.setItem("email", tempLoginData.email);
      localStorage.setItem("role", tempLoginData.role);
      localStorage.setItem("person_id", tempLoginData.person_id);
      localStorage.setItem("department", tempLoginData.department || "");
      localStorage.setItem("employee_id", tempLoginData.employee_id);


      setIsAuthenticated(true);

      // ✅ Show overlay for 3 seconds before navigation
      setTimeout(() => {
        setLoading3(false);
        setShowOtpModal(false);
        const dashboard = getUserDashboard(tempLoginData.role, tempLoginData.accessList);
        navigate(dashboard);
      }, 2000);
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || "Invalid OTP",
        severity: "error",
      });
      setLoading3(false); // immediately hide overlay on error
    }
  };

  const startResendTimer = () => {
    setResendTimer(300);
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
      setLoading2(true)
      await axios.post(`${API_BASE_URL}/auth/request-otp`, {
        email: tempLoginData.email,
      });
      setSnack({
        open: true,
        message: "OTP resent to your email",
        severity: "success",
      });
      startResendTimer();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || "Failed to resend OTP",
        severity: "error",
      });
      setLoading2(false);
    }
  };

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    if (showOtpModal) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100); // small delay ensures focus after modal is mounted
    }
  }, [showOtpModal]);

  const [openLoginReminder, setOpenLoginReminder] = useState(true);
  const [openLoginClosed, setOpenLoginClosed] = useState(false);

  const dialogStyles = {
    title: {
      textAlign: "center",
      fontWeight: "bold",
      fontSize: "18px"
    },
    contentText: {
      fontSize: "16px",
      textAlign: "justify",
      mt: 1
    },
    contentTextCenter: {
      fontSize: "16px",
      textAlign: "center",
      mt: 2,
      fontWeight: "bold"
    },
    actions: {
      justifyContent: "center",
      pb: 2
    },
    button: {
      fontWeight: "bold",
      textTransform: "none",
      minWidth: "220px"
    }
  };


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
          position: "relative"  // <-- important
        }}
      >
        <Container
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "-100px"
          }}
          maxWidth={false}
        >
          <div style={{ border: "5px solid black" }} className="Container">
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
                  <img src={logoSrc} alt="Logo" />
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
              {/* ✅ Login Type Dropdown (copied from Login.jsx) */}
              <div className="TextField" style={{ position: "relative" }}>
                <label htmlFor="loginType">Login As</label>
                <select
                  id="loginType"
                  name="loginType"
                  value={loginType}
                  onChange={(e) => {
                    setLoginType(e.target.value);
                    if (e.target.value === "applicant") {
                      navigate("/login_applicant");
                    } else {
                      navigate("/login");
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.8rem 2.5rem 0.8rem 2.5rem",
                    borderRadius: "6px",
                    border: "2px solid black",
                    height: "55px",
                    fontSize: "1rem",
                    backgroundColor: "white",
                    outline: "none",
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option sx={{ border: "2px solid black" }} value="user">Student / Faculty / Registrar</option>
                  <option sx={{ border: "2px solid black" }} value="applicant">Applicant</option>
                </select>
                <PersonIcon
                  style={{
                    position: "absolute",
                    top: "2.75rem",
                    left: "0.7rem",
                    color: "rgba(0,0,0,0.4)",
                  }}
                />
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

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!lockout) handleLogin();
                }}
              >
                <div className="TextField" style={{ position: "relative" }}>
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="text"
                    id="email"
                    name="email"
                    placeholder="Enter your email address"
                    className="border"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: "2.5rem", height: "55px", border: errors.email ? "2px solid red" : "2px solid black", }}
                    autoFocus
                  />
                  {errors.email && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      Email is required
                    </span>
                  )}
                  <EmailIcon
                    style={{
                      position: "absolute",
                      top: "2.75rem",
                      left: "0.7rem",
                      color: "rgba(0,0,0,0.4)",
                    }}
                  />
                </div>

                <div className="TextField" style={{ position: "relative" }}>
                  <label htmlFor="password">Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border"
                    style={{ paddingLeft: "2.5rem", height: "55px", border: errors.password ? "2px solid red" : "2px solid black", }}
                  />
                  {errors.password && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      Password is required
                    </span>
                  )}
                  <LockIcon
                    style={{
                      position: "absolute",
                      top: "2.75rem",
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
                      cursor: "pointer",
                      marginBottom: "50px"
                    }}
                  >
                    {showPassword ? (
                      <Visibility sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                    ) : (
                      <VisibilityOff sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                    )}
                  </button>
                </div>

                <div

                  style={{
                    cursor: lockout || loading ? "not-allowed" : "pointer",
                  }}
                >
                  <button
                    type="submit"
                    disabled={lockout || loading}
                    style={{
                      width: "100%",
                      backgroundColor: lockout
                        ? "gray"
                        : loading
                          ? "#ccc"
                          : mainButtonColor,
                      border: "2px solid black",
                      color: "white",
                      height: "50px",
                      borderRadius: "10px",
                      padding: "0.5rem 0",
                      fontSize: "16px",
                      fontWeight: "bold",
                      marginTop: "50px",
                      cursor: lockout || loading ? "not-allowed" : "pointer",
                      opacity: lockout || loading ? 0.8 : 1,
                      transition: "opacity 0.2s ease-in-out",
                    }}
                  >
                    {lockout
                      ? `Locked (${lockoutTimer}s)`
                      : loading
                        ? "Processing..."
                        : "Log In"}
                  </button>

                </div>


              </form>

              <div className="LinkContainer">
                <span>
                  <Link to="/forgot_password">Forgot your password</Link>
                </span>
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

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={handleClose}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity={snack.severity} onClose={handleClose} sx={{ width: "100%" }}>
            {snack.message}
          </Alert>
        </Snackbar>

        {/* OTP Modal */}

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
            {/* Close Button */}
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

            {/* OTP Boxes */}
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
                  onChange={(e) =>
                    handleOtpChange(e.target.value, index)
                  }
                  onKeyDown={(e) =>
                    handleOtpKeyDown(e, index)
                  }
                  style={{
                    width: "54px",
                    height: "60px",
                    fontSize: "24px",
                    fontWeight: 700,
                    textAlign: "center",
                    borderRadius: "14px",
                    border: "2px solid #ddd",
                    outline: "none",
                  }}
                />
              ))}
            </Box>

            {/* Helper */}
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
              disabled={loading3}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: mainButtonColor,
                color: "white",
                fontWeight: 700,
                fontSize: "15px",
                cursor: loading3 ? "not-allowed" : "pointer",
              }}
            >
              {loading3 ? "Verifying..." : "Verify & Continue"}
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

            {/* Support */}
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

        <LoadingOverlay open={loading} />
        <LoadingOverlay open={loading2} />
        <LoadingOverlay open={loading3} />

      </Box>
    </>
  );
};

export default LoginEnrollment;
