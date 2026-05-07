import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Container, Box, Snackbar, Alert, Typography, Button } from "@mui/material";
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import "../styles/Container.css";
import Logo from "../assets/Logo.png";
import { SettingsContext } from "../App";
import API_BASE_URL from "../apiConfig";
import AnnouncementSlider from "../components/AnnouncementSlider";
import { Link as RouterLink } from "react-router-dom";

const Login = ({ setIsAuthenticated }) => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  useEffect(() => {
    if (settings) {
      if (settings.title_color) setTitleColor(settings.title_color);
      if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
      if (settings.border_color) setBorderColor(settings.border_color);
      if (settings.main_button_color)
        setMainButtonColor(settings.main_button_color);
    }
  }, [settings]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [currentYear, setCurrentYear] = useState("");
  const [loginType, setLoginType] = useState("applicant");
  const navigate = useNavigate();

  useEffect(() => {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    setCurrentYear(new Date(now).getFullYear());
  }, []);

  const calculateAge = (birthDate) => {
    if (!birthDate) return "";

    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const [errors, setErrors] = useState({});

  const handleLogin = async () => {
    if (!isFormValid()) {
      setSnack({
        open: true,
        message: "Please fill in all required fields",
        severity: "warning",
      });
      return;
    }
    try {
      const apiUrl =
        loginType === "applicant"
          ? `${API_BASE_URL}/auth/login_applicant`
          : `${API_BASE_URL}/auth/login`;

      const response = await axios.post(
        apiUrl,
        { email, password, audit_log_db: "db" },
        { headers: { "Content-Type": "application/json" } },
      );

      if (!response.data.success) {
        setSnack({
          open: true,
          message: response.data.message,
          severity: "error",
        });
        return;
      }

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("applicantEmail", response.data.email);
      localStorage.setItem("email", response.data.email);
      localStorage.setItem("role", response.data.role);
      localStorage.setItem("person_id", response.data.person_id);
      localStorage.setItem("first_name", response.data.first_name || "");
      localStorage.setItem("last_name", response.data.last_name || "");
      localStorage.setItem("middle_name", response.data.middle_name || "");
      const birthDate = response.data.birthOfDate || "";
      const age = calculateAge(birthDate);

      localStorage.setItem("birthOfDate", birthDate);
      localStorage.setItem("age", age);
      localStorage.setItem("academicProgram", response.academicProgram ?? "");
      localStorage.setItem("applyingAs", response.applyingAs ?? "");
      localStorage.setItem("campus", response.campus ?? "");
      localStorage.setItem("applicantEmail", response.data.email);

      setIsAuthenticated(true);
      setSnack({
        open: true,
        message: "Login Successfully",
        severity: "success",
      });

      if (loginType === "applicant") {
        navigate("/applicant_dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setSnack({
        open: true,
        message: error.response?.data?.message || "Invalid credentials",
        severity: "error",
      });
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

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  const backgroundImage = settings?.bg_image
    ? `url(${API_BASE_URL}${settings.bg_image})`
    : "linear-gradient(to right, #f5f5f5, #fafafa)";
  const logoSrc = settings?.logo_url
    ? `${API_BASE_URL}${settings.logo_url}`
    : Logo;

  return (
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
        <AnnouncementSlider />
        <div
          style={{ border: "5px solid black", marginLeft: -100, marginTop: "-130px" }}
          className="Container"
        >
          {/* ✅ Header (same as LoginEnrollment) */}
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

          {/* ✅ Body (same layout as LoginEnrollment) */}
          <div className="Body">
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
                  borderRadius: "10px",
                  border: "2px solid black",
                  fontSize: "1rem",
                  height: "55px",
                  backgroundColor: "white",
                  outline: "none",
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  cursor: "pointer",
                }}
              >
                <option sx={{ border: "2px solid black" }} value="user">
                  Student / Faculty / Registrar
                </option>
                <option sx={{ border: "2px solid black" }} value="applicant">
                  Applicant
                </option>
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
                style={{
                  position: "absolute",
                  top: "2.75rem",
                  right: "0.7rem",
                  fontSize: "30px", // 👈 BIGGER icon
                  color: "black",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Email */}
            <div className="TextField" style={{ position: "relative" }}>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email address"
                className="border"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{
                  paddingLeft: "2.5rem",
                  height: "55px",
                  border: errors.password ? "2px solid red" : "2px solid black",
                  borderRadius: "10px",
                }}
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

            {/* Password */}
            <div className="TextField" style={{ position: "relative" }}>
              <label htmlFor="password">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="border"
                style={{
                  paddingLeft: "2.5rem",
                  height: "55px",
                  border: errors.password ? "2px solid red" : "2px solid black",
                  borderRadius: "10px",
                }}
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
                }}
              >
                {showPassword ? (
                  <Visibility sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                ) : (
                  <VisibilityOff sx={{ fontSize: "26px", color: "rgba(0,0,0,0.4)" }} />
                )}
              </button>
            </div>

            {/* Login Button */}
            <div
              style={{
                height: "50px",
                borderRadius: "10px",
                border: "2px solid black",
                backgroundColor: mainButtonColor, // ✅ same color (prevents mismatch)
              }}
              className="Button"
              onClick={handleLogin}
            >
              <span>Log In</span>
            </div>

            {/* Forgot Password */}
            <div className="LinkContainer">
              <span>
                <Link to="/applicant_forgot_password">
                  Forgot your password
                </Link>
              </span>
            </div>

            <Box
              sx={{
                mt: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography variant="body1" color="textSecondary" align="center">
                Welcome! If you are a new applicant or have not yet finalized your registration, you may create an account now.
                Registering an account enables you to submit your application and access all required information.
              </Typography>


              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                sx={{
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 3,
                  py: 1.2,
                  borderRadius: "10px",
                  border: "2px solid black",

                  
                  color: "#fff",

                  boxShadow: "none",


                }}
              >
                Register Now
              </Button>
            </Box>
          </div>

          {/* ✅ Footer (aligned properly) */}
          <div className="Footer">
            <div className="FooterText">
              &copy; {currentYear} {settings?.company_name || "EARIST"} <br />
              Student Information System. <br />
              All rights reserved.
            </div>
          </div>
        </div>
      </Container>

      {/* Snackbar */}
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
    </Box>
  );
};

export default Login;
