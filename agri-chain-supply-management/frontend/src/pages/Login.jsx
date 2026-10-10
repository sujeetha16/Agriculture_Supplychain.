// Path: frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import Alert from "../components/Alert";

// Standard preset credentials for instant demo access
const PRESET_CREDENTIALS = [
  {
    role: 1,
    roleName: "Farmer",
    name: "John Vance",
    organization: "Green Valley Organic Farms",
    username: "farmer",
    password: "Farmer@123",
    avatar: "👨‍🌾",
    badgeColor: "success"
  },
  {
    role: 2,
    roleName: "Distributor",
    name: "Marcus Brody",
    organization: "Pacific Cold-Chain Logistics Hub",
    username: "distributor",
    password: "Distributor@123",
    avatar: "🚚",
    badgeColor: "warning"
  },
  {
    role: 3,
    roleName: "Retailer (Seller)",
    name: "Sarah Jenkins",
    organization: "FreshMarket Supermarket #104",
    username: "retailer",
    password: "Retailer@123",
    avatar: "🏪",
    badgeColor: "info"
  },
  {
    role: 4,
    roleName: "Customer (Consumer)",
    name: "Alice Chen",
    organization: "Verified Consumer Member",
    username: "consumer",
    password: "Consumer@123",
    avatar: "👤",
    badgeColor: "secondary"
  }
];

export default function Login() {
  const { login, register, loginAsRole, allStakeholders, user } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  // Active tab: "login" or "register"
  const [activeTab, setActiveTab] = useState(location.pathname === "/register" ? "register" : "login");

  // Sign In State
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register State
  const [regForm, setRegForm] = useState({
    name: "",
    username: "",
    email: "",
    role: 1,
    organization: "",
    location: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regTouched, setRegTouched] = useState({});
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  const from = location.state?.from?.pathname || "/dashboard";

  // Real-time Field Validations for Registration
  const validateField = (field, value) => {
    switch (field) {
      case "name":
        if (!value || value.trim().length < 3) return "Full Name must be at least 3 characters.";
        if (!/^[a-zA-Z\s.'-]+$/.test(value.trim())) return "Full Name can only contain letters, spaces, hyphens, and apostrophes.";
        return "";

      case "username":
        if (!value || value.trim().length < 3) return "Username must be at least 3 characters.";
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(value.trim())) return "Username must be 3-20 alphanumeric characters (no spaces).";
        if (allStakeholders.some((s) => s.username.toLowerCase() === value.trim().toLowerCase())) {
          return `Username '@${value.trim()}' is already taken.`;
        }
        return "";

      case "email":
        if (!value) return "Email address is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Please enter a valid email address (e.g. name@domain.com).";
        if (allStakeholders.some((s) => s.email?.toLowerCase() === value.trim().toLowerCase())) {
          return "This email is already associated with an account.";
        }
        return "";

      case "organization":
        if (!value || value.trim().length < 2) return "Organization / Farm name must be at least 2 characters.";
        return "";

      case "location":
        if (!value || value.trim().length < 2) return "Location must specify city, state/region (at least 2 characters).";
        return "";

      case "password":
        if (!value || value.length < 6) return "Password must be at least 6 characters long.";
        return "";

      case "confirmPassword":
        if (!value) return "Please confirm your password.";
        if (value !== regForm.password) return "Passwords do not match.";
        return "";

      case "agreeTerms":
        if (!value) return "You must agree to the agricultural compliance standards.";
        return "";

      default:
        return "";
    }
  };

  // Calculate Password Strength Score (0 to 4)
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "None", color: "secondary" };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score, label: "Weak", color: "danger", width: "25%" };
    if (score === 2) return { score, label: "Fair", color: "warning", width: "50%" };
    if (score === 3) return { score, label: "Good", color: "info", width: "75%" };
    return { score, label: "Strong", color: "success", width: "100%" };
  };

  // Handle Quick Auto-Fill & Login
  async function handleAutoFillLogin(preset) {
    setLoginForm({ username: preset.username, password: preset.password });
    setLoginError("");
    setIsSubmitting(true);
    try {
      const result = await login(preset.username, preset.password);
      if (result.success) {
        setLoginSuccess(`Signed in successfully as ${preset.name} (${preset.roleName})!`);
        setTimeout(() => navigate(from), 400);
      } else {
        setLoginError(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Standard Sign-In Submit
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setLoginSuccess("");

    if (!loginForm.username.trim()) {
      setLoginError("Please enter your username or email address.");
      return;
    }
    if (!loginForm.password.trim()) {
      setLoginError("Please enter your account password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(loginForm.username, loginForm.password);
      if (result.success) {
        setLoginSuccess(`Welcome back, ${result.user.name}!`);
        setTimeout(() => navigate(from), 450);
      } else {
        setLoginError(result.message);
      }
    } catch (err) {
      setLoginError(err.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Registration Submit with Full Validation
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    // Mark all fields as touched
    const allTouched = {
      name: true,
      username: true,
      email: true,
      organization: true,
      location: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true
    };
    setRegTouched(allTouched);

    // Validate all fields
    const nameErr = validateField("name", regForm.name);
    const userErr = validateField("username", regForm.username);
    const emailErr = validateField("email", regForm.email);
    const orgErr = validateField("organization", regForm.organization);
    const locErr = validateField("location", regForm.location);
    const pwdErr = validateField("password", regForm.password);
    const confErr = validateField("confirmPassword", regForm.confirmPassword);
    const termsErr = validateField("agreeTerms", regForm.agreeTerms);

    if (nameErr || userErr || emailErr || orgErr || locErr || pwdErr || confErr || termsErr) {
      setRegError(nameErr || userErr || emailErr || orgErr || locErr || pwdErr || confErr || termsErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        name: regForm.name.trim(),
        username: regForm.username.trim().toLowerCase(),
        email: regForm.email.trim().toLowerCase(),
        password: regForm.password,
        role: Number(regForm.role),
        organization: regForm.organization.trim(),
        location: regForm.location.trim()
      });

      if (result.success) {
        setRegSuccess(`Account created! Welcome, ${result.user.name} (${result.user.roleName}). Redirecting...`);
        setTimeout(() => navigate("/dashboard"), 700);
      } else {
        setRegError(result.message || "Registration failed.");
      }
    } catch (err) {
      setRegError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pwdStrength = getPasswordStrength(regForm.password);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10 col-xl-9">
          {/* Brand Header */}
          <div className="text-center mb-4">
            <div className="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle shadow-sm mb-2" style={{ width: "54px", height: "54px", fontSize: "1.6rem" }}>
              🌱
            </div>
            <h2 className="fw-bold tracking-tight mb-1">Trustable AgriChain</h2>
            <p className="text-secondary small mb-3">
              Stakeholder Authentication & Access Portal
            </p>

            {/* Navigation Tabs */}
            <div className="d-inline-flex bg-light p-1 rounded-pill border">
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-4 fw-semibold ${activeTab === "login" ? "btn-success shadow-sm" : "btn-light text-secondary"}`}
                onClick={() => setActiveTab("login")}
              >
                <i className="bi bi-box-arrow-in-right me-1"></i>Sign In
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-4 fw-semibold ${activeTab === "register" ? "btn-success shadow-sm" : "btn-light text-secondary"}`}
                onClick={() => setActiveTab("register")}
              >
                <i className="bi bi-person-plus-fill me-1"></i>Register New Account
              </button>
            </div>

            {user && (
              <div className="alert alert-info d-flex align-items-center justify-content-between p-2 px-3 mt-3 mb-0 rounded-3 small text-start">
                <div>
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  Currently signed in as: <strong>{user.name}</strong> ({user.roleName})
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-semibold px-3"
                  onClick={() => navigate("/dashboard")}
                >
                  Go to Dashboard <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* TAB 1: SIGN IN TO PORTAL                                    */}
          {/* ========================================================== */}
          {activeTab === "login" && (
            <div>
              {/* Preset Credentials Reference & 1-Click Access Card */}
              <div className="agri-card mb-4 border-success-subtle">
                <div className="agri-card-header bg-success-subtle bg-opacity-25 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-key-fill text-success fs-5"></i>
                    <div>
                      <strong className="text-dark small">Pre-Configured Stakeholder Credentials</strong>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                        Click any role card below to auto-fill credentials and sign in instantly.
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-success text-white small">Ready for Demo</span>
                </div>

                <div className="agri-card-body p-3">
                  <div className="row g-3">
                    {PRESET_CREDENTIALS.map((p) => {
                      const isActive = user?.username === p.username;
                      return (
                        <div className="col-md-6 col-lg-3" key={p.role}>
                          <div
                            className={`p-3 rounded-3 border h-100 transition position-relative ${isActive ? "border-success bg-success-subtle bg-opacity-25 shadow-sm" : "bg-light"}`}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="fs-3">{p.avatar}</span>
                              <span className={`badge bg-${p.badgeColor}-subtle text-${p.badgeColor} border small`}>
                                {p.roleName}
                              </span>
                            </div>
                            <div className="fw-bold text-dark small text-truncate" title={p.name}>{p.name}</div>
                            <div className="text-muted text-truncate" style={{ fontSize: "0.75rem" }} title={p.organization}>
                              {p.organization}
                            </div>

                            <div className="p-2 bg-white rounded border small mt-2 font-monospace" style={{ fontSize: "0.72rem" }}>
                              <div><strong>user:</strong> {p.username}</div>
                              <div><strong>pass:</strong> {p.password}</div>
                            </div>

                            <button
                              type="button"
                              className={`btn btn-sm w-100 mt-2 fw-semibold ${isActive ? "btn-outline-success" : "btn-success"}`}
                              disabled={isSubmitting}
                              onClick={() => handleAutoFillLogin(p)}
                            >
                              <i className="bi bi-box-arrow-in-right me-1"></i>
                              {isActive ? "Active Portal" : "Fill & Sign In"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Standard Sign-In Form */}
              <div className="row justify-content-center">
                <div className="col-lg-7">
                  <div className="agri-card p-4">
                    <h5 className="fw-bold text-dark mb-1">Sign In with Credentials</h5>
                    <p className="text-secondary small mb-3">
                      Enter your verified username or email and password.
                    </p>

                    <Alert message={loginError} onClose={() => setLoginError("")} />
                    {loginSuccess && (
                      <div className="alert alert-success d-flex align-items-center small mb-3">
                        <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                        <div>{loginSuccess}</div>
                      </div>
                    )}

                    <form onSubmit={handleLoginSubmit}>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">
                          Username or Email Address <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-light text-muted">
                            <i className="bi bi-person"></i>
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. farmer, distributor, retailer, consumer"
                            value={loginForm.username}
                            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="form-label small fw-semibold mb-0">
                            Password <span className="text-danger">*</span>
                          </label>
                          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                            Default: Role@123 (e.g. Farmer@123)
                          </span>
                        </div>
                        <div className="input-group">
                          <span className="input-group-text bg-light text-muted">
                            <i className="bi bi-shield-lock"></i>
                          </span>
                          <input
                            type={showPassword ? "text" : "password"}
                            className="form-control"
                            placeholder="Enter password..."
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                            required
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-success w-100 fw-semibold py-2 mt-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Verifying Credentials...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-box-arrow-in-right me-2"></i>Sign In to Workspace
                          </>
                        )}
                      </button>
                    </form>

                    <div className="text-center mt-3 pt-3 border-top small text-secondary">
                      Don't have an agricultural stakeholder identity?{" "}
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-success p-0 fw-semibold text-decoration-none"
                        onClick={() => setActiveTab("register")}
                      >
                        Register New Stakeholder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: REGISTER NEW STAKEHOLDER (FULL FIELD VALIDATION)     */}
          {/* ========================================================== */}
          {activeTab === "register" && (
            <div className="agri-card p-4 p-md-5">
              <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
                <div>
                  <h4 className="fw-bold mb-1">Register New Supply Chain Stakeholder</h4>
                  <p className="text-secondary small mb-0">
                    All fields are rigorously validated and tokenized with a dedicated on-chain identity.
                  </p>
                </div>
                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                  <i className="bi bi-shield-check me-1"></i>Validated Registration
                </span>
              </div>

              <Alert message={regError} onClose={() => setRegError("")} />
              {regSuccess && (
                <div className="alert alert-success d-flex align-items-center mb-4">
                  <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                  <div>{regSuccess}</div>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} noValidate>
                {/* 1. Select Functional Role */}
                <div className="mb-4">
                  <label className="form-label small fw-semibold text-uppercase text-secondary mb-2">
                    1. Select Stakeholder Functional Role <span className="text-danger">*</span>
                  </label>
                  <div className="row g-3">
                    {[
                      { role: 1, name: "Farmer", avatar: "👨‍🌾", desc: "Origin producer: harvests crops and registers batch provenance." },
                      { role: 2, name: "Distributor", avatar: "🚚", desc: "Cold-chain carrier: monitors refrigerated freight & logistics." },
                      { role: 3, name: "Retailer (Seller)", avatar: "🏪", desc: "Supermarket store: stocks inventory and records customer checkout." },
                      { role: 4, name: "Customer (Consumer)", avatar: "👤", desc: "End consumer: scans QR codes and verifies farm-to-table certificates." }
                    ].map((item) => {
                      const isSelected = Number(regForm.role) === item.role;
                      return (
                        <div className="col-md-6 col-lg-3" key={item.role}>
                          <div
                            className={`p-3 rounded-3 border h-100 cursor-pointer transition ${isSelected ? "border-success bg-success-subtle bg-opacity-25 shadow-sm" : "bg-light"}`}
                            onClick={() => setRegForm({ ...regForm, role: item.role })}
                            style={{ cursor: "pointer" }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="fs-2">{item.avatar}</span>
                              <input
                                type="radio"
                                className="form-check-input"
                                name="role"
                                checked={isSelected}
                                onChange={() => setRegForm({ ...regForm, role: item.role })}
                              />
                            </div>
                            <strong className="text-dark d-block mb-1">{item.name}</strong>
                            <p className="text-secondary small mb-0" style={{ fontSize: "0.78rem" }}>
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Personal & Business Information */}
                <div className="mb-4">
                  <label className="form-label small fw-semibold text-uppercase text-secondary mb-2">
                    2. Stakeholder Identity & Entity Details <span className="text-danger">*</span>
                  </label>

                  <div className="row g-3">
                    {/* Full Name */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Full Name <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          <i className="bi bi-person"></i>
                        </span>
                        <input
                          type="text"
                          className={`form-control ${regTouched.name ? (validateField("name", regForm.name) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="e.g. John Vance, Sarah Jenkins"
                          value={regForm.name}
                          onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, name: true })}
                          required
                        />
                      </div>
                      {regTouched.name && validateField("name", regForm.name) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("name", regForm.name)}
                        </div>
                      )}
                      {regTouched.name && !validateField("name", regForm.name) && (
                        <div className="text-success small mt-1">
                          <i className="bi bi-check-circle me-1"></i>Valid full legal name.
                        </div>
                      )}
                    </div>

                    {/* Username */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Username <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">@</span>
                        <input
                          type="text"
                          className={`form-control ${regTouched.username ? (validateField("username", regForm.username) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="e.g. farmer_john, seattle_hub"
                          value={regForm.username}
                          onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, username: true })}
                          required
                        />
                      </div>
                      {regTouched.username && validateField("username", regForm.username) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("username", regForm.username)}
                        </div>
                      )}
                      {regTouched.username && !validateField("username", regForm.username) && (
                        <div className="text-success small mt-1">
                          <i className="bi bi-check-circle me-1"></i>Username is available.
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Email Address <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          <i className="bi bi-envelope"></i>
                        </span>
                        <input
                          type="email"
                          className={`form-control ${regTouched.email ? (validateField("email", regForm.email) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="e.g. name@greenvalleyfarms.com"
                          value={regForm.email}
                          onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, email: true })}
                          required
                        />
                      </div>
                      {regTouched.email && validateField("email", regForm.email) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("email", regForm.email)}
                        </div>
                      )}
                      {regTouched.email && !validateField("email", regForm.email) && (
                        <div className="text-success small mt-1">
                          <i className="bi bi-check-circle me-1"></i>Valid email address format.
                        </div>
                      )}
                    </div>

                    {/* Organization / Farm Name */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Organization / Farm / Business Name <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          <i className="bi bi-building"></i>
                        </span>
                        <input
                          type="text"
                          className={`form-control ${regTouched.organization ? (validateField("organization", regForm.organization) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="e.g. Green Valley Organic Farms, FreshMarket"
                          value={regForm.organization}
                          onChange={(e) => setRegForm({ ...regForm, organization: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, organization: true })}
                          required
                        />
                      </div>
                      {regTouched.organization && validateField("organization", regForm.organization) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("organization", regForm.organization)}
                        </div>
                      )}
                    </div>

                    {/* Operating Location */}
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Facility Location / City, State <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          <i className="bi bi-geo-alt"></i>
                        </span>
                        <input
                          type="text"
                          className={`form-control ${regTouched.location ? (validateField("location", regForm.location) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="e.g. Yakima Valley Orchards, Washington (or Seattle, WA)"
                          value={regForm.location}
                          onChange={(e) => setRegForm({ ...regForm, location: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, location: true })}
                          required
                        />
                      </div>
                      {regTouched.location && validateField("location", regForm.location) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("location", regForm.location)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Password & Security Credentials */}
                <div className="mb-4">
                  <label className="form-label small fw-semibold text-uppercase text-secondary mb-2">
                    3. Account Security & Password <span className="text-danger">*</span>
                  </label>

                  <div className="row g-3">
                    {/* Password */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Create Password <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          <i className="bi bi-lock"></i>
                        </span>
                        <input
                          type={showRegPassword ? "text" : "password"}
                          className={`form-control ${regTouched.password ? (validateField("password", regForm.password) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="Min 6 characters (e.g. Farmer@123)"
                          value={regForm.password}
                          onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, password: true })}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                        >
                          <i className={`bi ${showRegPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {regForm.password && (
                        <div className="mt-2">
                          <div className="d-flex justify-content-between align-items-center mb-1 small">
                            <span className="text-muted" style={{ fontSize: "0.72rem" }}>Password Strength:</span>
                            <span className={`badge bg-${pwdStrength.color} small`}>
                              {pwdStrength.label}
                            </span>
                          </div>
                          <div className="progress" style={{ height: "4px" }}>
                            <div
                              className={`progress-bar bg-${pwdStrength.color}`}
                              style={{ width: pwdStrength.width }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {regTouched.password && validateField("password", regForm.password) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("password", regForm.password)}
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Confirm Password <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          <i className="bi bi-lock-fill"></i>
                        </span>
                        <input
                          type={showRegPassword ? "text" : "password"}
                          className={`form-control ${regTouched.confirmPassword ? (validateField("confirmPassword", regForm.confirmPassword) ? "is-invalid" : "is-valid") : ""}`}
                          placeholder="Re-enter password..."
                          value={regForm.confirmPassword}
                          onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                          onBlur={() => setRegTouched({ ...regTouched, confirmPassword: true })}
                          required
                        />
                      </div>
                      {regTouched.confirmPassword && validateField("confirmPassword", regForm.confirmPassword) && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          {validateField("confirmPassword", regForm.confirmPassword)}
                        </div>
                      )}
                      {regTouched.confirmPassword && !validateField("confirmPassword", regForm.confirmPassword) && (
                        <div className="text-success small mt-1">
                          <i className="bi bi-check-circle me-1"></i>Passwords match!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Supply Chain Compliance Agreement */}
                <div className="form-check p-3 bg-light rounded-3 mb-4">
                  <input
                    type="checkbox"
                    className="form-check-input ms-0 me-2"
                    id="agreeCheck"
                    checked={regForm.agreeTerms}
                    onChange={(e) => setRegForm({ ...regForm, agreeTerms: e.target.checked })}
                    required
                  />
                  <label className="form-check-label small text-secondary" htmlFor="agreeCheck">
                    I verify that my agricultural supply chain identity details are accurate and agree to cloud ledger provenance auditing and temperature verification protocols.
                  </label>
                  {regTouched.agreeTerms && !regForm.agreeTerms && (
                    <div className="text-danger small mt-1">
                      <i className="bi bi-exclamation-circle me-1"></i>You must accept the terms to register.
                    </div>
                  )}
                </div>

                {/* Submit Action Button */}
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-3 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setActiveTab("login")}
                  >
                    <i className="bi bi-arrow-left me-1"></i>Back to Sign In
                  </button>

                  <button
                    type="submit"
                    className="btn btn-success px-4 py-2 fw-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Registering Stakeholder...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-person-check-fill me-2"></i>Create Stakeholder Account & Sign In
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
