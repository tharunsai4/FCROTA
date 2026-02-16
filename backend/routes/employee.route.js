const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Employee = require("../models/employeeSchema");
const Store = require("../models/storeSchema");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const getSafeEmployee = (employee) => {
  if (!employee) return null;
  const obj = employee.toObject ? employee.toObject() : employee;
  delete obj.password;
  return obj;
};

const normalizeStoreIds = (storeId, storeIds) => {
  if (Array.isArray(storeIds) && storeIds.length > 0) return storeIds;
  if (storeId) return [storeId];
  return [];
};

const resolveStores = async (storeIds) => {
  if (!storeIds || storeIds.length === 0) return [];
  const uniqueIds = [...new Set(storeIds.map((id) => String(id)))];
  const stores = await Store.find({
    _id: { $in: uniqueIds },
    isActive: { $ne: false },
  });
  if (stores.length !== uniqueIds.length) return null;
  const storeMap = new Map(stores.map((s) => [String(s._id), s]));
  return uniqueIds.map((id) => storeMap.get(id));
};

const canManageEmployees = requireRole(["DIRECTOR", "MANAGER"]);
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildResetLink = (baseUrl, token) => {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${token}`;
};

const buildVerifyLink = (baseUrl, token) => {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}verifyToken=${token}`;
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const sendVerificationEmail = async (employee) => {
  if (!process.env.VERIFY_URL) {
    throw new Error("VERIFY_URL not set");
  }
  const transporter = createTransporter();
  if (!transporter || !process.env.SMTP_FROM) {
    throw new Error("Email not configured");
  }

  const verifyToken = crypto.randomBytes(32).toString("hex");
  employee.emailVerifyToken = hashToken(verifyToken);
  employee.emailVerifyExpires = new Date(Date.now() + 30 * 60 * 1000);
  await employee.save();

  const verifyLink = buildVerifyLink(process.env.VERIFY_URL, verifyToken);

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: employee.email,
    subject: "Verify your email",
    text: `Verify your email using this link: ${verifyLink}`,
    html: `
      <p>Thanks for signing up.</p>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verifyLink}">${verifyLink}</a></p>
      <p>This link expires in 30 minutes.</p>
    `,
  });
};

// Register employee and issue token
// Bootstrap first director (only works if no director exists)
router.post("/auth/bootstrap-director", async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET not set" });
    }

    const { password, email, storeId, storeIds, ...rest } = req.body;
    if (!password || !email) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existingDirector = await Employee.exists({ role: "DIRECTOR" });
    if (existingDirector) {
      return res
        .status(403)
        .json({ error: "Director already exists" });
    }

    const inputStoreIds = normalizeStoreIds(storeId, storeIds);
    let stores = [];
    if (inputStoreIds.length > 0) {
      stores = await resolveStores(inputStoreIds);
      if (!stores) {
        return res.status(400).json({ error: "Store not found" });
      }
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const createPayload = {
      ...rest,
      email,
      role: "DIRECTOR",
      isEmailVerified: true,
      password: hashed,
    };
    if (stores.length > 0) {
      createPayload.storeIds = stores.map((s) => s._id);
      createPayload.storeNames = stores.map((s) => s.name);
    }
    const employee = await Employee.create(createPayload);

    const token = jwt.sign(
      { id: employee._id, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(201).json({ token, employee: getSafeEmployee(employee) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Register employee and issue token
router.post("/auth/register", async (req, res) => {
  return res
    .status(403)
    .json({ error: "Sign up is disabled. Contact an admin." });
});

// Login and issue token
router.post("/auth/login", async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET not set" });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const employee = await Employee.findOne({ email: normalizedEmail }).select(
      "+password"
    );
    if (!employee) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, employee.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: employee._id, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({ token, employee: getSafeEmployee(employee) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Request password reset link
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const employee = await Employee.findOne({ email: normalizedEmail });
    if (!employee) {
      // Avoid user enumeration
      return res.json({ message: "If the email exists, a reset link was sent" });
    }

    if (!process.env.RESET_URL) {
      return res.status(500).json({ error: "RESET_URL not set" });
    }

    const transporter = createTransporter();
    if (!transporter || !process.env.SMTP_FROM) {
      return res.status(500).json({ error: "Email not configured" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    employee.resetPasswordToken = hashToken(resetToken);
    employee.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await employee.save();

    const resetLink = buildResetLink(process.env.RESET_URL, resetToken);

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: employee.email,
      subject: "Reset your password",
      text: `Reset your password using this link: ${resetLink}`,
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link expires in 30 minutes.</p>
      `,
    });

    return res.json({ message: "Reset link sent" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Reset password using token
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password required" });
    }

    const hashed = hashToken(token);
    const employee = await Employee.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password");

    if (!employee) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    employee.password = await bcrypt.hash(password, 10);
    employee.resetPasswordToken = undefined;
    employee.resetPasswordExpires = undefined;
    await employee.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Verify email using token
router.get("/auth/verify-email", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    const hashed = hashToken(token);
    const employee = await Employee.findOne({
      emailVerifyToken: hashed,
      emailVerifyExpires: { $gt: new Date() },
    });

    if (!employee) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    employee.isEmailVerified = true;
    employee.emailVerifyToken = undefined;
    employee.emailVerifyExpires = undefined;
    await employee.save();

    return res.json({ message: "Email verified" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Resend verification email
router.post("/auth/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const employee = await Employee.findOne({ email: normalizedEmail });
    if (!employee) {
      return res.json({ message: "If the email exists, a link was sent" });
    }
    if (employee.isEmailVerified === true) {
      return res.json({ message: "Email already verified" });
    }

    await sendVerificationEmail(employee);
    return res.json({ message: "Verification email sent" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Example protected route
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id);
    return res.json(getSafeEmployee(employee));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update own profile
router.patch("/auth/me", requireAuth, async (req, res) => {
  try {
    const { fullName, phone, email, password } = req.body;
    const updates = {};

    if (typeof fullName === "string" && fullName.trim()) {
      updates.fullName = fullName.trim();
    }
    if (typeof phone === "string" && phone.trim()) {
      updates.phone = phone.trim();
    }
    if (typeof email === "string" && email.trim()) {
      updates.email = email.trim().toLowerCase();
    }
    if (typeof password === "string" && password.trim()) {
      updates.password = await bcrypt.hash(password.trim(), 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    if (updates.email) {
      const existing = await Employee.findOne({
        email: updates.email,
        _id: { $ne: req.user.id },
      });
      if (existing) {
        return res.status(409).json({ error: "Email already in use" });
      }
    }

    const employee = await Employee.findById(req.user.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    Object.assign(employee, updates);
    await employee.save();

    return res.json(getSafeEmployee(employee));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Create employee (requires password in body)
router.post("/employees", requireAuth, canManageEmployees, async (req, res) => {
  try {
    const { password, storeId, storeIds, ...rest } = req.body;
    const role = String(rest.role || "STAFF").toUpperCase();
    const creatorRole = req.user?.role;
    const allowedForDirector = [
      "MANAGER",
      "STAFF",
      "STORE_MANAGER",
      "SALES_EXECUTIVE",
    ];
    const allowedForManager = ["STAFF", "STORE_MANAGER", "SALES_EXECUTIVE"];
    if (role === "DIRECTOR") {
      return res.status(403).json({ error: "Cannot create director" });
    }
    if (creatorRole === "DIRECTOR" && !allowedForDirector.includes(role)) {
      return res.status(403).json({ error: "Role not allowed" });
    }
    if (creatorRole === "MANAGER" && !allowedForManager.includes(role)) {
      return res.status(403).json({ error: "Role not allowed" });
    }
    const inputStoreIds = normalizeStoreIds(storeId, storeIds);
    if (!password) {
      return res.status(400).json({ error: "Password required" });
    }
    let stores = [];
    if (role !== "DIRECTOR") {
      if (inputStoreIds.length === 0) {
        return res.status(400).json({ error: "storeId or storeIds required" });
      }
      stores = await resolveStores(inputStoreIds);
      if (!stores) {
        return res.status(400).json({ error: "Store not found" });
      }
    } else if (inputStoreIds.length > 0) {
      stores = await resolveStores(inputStoreIds);
      if (!stores) {
        return res.status(400).json({ error: "Store not found" });
      }
    }
    const hashed = await bcrypt.hash(password, 10);
    const createPayload = {
      ...rest,
      role,
      password: hashed,
      isEmailVerified: true,
    };
    if (typeof createPayload.email === "string" && createPayload.email.trim()) {
      createPayload.email = createPayload.email.trim().toLowerCase();
    }
    if (stores.length > 0) {
      createPayload.storeIds = stores.map((s) => s._id);
      createPayload.storeNames = stores.map((s) => s.name);
    }
    const employee = await Employee.create(createPayload);
    res.status(201).json(getSafeEmployee(employee));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all employees
router.get("/employees", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees.map(getSafeEmployee));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign employee to a store
router.patch(
  "/employees/:id/store",
  requireAuth,
  canManageEmployees,
  async (req, res) => {
    try {
      const { storeId, storeIds } = req.body;
      const inputStoreIds = normalizeStoreIds(storeId, storeIds);
      if (inputStoreIds.length === 0) {
        return res.status(400).json({ error: "storeId or storeIds required" });
      }

      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      if (employee.role === "DIRECTOR") {
        return res
          .status(400)
          .json({ error: "Director does not require store assignment" });
      }

      if (Array.isArray(storeIds) && storeIds.length > 0) {
        const stores = await resolveStores(storeIds);
        if (!stores) {
          return res.status(400).json({ error: "Store not found" });
        }
        employee.storeIds = stores.map((s) => s._id);
        employee.storeNames = stores.map((s) => s.name);
      } else {
        const stores = await resolveStores([storeId]);
        if (!stores || stores.length === 0) {
          return res.status(400).json({ error: "Store not found" });
        }
        const store = stores[0];
        const currentIds = Array.isArray(employee.storeIds)
          ? employee.storeIds.map((id) => String(id))
          : [];
        if (!currentIds.includes(String(store._id))) {
          employee.storeIds = [...(employee.storeIds || []), store._id];
          employee.storeNames = [...(employee.storeNames || []), store.name];
        }
      }
      await employee.save();

      return res.json(getSafeEmployee(employee));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
