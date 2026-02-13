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
const initialSignup = {
  fullName: "",
  phone: "",
  email: "",
  password: "",
  storeIds: [],
};
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
  role: "SALES_EXECUTIVE",
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

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
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

  const [loginForm, setLoginForm] = useState(initialLogin);
  const [signupForm, setSignupForm] = useState(initialSignup);
  // authMode: "login" | "signup" | "forgot"
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
       { id: "staff", label: "Staff", show: role === "DIRECTOR" },
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

  const loadAuthed = async () => {
    await Promise.all([loadProfile(), loadStores(), loadEmployees()]);
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

  const handleSignup = async () => {
    const { fullName, phone, email, password, storeIds } = signupForm;
    if (!fullName || !phone || !email || !password) {
      Alert.alert("Missing info", "All fields are required.");
      return;
    }
    if (storeIds.length === 0) {
      Alert.alert("Missing info", "Select at least one store.");
      return;
    }
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, phone, email, password, storeIds }),
      });
      setSignupForm(initialSignup);
      setAuthMode("login");
      Alert.alert("Verify email", "Check your email to verify your account.");
    } catch (err) {
      Alert.alert("Sign up failed", err.message);
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
    if (role !== "DIRECTOR" && storeIds.length === 0) {
      Alert.alert("Missing info", "Select at least one store.");
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
      Alert.alert("Create employee failed", err.message);
    }
  };

  const handleCreateStaff = async () => {
    const { fullName, phone, email, password, storeIds } = staffForm;
    if (!fullName || !phone || !email || !password) {
      Alert.alert("Missing info", "All fields are required.");
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
          phone,
          email,
          password,
          role: "STAFF",
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
      phone: profileForm.phone.trim(),
      email: profileForm.email.trim(),
    };

    if (!payload.fullName || !payload.phone) {
      Alert.alert("Missing info", "Full name and phone are required.");
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
    () => employees.filter((employee) => employee.role === "STAFF"),
    [employees]
  );
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

  const filteredEmployees = useMemo(() => {
    if (!employeeStoreFilter) return employees;
    return employees.filter((employee) => {
      const ids = getEmployeeStoreIds(employee);
      return ids.includes(employeeStoreFilter);
    });
  }, [employees, employeeStoreFilter, storeIdByName]);

  if (!token) {
    return (

       

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
          {authMode !== "forgot" && (
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setAuthMode("login")}
                style={[
                  styles.toggleBtn,
                  authMode === "login" && styles.toggleBtnActive,
                ]}
              >
                <Text style={styles.toggleText}>Login</Text>
              </Pressable>
              <Pressable
                onPress={() => setAuthMode("signup")}
                style={[
                  styles.toggleBtn,
                  authMode === "signup" && styles.toggleBtnActive,
                ]}
              >
                <Text style={styles.toggleText}>Sign Up</Text>
              </Pressable>
            </View>
          )}

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
          ) : authMode === "signup" ? (
            <View style={styles.card}>
              <Field
                label="Full name"
                value={signupForm.fullName}
                onChangeText={(value) =>
                  setSignupForm((prev) => ({ ...prev, fullName: value }))
                }
              />
              <Field
                label="Phone"
                value={signupForm.phone}
                onChangeText={(value) =>
                  setSignupForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <Field
                label="Email"
                value={signupForm.email}
                onChangeText={(value) =>
                  setSignupForm((prev) => ({ ...prev, email: value }))
                }
              />
              <Field
                label="Password"
                value={signupForm.password}
                onChangeText={(value) =>
                  setSignupForm((prev) => ({ ...prev, password: value }))
                }
                secure
              />
              <Text style={styles.label}>Select stores</Text>
              <MultiSelect
                items={storeOptions}
                selected={signupForm.storeIds}
                onToggle={(id) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    storeIds: toggleStoreSelection(prev.storeIds, id),
                  }))
                }
              />
              <Pressable style={styles.primaryBtn} onPress={handleSignup}>
                <Text style={styles.primaryBtnText}>Create account</Text>
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
    );
  }

  return (
    <ImageBackground
      source={require("./assets/logo.png")}
      style={styles.authBackground}
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
          <Section title="Profile">
            <View style={styles.profileCard}>
              <Text style={styles.profileName}>{profile?.fullName}</Text>
              <Text style={styles.profileMeta}>{profile?.email}</Text>
              <View style={styles.profileRow}>
                <Badge label={profile?.role || ""} />
                <Text style={styles.profileMeta}>{profile?.phone || ""}</Text>
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
          <Section title="Employee List">
            <Text style={styles.label}>Filter by shop</Text>
            <View style={styles.dropdown}>
              <Pressable
                style={styles.dropdownHeader}
                onPress={() => setShopFilterOpen((prev) => !prev)}
              >
                <Text style={styles.dropdownHeaderText}>
                  {selectedShopLabel}
                </Text>
                <Text style={styles.dropdownChevron}>
                  {shopFilterOpen ? "^" : "v"}
                </Text>
              </Pressable>
              {shopFilterOpen && (
                <View style={styles.dropdownList}>
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={() => {
                      setEmployeeStoreFilter("");
                      setShopFilterOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>All shops</Text>
                  </Pressable>
                  {storeOptions.map((store) => (
                    <Pressable
                      key={store._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setEmployeeStoreFilter(store._id);
                        setShopFilterOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{store.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.tableHeaderText, styles.tableCellName]}>
                  Name
                </Text>
                <Text style={[styles.tableHeaderText, styles.tableCellShops]}>
                  Shops
                </Text>
              </View>
              {filteredEmployees.length === 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>
                    {employeeStoreFilter
                      ? "No employees for selected shop(s)"
                      : "No employees found"}
                  </Text>
                </View>
              ) : (
                filteredEmployees.map((employee) => (
                  <View key={employee._id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellName]}>
                      {employee.fullName}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellShops]}>
                      {getEmployeeStoreLabel(employee)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Section>
        )}
        
        {activeNav === "everyone" && !isStaffOnly && canManageEmployees && (
          <Section title="Assign stores">
            <View style={styles.card}>
              <Text style={styles.label}>Employee</Text>
              <View style={styles.multiSelect}>
                {employeeOptions.map((employee) => (
                  <Pressable
                    key={employee._id}
                    onPress={() => setAssignEmployeeId(employee._id)}
                    style={[
                      styles.selectItem,
                      assignEmployeeId === employee._id &&
                        styles.selectItemActive,
                    ]}
                  >
                    <Text style={styles.selectText}>{employee.fullName}</Text>
                    <Text style={styles.selectMeta}>{employee.role}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Stores</Text>
              <MultiSelect
                items={storeOptions}
                selected={assignStoreIds}
                onToggle={(id) =>
                  setAssignStoreIds((prev) => toggleStoreSelection(prev, id))
                }
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleAssignStores}
              >
                <Text style={styles.primaryBtnText}>Save assignment</Text>
              </Pressable>
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

        

        {activeNav === "staff" && role === "DIRECTOR" && (
          <Section title="Staff">
            <FlatList
              data={staffMembers}
              scrollEnabled={false}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={styles.staffListItem}>
                  <Text style={styles.listTitle}>{item.fullName}</Text>
                  <Text style={styles.listMeta}>{item.email || "No email"}</Text>
                  <Text style={styles.listMeta}>
                    Stores: {item.storeNames?.join(", ") || "None"}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.listMeta}>No staff found.</Text>
              }
            />
            <View style={styles.card}>
              <Text style={styles.label}>Create staff</Text>
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
    padding: 20,
    gap: 18,
    paddingBottom: 80,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#f3f4f6",
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
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
    borderWidth: 2,
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
