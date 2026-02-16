import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const initialLogin = { email: "", password: "" };
const initialStore = {
  name: "",
  address: "",
  phone: "",
  email: "",
  isActive: true,
};
const initialEmployee = {
  fullName: "",
  phone: "",
  email: "",
  password: "",
  role: "STAFF",
  storeIds: [],
};
const initialAssign = { employeeId: "", storeIds: [] };

const useToken = () => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const saveToken = (value) => {
    setToken(value || "");
    if (value) localStorage.setItem("token", value);
    else localStorage.removeItem("token");
  };
  return [token, saveToken];
};

const App = () => {
  const [token, setToken] = useToken();
  const [authMode, setAuthMode] = useState("login");
  const [profile, setProfile] = useState(null);

  const [stores, setStores] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loginForm, setLoginForm] = useState(initialLogin);
  const [storeForm, setStoreForm] = useState(initialStore);
  const [employeeForm, setEmployeeForm] = useState(initialEmployee);
  const [assignForm, setAssignForm] = useState(initialAssign);

  const [authError, setAuthError] = useState("");
  const [storeError, setStoreError] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [assignError, setAssignError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [activeNav, setActiveNav] = useState("profile");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const EyeIcon = ({ open }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {!open && (
        <path
          d="M4 4l16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      )}
    </svg>
  );

  const isLoggedIn = Boolean(token);
  const role = profile?.role || "";
  const isStaffOnly = role === "STAFF";
  const canManageStores = role === "DIRECTOR" || role === "MANAGER";
  const canManageEmployees = role === "DIRECTOR" || role === "MANAGER";

  const navItems = useMemo(
    () => [
      { id: "everyone", label: "Everyone", show: !isStaffOnly },
      { id: "profile", label: "Profile", show: true },
      { id: "shops", label: "Shops", show: !isStaffOnly },
      { id: "settings", label: "Settings", show: true },
    ],
    [isStaffOnly]
  );

  const apiFetch = async (path, options = {}) => {
    const headers = options.headers ? { ...options.headers } : {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = { raw: text };
    }

    if (!res.ok) {
      const message = data?.error || data?.message || res.statusText;
      throw new Error(message);
    }

    return data;
  };

  const loadStores = async () => {
    const data = await apiFetch("/stores");
    setStores(data || []);
  };

  const loadEmployees = async () => {
    const data = await apiFetch("/employees");
    setEmployees(data || []);
  };

  const loadProfile = async () => {
    const data = await apiFetch("/auth/me");
    setProfile(data);
  };

  const loadAuthedData = async () => {
    await Promise.all([loadProfile(), loadStores(), loadEmployees()]);
  };

  useEffect(() => {
    loadStores().catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    loadAuthedData().catch(() => {
      setToken("");
    });
  }, [token]);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      fullName: profile.fullName || "",
      phone: profile.phone || "",
      email: profile.email || "",
      password: "",
    });
  }, [profile]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const verifyToken = params.get("verifyToken");
    if (token) {
      setAuthMode("reset");
      setResetToken(token);
    }
    if (verifyToken) {
      apiFetch(`/auth/verify-email?token=${verifyToken}`)
        .then(() => {
          setAuthNotice("Email verified. You can log in now.");
        })
        .catch((err) => setAuthError(err.message))
        .finally(() => {
          window.history.replaceState({}, "", "/");
        });
    }
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    if (!loginForm.email || !loginForm.password) {
      setAuthError("Email and password required.");
      return;
    }

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      if (data?.token) setToken(data.token);
      setLoginForm(initialLogin);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setAuthError("");
    setResetNotice("");
    setAuthNotice("");

    if (!resetEmail.trim()) {
      setAuthError("Email is required.");
      return;
    }

    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      setResetNotice("Check your email for the reset link.");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setAuthError("");
    setResetNotice("");
    setAuthNotice("");

    if (!resetToken.trim()) {
      setAuthError("Reset token missing.");
      return;
    }
    if (!resetPassword.trim()) {
      setAuthError("New password required.");
      return;
    }

    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: resetToken.trim(),
          password: resetPassword.trim(),
        }),
      });
      setResetNotice("Password updated. Please log in.");
      setResetPassword("");
      setResetToken("");
      setAuthMode("login");
      window.history.replaceState({}, "", "/");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleCreateStore = async (event) => {
    event.preventDefault();
    setStoreError("");

    if (!storeForm.name) {
      setStoreError("Store name required.");
      return;
    }

    try {
      await apiFetch("/stores", {
        method: "POST",
        body: JSON.stringify(storeForm),
      });
      setStoreForm(initialStore);
      await loadStores();
    } catch (err) {
      setStoreError(err.message);
    }
  };

  const handleCreateEmployee = async (event) => {
    event.preventDefault();
    setEmployeeError("");

    const { fullName, phone, email, password, role, storeIds } = employeeForm;

    if (!fullName || !phone || !email || !password) {
      setEmployeeError("All fields are required.");
      return;
    }

    if (role !== "DIRECTOR" && storeIds.length === 0) {
      setEmployeeError("Select at least one store.");
      return;
    }

    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify(employeeForm),
      });
      setEmployeeForm(initialEmployee);
      await loadEmployees();
    } catch (err) {
      setEmployeeError(err.message);
    }
  };

  const handleAssignStores = async (event) => {
    event.preventDefault();
    setAssignError("");

    if (!assignForm.employeeId) {
      setAssignError("Select an employee.");
      return;
    }
    if (assignForm.storeIds.length === 0) {
      setAssignError("Select at least one store.");
      return;
    }

    try {
      await apiFetch(`/employees/${assignForm.employeeId}/store`, {
        method: "PATCH",
        body: JSON.stringify({ storeIds: assignForm.storeIds }),
      });
      setAssignForm((prev) => ({ ...prev, storeIds: [] }));
      await loadEmployees();
    } catch (err) {
      setAssignError(err.message);
    }
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    setProfileError("");

    const payload = {
      fullName: profileForm.fullName.trim(),
      phone: profileForm.phone.trim(),
      email: profileForm.email.trim(),
    };

    if (!payload.fullName || !payload.phone) {
      setProfileError("Full name and phone are required.");
      return;
    }

    if (profileForm.password.trim()) {
      payload.password = profileForm.password.trim();
    }

    try {
      const updated = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProfile(updated);
      setProfileForm((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const storeOptions = useMemo(
    () =>
      stores.map((store) => (
        <option key={store._id} value={store._id}>
          {store.name}
        </option>
      )),
    [stores]
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => (
        <option key={employee._id} value={employee._id}>
          {employee.fullName} ({employee.role})
        </option>
      )),
    [employees]
  );

  if (!isLoggedIn) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand">
            <p className="eyebrow">Family Choice Emp</p>
            <h1>Operations Portal</h1>
            <p className="muted">
              Sign in to manage stores, employees, and assignments.
            </p>
          </div>

          {authMode === "login" ? (
            <form className="form" onSubmit={handleLogin}>
              <label>Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
              <label>Password</label>
              <div className="password-field">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showLoginPassword} />
                </button>
              </div>
              {authError && <p className="error">{authError}</p>}
              {authNotice && <p className="muted">{authNotice}</p>}
              <button type="submit">Login</button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setAuthMode("reset");
                  setAuthError("");
                  setResetNotice("");
                }}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form
              className="form"
              onSubmit={resetToken ? handleResetPassword : handleRequestReset}
            >
              <p className="muted">
                {resetToken
                  ? "Set your new password."
                  : "Enter your email to receive a reset link."}
              </p>
              {!resetToken && (
                <>
                  <label>Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                  />
                </>
              )}
              {resetToken && (
                <>
                  <label>New password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                  />
                </>
              )}
              {authError && <p className="error">{authError}</p>}
              {resetNotice && <p className="muted">{resetNotice}</p>}
              <button type="submit">
                {resetToken ? "Reset Password" : "Send Reset Link"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setResetNotice("");
                  setResetToken("");
                  setResetPassword("");
                }}
              >
                Back to login
              </button>
            </form>
          )}
        </div>

        
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Family Choice Emp</p>
          <h2>Console</h2>
        </div>
        <nav className="nav">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`nav-link ${
                  activeNav === item.id ? "active" : ""
                }`}
                onClick={() => setActiveNav(item.id)}
              >
                {item.label}
              </a>
            ))}
        </nav>
      </aside>

      <div className="app">
        <header className="topbar">
          <div>
            <p className="eyebrow">Family Choice Emp</p>
            <h1>Operations Console</h1>
          </div>
          <div className="user-card">
            <div>
              <p className="muted">Signed in as</p>
              <strong>{profile?.fullName || "User"}</strong>
              <p className="muted">{profile?.role || ""}</p>
            </div>
            <button
              className="ghost"
              onClick={() => {
                setToken("");
                setAuthMode("login");
              }}
              type="button"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="grid">
          <section className="panel profile" id="profile">
            <h2>Profile</h2>
            <div className="card">
              <div>
                <strong>{profile?.fullName}</strong>
                <p className="muted">{profile?.email}</p>
              </div>
              <div>
                <p className="muted">Phone</p>
                <p>{profile?.phone || "—"}</p>
              </div>
              <div>
                <p className="muted">Stores</p>
                <p>
                  {Array.isArray(profile?.storeNames) &&
                  profile.storeNames.length > 0
                    ? profile.storeNames.join(", ")
                    : "All stores"}
                </p>
              </div>
            </div>
            <form className="form" onSubmit={handleUpdateProfile}>
              <label>Full name</label>
              <input
                type="text"
                value={profileForm.fullName}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }))
                }
              />
              <label>Phone</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
              <label>Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
              <label>New password (optional)</label>
              <input
                type="password"
                value={profileForm.password}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
              {profileError && <p className="error">{profileError}</p>}
              <button type="submit">Update Profile</button>
            </form>
          </section>

          {!isStaffOnly && canManageStores && (
            <section className="panel" id="shops">
              <h2>Create Store</h2>
              <form className="form" onSubmit={handleCreateStore}>
                <label>Name</label>
                <input
                  type="text"
                  value={storeForm.name}
                  onChange={(event) =>
                    setStoreForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
                <label>Address</label>
                <input
                  type="text"
                  value={storeForm.address}
                  onChange={(event) =>
                    setStoreForm((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                />
                <label>Phone</label>
                <input
                  type="text"
                  value={storeForm.phone}
                  onChange={(event) =>
                    setStoreForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                />
                <label>Email</label>
                <input
                  type="email"
                  value={storeForm.email}
                  onChange={(event) =>
                    setStoreForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={storeForm.isActive}
                    onChange={(event) =>
                      setStoreForm((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Active
                </label>
                {storeError && <p className="error">{storeError}</p>}
                <button type="submit">Create Store</button>
              </form>
            </section>
          )}

          {!isStaffOnly && canManageEmployees && (
            <section className="panel" id="everyone">
              <h2>Create Employee</h2>
              <form className="form" onSubmit={handleCreateEmployee}>
                <label>Full name</label>
                <input
                  type="text"
                  value={employeeForm.fullName}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                />
                <label>Phone</label>
                <input
                  type="text"
                  value={employeeForm.phone}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                />
                <label>Email</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
                <label>Password</label>
                <input
                  type="password"
                  value={employeeForm.password}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                />
                <label>Role</label>
                <select
                  value={employeeForm.role}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="STAFF">STAFF</option>
                  <option value="SALES_EXECUTIVE">SALES_EXECUTIVE</option>
                  <option value="STORE_MANAGER">STORE_MANAGER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="DIRECTOR">DIRECTOR</option>
                </select>
                <label>Stores (multi-select)</label>
                <select
                  multiple
                  value={employeeForm.storeIds}
                  onChange={(event) => {
                    const selected = Array.from(
                      event.target.selectedOptions
                    ).map((opt) => opt.value);
                    setEmployeeForm((prev) => ({
                      ...prev,
                      storeIds: selected,
                    }));
                  }}
                >
                  {storeOptions}
                </select>
                {employeeError && <p className="error">{employeeError}</p>}
                <button type="submit">Create Employee</button>
              </form>
            </section>
          )}

          {!isStaffOnly && canManageEmployees && (
            <section className="panel span-2">
              <h2>Assign Stores</h2>
              <form className="form grid" onSubmit={handleAssignStores}>
                <div>
                  <label>Employee</label>
                  <select
                    value={assignForm.employeeId}
                    onChange={(event) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        employeeId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select employee</option>
                    {employeeOptions}
                  </select>
                </div>
                <div>
                  <label>Stores</label>
                  <select
                    multiple
                    value={assignForm.storeIds}
                    onChange={(event) => {
                      const selected = Array.from(
                        event.target.selectedOptions
                      ).map((opt) => opt.value);
                      setAssignForm((prev) => ({
                        ...prev,
                        storeIds: selected,
                      }));
                    }}
                  >
                    {storeOptions}
                  </select>
                </div>
                {assignError && <p className="error">{assignError}</p>}
                <button type="submit">Save Assignment</button>
              </form>
            </section>
          )}

          {!isStaffOnly && (
            <section className="panel">
              <h2>Stores</h2>
              <div className="list">
                {stores.map((store) => (
                  <div key={store._id} className="list-item">
                    <strong>{store.name}</strong>
                    <p className="muted">{store.address || "No address"}</p>
                    <p className="muted">{store.email || "No email"}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isStaffOnly && (
            <section className="panel">
              <h2>Employees</h2>
              <div className="list">
                {employees.map((employee) => (
                  <div key={employee._id} className="list-item">
                    <strong>
                      {employee.fullName} <span>{employee.role}</span>
                    </strong>
                    <p className="muted">{employee.email || "No email"}</p>
                    <p className="muted">
                      Stores: {employee.storeNames?.join(", ") || "None"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel" id="settings">
            <h2>Settings</h2>
            <div className="card">
              <p className="muted">Session</p>
              <p>Role: {profile?.role || "—"}</p>
              <p>API: {API_BASE}</p>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setToken("");
                  setAuthMode("login");
                }}
              >
                Sign out
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
