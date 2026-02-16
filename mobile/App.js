import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_API =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || DEFAULT_API;

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

const Badge = ({ label }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);

const Field = ({ label, value, onChangeText, secure, placeholder }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      autoCapitalize="none"
    />
  </View>
);

const Section = ({ title, children, style, titleStyle }) => (
  <View style={[styles.section, style]}>
    <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>
    {children}
  </View>
);

const MultiSelect = ({ items, selected, onToggle }) => (
  <View style={styles.multiSelect}>
    {items.map((item) => {
      const active = selected.includes(item._id);
      return (
        <Pressable
          key={item._id}
          onPress={() => onToggle(item._id)}
          style={[styles.selectItem, active && styles.selectItemActive]}
        >
          <Text style={styles.selectText}>{item.name}</Text>
          <Text style={styles.selectMeta}>{active ? "Selected" : "Tap"}</Text>
        </Pressable>
      );
    })}
  </View>
);

export default function App() {
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [activeNav, setActiveNav] = useState("profile");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });

  const [stores, setStores] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeStoreFilter, setEmployeeStoreFilter] = useState("");
  const [shopFilterOpen, setShopFilterOpen] = useState(false);
  const [attendance, setAttendance] = useState({
    dateKey: "",
    totalMinutes: 0,
    openShift: null,
    shifts: [],
  });
  const [attendanceStoreId, setAttendanceStoreId] = useState("");
  const [attendanceStoreOpen, setAttendanceStoreOpen] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());
  const [attendanceRange, setAttendanceRange] = useState("day");
  const [attendanceSummary, setAttendanceSummary] = useState({
    range: "day",
    from: "",
    to: "",
    totalMinutes: 0,
  });
  const [staffStoreFilter, setStaffStoreFilter] = useState("");
  const [staffStoreOpen, setStaffStoreOpen] = useState(false);

  const [loginForm, setLoginForm] = useState(initialLogin);
  // authMode: "login" | "forgot"
  const [forgotEmail, setForgotEmail] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [storeForm, setStoreForm] = useState(initialStore);
  const [employeeForm, setEmployeeForm] = useState(initialEmployee);
  const [staffForm, setStaffForm] = useState(initialEmployee);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignStoreIds, setAssignStoreIds] = useState([]);

  const role = profile?.role || "";
  const canManageStores = role === "DIRECTOR" || role === "MANAGER";
  const canManageEmployees = role === "DIRECTOR" || role === "MANAGER";
  const isStaffOnly = role === "STAFF";

  const navItems = useMemo(
    () => [
     
      { id: "everyone", label: "Home", show: !isStaffOnly },
      { id: "profile", label: "Profile", show: true },
      { id: "shops", label: "Shops", show: !isStaffOnly },
      { id: "staff", label: "Staff", show: role === "DIRECTOR" || role === "MANAGER" },
      { id: "settings", label: "Settings", show: true },
    ],
    [isStaffOnly, role]
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

  const loadAttendanceToday = async () => {
    const data = await apiFetch("/attendance/today");
    setAttendance(data || { dateKey: "", totalMinutes: 0, openShift: null, shifts: [] });
    if (data?.openShift?.storeId && !attendanceStoreId) {
      setAttendanceStoreId(String(data.openShift.storeId));
    }
  };

  const loadAttendanceSummary = async (range = attendanceRange) => {
    const data = await apiFetch(`/attendance/summary?range=${range}`);
    setAttendanceSummary(
      data || { range, from: "", to: "", totalMinutes: 0 }
    );
  };

  const loadAuthed = async () => {
    await Promise.all([
      loadProfile(),
      loadStores(),
      loadEmployees(),
      loadAttendanceToday(),
      loadAttendanceSummary(attendanceRange),
    ]);
  };

  useEffect(() => {
    const boot = async () => {
      const saved = await AsyncStorage.getItem("token");
      if (saved) setToken(saved);
      try {
        await loadStores();
      } catch (err) {
        // ignore
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      AsyncStorage.removeItem("token");
      return;
    }
    AsyncStorage.setItem("token", token);
    loadAuthed().catch(() => {
      setToken("");
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadAttendanceSummary(attendanceRange).catch(() => {});
  }, [attendanceRange, token]);

  useEffect(() => {
    if (!attendance?.openShift?.clockIn) return;
    const id = setInterval(() => {
      setClockTick(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [attendance?.openShift?.clockIn]);

  useEffect(() => {
    const available = navItems.filter((item) => item.show);
    if (available.length === 0) return;
    if (!available.some((item) => item.id === activeNav)) {
      setActiveNav(available[0].id);
    }
  }, [navItems, activeNav]);

  const toggleStoreSelection = (current, id) =>
    current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];

  const normalizePhone = (value = "") => value.replace(/\D/g, "");
  const isValidPhone = (value = "") =>
    /^\d{10}$/.test(normalizePhone(value));

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      Alert.alert("Missing info", "Email and password required.");
      return;
    }
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      setToken(data?.token || "");
      setLoginForm(initialLogin);
    } catch (err) {
      Alert.alert("Login failed", err.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert("Missing info", "Email required.");
      return;
    }
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      Alert.alert("Email sent", "Check your email for the reset link.");
    } catch (err) {
      Alert.alert("Request failed", err.message);
    }
  };

  const handleCreateStore = async () => {
    if (!storeForm.name) {
      Alert.alert("Missing info", "Store name required.");
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
      Alert.alert("Create store failed", err.message);
    }
  };

  const handleCreateEmployee = async () => {
    const { fullName, phone, email, password, role, storeIds } = employeeForm;
    if (!fullName || !phone || !email || !password) {
      Alert.alert("Missing info", "All fields are required.");
      return;
    }
    if (!isValidPhone(phone)) {
      Alert.alert("Invalid phone", "Phone number must be 10 digits.");
      return;
    }
    if (role !== "DIRECTOR" && storeIds.length === 0) {
      Alert.alert("Missing info", "Select at least one store.");
      return;
    }
    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify({
          ...employeeForm,
          phone: normalizePhone(phone),
        }),
      });
      setEmployeeForm(initialEmployee);
      await loadEmployees();
    } catch (err) {
      Alert.alert("Create employee failed", err.message);
    }
  };

  const handleCreateStaff = async () => {
    const { fullName, phone, email, password, storeIds, role: targetRole } = staffForm;
    if (!fullName || !phone || !email || !password) {
      Alert.alert("Missing info", "All fields are required.");
      return;
    }
    if (!isValidPhone(phone)) {
      Alert.alert("Invalid phone", "Phone number must be 10 digits.");
      return;
    }
    if (!staffRoleOptions.includes(targetRole)) {
      Alert.alert("Invalid role", "Role not allowed.");
      return;
    }
    if (storeIds.length === 0) {
      Alert.alert("Missing info", "Select at least one store.");
      return;
    }
    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          phone: normalizePhone(phone),
          email,
          password,
          role: targetRole,
          storeIds,
        }),
      });
      setStaffForm(initialEmployee);
      await loadEmployees();
    } catch (err) {
      Alert.alert("Create staff failed", err.message);
    }
  };

  const handleUpdateProfile = async () => {
    const payload = {
      fullName: profileForm.fullName.trim(),
      phone: normalizePhone(profileForm.phone),
      email: profileForm.email.trim(),
    };

    if (!payload.fullName || !payload.phone) {
      Alert.alert("Missing info", "Full name and phone are required.");
      return;
    }
    if (!isValidPhone(payload.phone)) {
      Alert.alert("Invalid phone", "Phone number must be 10 digits.");
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
      Alert.alert("Success", "Profile updated.");
    } catch (err) {
      Alert.alert("Update failed", err.message);
    }
  };

  const handleAssignStores = async () => {
    if (!assignEmployeeId) {
      Alert.alert("Missing info", "Select an employee.");
      return;
    }
    if (assignStoreIds.length === 0) {
      Alert.alert("Missing info", "Select at least one store.");
      return;
    }
    try {
      await apiFetch(`/employees/${assignEmployeeId}/store`, {
        method: "PATCH",
        body: JSON.stringify({ storeIds: assignStoreIds }),
      });
      setAssignStoreIds([]);
      await loadEmployees();
    } catch (err) {
      Alert.alert("Assign failed", err.message);
    }
  };

  const storeOptions = useMemo(() => stores, [stores]);
  const employeeOptions = useMemo(() => employees, [employees]);
  const staffMembers = useMemo(
    () => employees.filter((employee) => employee.role !== "DIRECTOR"),
    [employees]
  );
  const staffRoleOptions = useMemo(() => {
    if (role === "DIRECTOR") {
      return ["MANAGER", "STAFF", "STORE_MANAGER", "SALES_EXECUTIVE"];
    }
    return ["STAFF", "STORE_MANAGER", "SALES_EXECUTIVE"];
  }, [role]);
  const storeNameById = useMemo(() => {
    const map = {};
    stores.forEach((store) => {
      if (store?._id) map[store._id] = store.name || "Unnamed store";
    });
    return map;
  }, [stores]);
  const storeIdByName = useMemo(() => {
    const map = {};
    stores.forEach((store) => {
      if (store?.name && store?._id) {
        map[store.name] = store._id;
      }
    });
    return map;
  }, [stores]);

  const getEmployeeStoreLabel = (employee) => {
    if (Array.isArray(employee?.storeNames) && employee.storeNames.length > 0) {
      return employee.storeNames.join(", ");
    }
    const rawIds =
      employee?.storeIds ??
      employee?.stores ??
      employee?.storeId ??
      employee?.store;
    const ids = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];
    const names = ids
      .map((value) => {
        if (!value) return null;
        if (typeof value === "string") return storeNameById[value];
        if (typeof value === "object") {
          if (value.name) return value.name;
          if (value._id) return storeNameById[value._id];
        }
        return null;
      })
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "None";
  };
  const selectedShopLabel = employeeStoreFilter
    ? storeNameById[employeeStoreFilter] || "Selected shop"
    : "All shops";

  const getEmployeeStoreIds = (employee) => {
    const rawIds =
      employee?.storeIds ??
      employee?.stores ??
      employee?.storeId ??
      employee?.store;
    const ids = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];
    const normalized = ids
      .map((value) => {
        if (!value) return null;
        if (typeof value === "string") return value;
        if (typeof value === "object") return value._id || null;
        return null;
      })
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
    if (Array.isArray(employee?.storeNames) && employee.storeNames.length > 0) {
      return employee.storeNames
        .map((name) => storeIdByName[name])
        .filter(Boolean);
    }
    return [];
  };

  const filteredStaffMembers = useMemo(() => {
    if (!staffStoreFilter) return [];
    const filterId = String(staffStoreFilter);
    return staffMembers.filter((employee) => {
      const ids = getEmployeeStoreIds(employee).map(String);
      return ids.includes(filterId);
    });
  }, [staffMembers, staffStoreFilter, storeIdByName]);

  const filteredEmployees = useMemo(() => {
    if (!employeeStoreFilter) return employees;
    return employees.filter((employee) => {
      const ids = getEmployeeStoreIds(employee);
      return ids.includes(employeeStoreFilter);
    });
  }, [employees, employeeStoreFilter, storeIdByName]);

  const attendanceStoreOptions = useMemo(() => {
    if (role === "DIRECTOR" || role === "MANAGER") return storeOptions;
    const allowed = Array.isArray(profile?.storeIds)
      ? profile.storeIds.map((id) => String(id))
      : [];
    return storeOptions.filter((store) =>
      allowed.includes(String(store._id))
    );
  }, [role, profile, storeOptions]);

  const selectedAttendanceStoreLabel = attendanceStoreId
    ? storeNameById[attendanceStoreId] || "Select store"
    : "Select store";
  const selectedStaffStoreLabel = staffStoreFilter
    ? storeNameById[staffStoreFilter] || "Selected store"
    : "Select store";

  const formatTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatMinutes = (minutes) => {
    const total = Number(minutes) || 0;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDuration = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const liveTotalSeconds = useMemo(() => {
    const baseMinutes = Number(attendance?.totalMinutes) || 0;
    let seconds = baseMinutes * 60;
    if (attendance?.openShift?.clockIn) {
      const start = new Date(attendance.openShift.clockIn).getTime();
      if (!Number.isNaN(start)) {
        seconds += Math.max(0, Math.floor((clockTick - start) / 1000));
      }
    }
    return seconds;
  }, [attendance, clockTick]);

  const handleClockIn = async () => {
    if (!attendanceStoreId) {
      Alert.alert("Missing info", "Select a store to clock in.");
      return;
    }
    try {
      await apiFetch("/attendance/clock-in", {
        method: "POST",
        body: JSON.stringify({ storeId: attendanceStoreId }),
      });
      await loadAttendanceToday();
      Alert.alert("Clocked in", "Have a great shift.");
    } catch (err) {
      Alert.alert("Clock-in failed", err.message);
    }
  };

  const handleClockOut = async () => {
    if (!attendanceStoreId) {
      Alert.alert("Missing info", "Select a store to clock out.");
      return;
    }
    if (
      attendance?.openShift?.storeId &&
      String(attendance.openShift.storeId) !== String(attendanceStoreId)
    ) {
      Alert.alert("Store mismatch", "Select the same store you clocked in to.");
      return;
    }
    try {
      await apiFetch("/attendance/clock-out", {
        method: "POST",
        body: JSON.stringify({ storeId: attendanceStoreId }),
      });
      await loadAttendanceToday();
      Alert.alert("Clocked out", "Shift closed.");
    } catch (err) {
      Alert.alert("Clock-out failed", err.message);
    }
  };

  if (!token) {
    return (

       
<ScrollView>
      <ImageBackground
        source={require("./assets/logo.png")}
        style={styles.authBackground}
        resizeMode="contain"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.authOverlay}
        >
          <View style={styles.mainView} contentContainerStyle={styles.authContent}>
            <Image
            source={require("./assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          {authMode === "login" ? (
            <View style={styles.card}>
              <Field
                label="Email"
                value={loginForm.email}
                onChangeText={(value) =>
                  setLoginForm((prev) => ({ ...prev, email: value }))
                }
                placeholder="name@company.com"
              />
              <Field
                label="Password"
                value={loginForm.password}
                onChangeText={(value) =>
                  setLoginForm((prev) => ({ ...prev, password: value }))
                }
                secure={!showLoginPassword}
                placeholder="••••••••"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowLoginPassword((prev) => !prev)}
              >
                <Text style={styles.eyeText}>
                  {showLoginPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleLogin}>
                <Text style={styles.primaryBtnText}>Login</Text>
              </Pressable>
              <Pressable
                style={styles.linkButton}
                onPress={() => {
                  setAuthMode("forgot");
                  setForgotEmail("");
                }}
              >
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Field
                label="Email"
                value={forgotEmail}
                onChangeText={setForgotEmail}
                placeholder="Email"
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleForgotPassword}
              >
                <Text style={styles.primaryBtnText}>Send reset link</Text>
              </Pressable>
              <Text style={styles.hintText}>
                We will send a reset link to your email.
              </Text>
              <Pressable
                style={styles.linkButton}
                onPress={() => setAuthMode("login")}
              >
                <Text style={styles.linkText}>Back to login</Text>
              </Pressable>
            </View>
          )}
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
      </ScrollView>
    );
  }

  return (
    <ImageBackground
      source={require("./assets/logo.png")}
      style={styles.appBackground}
      imageStyle={styles.appBackgroundImage}
      resizeMode="contain"
    >
      <View style={styles.appWrap}>
      <View style={styles.header}>
        <View>
          <Image
            source={require("./assets/logo.png")}
            style={styles.logoInHome}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.menuBtn}
            onPress={() => setMenuOpen(true)}
          >
            <Text style={styles.menuText}>Menu</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        transparent
        visible={menuOpen}
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={styles.sidebar}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.sidebarTitle}>MENU</Text>
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setActiveNav(item.id);
                    setMenuOpen(false);
                  }}
                  style={[
                    styles.sidebarItem,
                    activeNav === item.id && styles.sidebarItemActive,
                  ]}
                >
                  <Text style={styles.sidebarText}>{item.label}</Text>
                </Pressable>
              ))}
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setToken("");
              }}
              style={[styles.sidebarItem, styles.sidebarLogout]}
            >
              <Text style={styles.sidebarText}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.body}>
        {activeNav === "profile" && (
          
          <Section>
            <Text style={styles.profileHead}>YOUR PROFILE</Text>
            <View style={styles.profileCard}>
              <View style={styles.custInfo}>
                <View >
              <Text style={styles.profileName}>{profile?.fullName}</Text>
              <Text style={styles.profileMeta}>{profile?.email}</Text>
              <Text style={styles.profileMeta}>{profile?.phone || ""}</Text>
              </View>
              <Badge label={profile?.role || ""} />
              </View>
              <View style={styles.profileRow}>
              </View>
              <View style={styles.profileRow}>
                
                <Text
                  style={
                    profile?.isActive === false
                      ? styles.statusInactive
                      : styles.statusActive
                  }
                >
                  {profile?.isActive === false ? "Inactive" : "Active"}
                </Text>
              </View>
              <Text style={styles.profileMeta}>Stores</Text>
              <Text style={styles.profileStores}>
                {Array.isArray(profile?.storeNames) &&
                profile.storeNames.length > 0
                  ? profile.storeNames.join(", ")
                  : "All stores"}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Attendance Summary</Text>
              <View style={styles.filterRow}>
                {["day", "week", "month"].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setAttendanceRange(value)}
                    style={[
                      styles.toggleBtn,
                      attendanceRange === value && styles.toggleBtnActive,
                    ]}
                  >
                    <Text style={styles.toggleText}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.profileMeta}>
                Total hours: {formatMinutes(attendanceSummary?.totalMinutes)}
              </Text>
              {attendanceSummary?.from && attendanceSummary?.to && (
                <Text style={styles.profileMeta}>
                  Range: {attendanceSummary.from} to {attendanceSummary.to}
                </Text>
              )}
            </View>
            
            <View style={styles.card}>
              <Field
                label="Full name"
                value={profileForm.fullName}
                onChangeText={(value) =>
                  setProfileForm((prev) => ({ ...prev, fullName: value }))
                }
              />
              <Field
                label="Phone"
                value={profileForm.phone}
                onChangeText={(value) =>
                  setProfileForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <Field
                label="Email"
                value={profileForm.email}
                onChangeText={(value) =>
                  setProfileForm((prev) => ({ ...prev, email: value }))
                }
              />
              <Field
                label="New password (optional)"
                value={profileForm.password}
                onChangeText={(value) =>
                  setProfileForm((prev) => ({ ...prev, password: value }))
                }
                secure
              />
              <Pressable style={styles.primaryBtn} onPress={handleUpdateProfile}>
                <Text style={styles.primaryBtnText}>Update profile</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {activeNav === "shops" && !isStaffOnly && canManageStores && (
          <Section title="Create store">
            <View style={styles.card}>
              <Field
                label="Name"
                value={storeForm.name}
                onChangeText={(value) =>
                  setStoreForm((prev) => ({ ...prev, name: value }))
                }
              />
              <Field
                label="Address"
                value={storeForm.address}
                onChangeText={(value) =>
                  setStoreForm((prev) => ({ ...prev, address: value }))
                }
              />
              <Field
                label="Phone"
                value={storeForm.phone}
                onChangeText={(value) =>
                  setStoreForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <Field
                label="Email"
                value={storeForm.email}
                onChangeText={(value) =>
                  setStoreForm((prev) => ({ ...prev, email: value }))
                }
              />
              <Pressable style={styles.primaryBtn} onPress={handleCreateStore}>
                <Text style={styles.primaryBtnText}>Create store</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* {activeNav === "everyone" && !isStaffOnly && canManageEmployees && (
          <Section title="Create employee">
            <View style={styles.card}>
              <Field
                label="Full name"
                value={employeeForm.fullName}
                onChangeText={(value) =>
                  setEmployeeForm((prev) => ({ ...prev, fullName: value }))
                }
              />
              <Field
                label="Phone"
                value={employeeForm.phone}
                onChangeText={(value) =>
                  setEmployeeForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <Field
                label="Email"
                value={employeeForm.email}
                onChangeText={(value) =>
                  setEmployeeForm((prev) => ({ ...prev, email: value }))
                }
              />
              <Field
                label="Password"
                value={employeeForm.password}
                onChangeText={(value) =>
                  setEmployeeForm((prev) => ({ ...prev, password: value }))
                }
                secure
              />
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                {[
                  "SALES_EXECUTIVE",
                  "STORE_MANAGER",
                  "MANAGER",
                  "DIRECTOR",
                ].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setEmployeeForm((prev) => ({ ...prev, role: value }))
                    }
                    style={[
                      styles.roleChip,
                      employeeForm.role === value && styles.roleChipActive,
                    ]}
                  >
                    <Text style={styles.roleText}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Stores</Text>
              <MultiSelect
                items={storeOptions}
                selected={employeeForm.storeIds}
                onToggle={(id) =>
                  setEmployeeForm((prev) => ({
                    ...prev,
                    storeIds: toggleStoreSelection(prev.storeIds, id),
                  }))
                }
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleCreateEmployee}
              >
                <Text style={styles.primaryBtnText}>Create employee</Text>
              </Pressable>
            </View>
          </Section>
        )} */}

        {activeNav === "everyone" && !isStaffOnly && (
          <Section title="">
            <View style={styles.card}>
              <Text style={styles.profileMeta}>
                {attendance?.openShift
                  ? `Clocked in at ${formatTime(attendance.openShift.clockIn)}`
                  : "Not clocked in"}
              </Text>
              <Text style={styles.profileMeta}>
                Today total: {formatDuration(liveTotalSeconds)}
              </Text>
              <View style={styles.dropdown}>
                <Pressable
                  style={styles.dropdownHeader}
                  onPress={() => setAttendanceStoreOpen((prev) => !prev)}
                >
                  <Text style={styles.dropdownHeaderText}>
                    {selectedAttendanceStoreLabel}
                  </Text>
                  <Text style={styles.dropdownChevron}>
                    {attendanceStoreOpen ? "^" : "v"}
                  </Text>
                </Pressable>
                {attendanceStoreOpen && (
                  <View style={styles.dropdownList}>
                    {attendanceStoreOptions.length === 0 ? (
                      <View style={styles.dropdownItem}>
                        <Text style={styles.dropdownItemText}>
                          No stores available
                        </Text>
                      </View>
                    ) : (
                      attendanceStoreOptions.map((store) => (
                        <Pressable
                          key={store._id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setAttendanceStoreId(store._id);
                            setAttendanceStoreOpen(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>
                            {store.name}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>
              <Pressable
                style={styles.primaryBtn}
                onPress={
                  attendance?.openShift ? handleClockOut : handleClockIn
                }
              >
                <Text style={styles.primaryBtnText}>
                  {attendance?.openShift ? "Clock out" : "Clock in"}
                </Text>
              </Pressable>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text
                    style={[styles.tableHeaderText, styles.tableCellStore]}
                  >
                    Store
                  </Text>
                  <Text
                    style={[styles.tableHeaderText, styles.tableCellTime]}
                  >
                    In
                  </Text>
                  <Text
                    style={[styles.tableHeaderText, styles.tableCellTime]}
                  >
                    Out
                  </Text>
                  <Text
                    style={[styles.tableHeaderText, styles.tableCellMinutes]}
                  >
                    Total
                  </Text>
                </View>
                {attendance?.shifts?.length > 0 ? (
                  attendance.shifts.map((shift) => (
                    <View key={shift._id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.tableCellStore]}>
                        {storeNameById[String(shift.storeId)] || "Store"}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellTime]}>
                        {formatTime(shift.clockIn)}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellTime]}>
                        {shift.clockOut ? formatTime(shift.clockOut) : "—"}
                      </Text>
                      <Text
                        style={[styles.tableCell, styles.tableCellMinutes]}
                      >
                        {shift.clockOut
                          ? formatMinutes(shift.totalMinutes)
                          : "—"}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>No shifts today</Text>
                  </View>
                )}
              </View>
            </View>
          </Section>
        )}


        
        {activeNav === "shops" && !isStaffOnly && (
          <Section title="Stores">
            <FlatList
              data={stores}
              scrollEnabled={false}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <Text style={styles.listTitle}>{item.name}</Text>
                  <Text style={styles.listMeta}>
                    {item.address || "No address"}
                  </Text>
                  <Text style={styles.listMeta}>{item.email || "No email"}</Text>
                </View>
              )}
            />
          </Section>
        )}

        

        {activeNav === "staff" && (role === "DIRECTOR" || role === "MANAGER") && (
          <Section title="Staff">
            <Text style={styles.label}>Filter by store</Text>
            <View style={styles.dropdown}>
              <Pressable
                style={styles.dropdownHeader}
                onPress={() => setStaffStoreOpen((prev) => !prev)}
              >
                <Text style={styles.dropdownHeaderText}>
                  {selectedStaffStoreLabel}
                </Text>
                <Text style={styles.dropdownChevron}>
                  {staffStoreOpen ? "^" : "v"}
                </Text>
              </Pressable>
              {staffStoreOpen && (
                <View style={styles.dropdownList}>
                  {storeOptions.map((store) => (
                    <Pressable
                      key={store._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setStaffStoreFilter(String(store._id));
                        setStaffStoreOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{store.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            {staffStoreFilter ? (
              <FlatList
                data={filteredStaffMembers}
                scrollEnabled={false}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.staffListItem}>
                    <Text style={styles.listTitle}>{item.fullName}</Text>
                    <Text style={styles.listMeta}>
                      Stores: {item.storeNames?.join(", ") || "None"}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.listMeta}>No staff for this store.</Text>
                }
              />
            ) : null}
            <View style={styles.card}>
              <Text style={styles.label}>
                {role === "DIRECTOR" ? "Create staff or manager" : "Create staff"}
              </Text>
              <Field
                label="Full name"
                value={staffForm.fullName}
                onChangeText={(value) =>
                  setStaffForm((prev) => ({ ...prev, fullName: value }))
                }
              />
              <Field
                label="Phone"
                value={staffForm.phone}
                onChangeText={(value) =>
                  setStaffForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <Field
                label="Email"
                value={staffForm.email}
                onChangeText={(value) =>
                  setStaffForm((prev) => ({ ...prev, email: value }))
                }
              />
              <Field
                label="Password"
                value={staffForm.password}
                onChangeText={(value) =>
                  setStaffForm((prev) => ({ ...prev, password: value }))
                }
                secure
              />
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                {staffRoleOptions.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setStaffForm((prev) => ({ ...prev, role: value }))
                    }
                    style={[
                      styles.roleChip,
                      staffForm.role === value && styles.roleChipActive,
                    ]}
                  >
                    <Text style={styles.roleText}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Stores</Text>
              <MultiSelect
                items={storeOptions}
                selected={staffForm.storeIds}
                onToggle={(id) =>
                  setStaffForm((prev) => ({
                    ...prev,
                    storeIds: toggleStoreSelection(prev.storeIds, id),
                  }))
                }
              />
              <Pressable style={styles.primaryBtn} onPress={handleCreateStaff}>
                <Text style={styles.primaryBtnText}>Create staff</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {activeNav === "settings" && (
          <Section title="Settings">
            <View style={styles.card}>
              <Text style={styles.profileMeta}>Role</Text>
              <Text style={styles.profileStores}>{profile?.role || "—"}</Text>
              <Text style={styles.profileMeta}>API</Text>
              <Text style={styles.profileStores}>{API_BASE}</Text>
              <Pressable style={styles.ghostBtn} onPress={() => setToken("")}>
                <Text style={styles.ghostText}>Sign out</Text>
              </Pressable>
            </View>
          </Section>
        )}
      </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  logo:{
    height:150,
    width:150,
    alignSelf: "center",
  },
  logoInHome:{
    height:100,
    width:100,
    alignSelf: "center",
  },
  profileHead:{
    display: "flex",
    alignItems:"center",
    justifyContent:"center",
    fontSize: 30,
    fontWeight:"bold",
    color:"#919191"
  },
  mainView:{
    marginTop: 70
  },
  authBackground: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  authOverlay: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
  },
  authContent: {
    padding: 24,
    paddingTop: 64,
    gap: 16,
  },
  appBackground: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  appBackgroundImage: {
    opacity: 0.08,
  },
  appWrap: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  body: {
    paddingHorizontal: 20,
    gap: 18,
    paddingBottom: 80,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  menuBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  menuText: {
    color: "#111827",
    fontWeight: "600",
  },
  brand: {
    color: "#111827",
    fontSize: 30,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flexDirection: "row",
  },
  sidebar: {
    width: 240,
    backgroundColor: "#ffffff",
    paddingTop: 60,
    paddingHorizontal: 16,
    gap: 12,
  },
  sidebarTitle: {
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 8,
  },
  sidebarItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#000000",
    backgroundColor: "#f9fafb",
  },
  sidebarItemActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#e0f2fe",
  },
  sidebarLogout: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  sidebarText: {
    color: "#111827",
    fontWeight: "600",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: "#4b5563",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
    margin:20
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor:"white",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#d8a1a1",
  },
  toggleText: {
    color: "#111827",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 16,
    marginTop:20,
    gap: 12,
    border:"none",
  
  
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "600",
  },
  label: {
    color: "#4b5563",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  field: {
    gap: 6,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    color: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtn: {
    backgroundColor: "#e0f2fe",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: {
    color: "#111827",
    fontWeight: "700",
  },
  eyeButton: {
    alignSelf: "flex-end",
    marginTop: -4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eyeText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  linkButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  linkText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  cardNested: {
    marginTop: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ghostText: {
    color: "#111827",
  },
  badge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  profileCard: {
    backgroundColor: "#65b2eb",
    borderRadius: 10,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  profileName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "600",
  },
  profileMeta: {
    color: "#4b5563",
  },
  custInfo:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between"
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  profileStores: {
    color: "#111827",
  },
  statusActive: {
    color: "#16a34a",
    fontWeight: "700",
  },
  statusInactive: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  multiSelect: {
    gap: 8,
  },
  selectItem: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectItemActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#e0f2fe",
  },
  selectText: {
    color: "#111827",
    fontWeight: "600",
  },
  selectMeta: {
    color: "#4b5563",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  dropdownHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
  },
  dropdownHeaderText: {
    color: "#111827",
    fontWeight: "600",
  },
  dropdownChevron: {
    color: "#6b7280",
    fontWeight: "600",
  },
  dropdownList: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  dropdownItemText: {
    color: "#111827",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleChipActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#e0f2fe",
  },
  roleText: {
    color: "#111827",
    fontSize: 12,
  },
  listItem: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#000000",
  },
  staffListItem: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0,
    borderColor: "#000000",
  },
  listItemPressed: {
    backgroundColor: "#f3f4f6",
  },
  listTitle: {
    color: "#111827",
    fontWeight: "600",
  },
  listMeta: {
    color: "#4b5563",
    marginTop: 2,
  },
  table: {
    borderWidth: 0.5,
    borderColor: "#000000",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "none",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
  },
  tableHeaderRow: {
    backgroundColor: "gray",
  },
  tableHeaderText: {
    color: "#111827",
    fontWeight: "700",
  },
  tableCell: {
    color: "#111827",
    flex: 1,
  },
  tableCellName: {
    flex: 0.4,
  },
  tableCellShops: {
    flex: 0.6,
  },
  tableCellStore: {
    flex: 0.45,
  },
  tableCellTime: {
    flex: 0.18,
  },
  tableCellMinutes: {
    flex: 0.19,
    textAlign: "right",
  },
  hintCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  hintTitle: {
    color: "#111827",
    fontWeight: "600",
  },
  hintText: {
    color: "#4b5563",
  },
});
