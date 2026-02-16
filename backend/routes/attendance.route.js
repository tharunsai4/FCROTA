const express = require("express");
const Attendance = require("../models/attendanceSchema");
const Store = require("../models/storeSchema");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const pad = (value) => String(value).padStart(2, "0");
const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const minutesBetween = (start, end) =>
  Math.max(0, Math.round((end - start) / 60000));

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getWeekStart = (date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  return startOfDay(start);
};

const getRangeBounds = (range, baseDate = new Date()) => {
  const date = new Date(baseDate);
  if (range === "week") {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  if (range === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
  }
  const start = startOfDay(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
};

router.post("/attendance/clock-in", requireAuth, async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ error: "storeId required" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const openShift = await Attendance.findOne({
      employeeId: req.user.id,
      status: "OPEN",
    });
    if (openShift) {
      return res.status(400).json({ error: "Already clocked in" });
    }

    const now = new Date();
    const shift = await Attendance.create({
      employeeId: req.user.id,
      storeId,
      clockIn: now,
      status: "OPEN",
      dateKey: getDateKey(now),
    });

    return res.status(201).json(shift);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/attendance/clock-out", requireAuth, async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ error: "storeId required" });
    }

    const openShift = await Attendance.findOne({
      employeeId: req.user.id,
      status: "OPEN",
    });
    if (!openShift) {
      return res.status(400).json({ error: "No open shift to close" });
    }

    if (String(openShift.storeId) !== String(storeId)) {
      return res.status(400).json({ error: "Store mismatch" });
    }

    const now = new Date();
    openShift.clockOut = now;
    openShift.status = "CLOSED";
    openShift.totalMinutes = minutesBetween(openShift.clockIn, now);
    await openShift.save();

    return res.json(openShift);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get("/attendance/today", requireAuth, async (req, res) => {
  try {
    const dateKey = req.query.date || getDateKey(new Date());
    const shifts = await Attendance.find({
      employeeId: req.user.id,
      dateKey,
    }).sort({ clockIn: 1 });

    const totalMinutes = shifts.reduce((sum, shift) => {
      if (shift.totalMinutes) return sum + shift.totalMinutes;
      if (shift.clockOut) {
        return sum + minutesBetween(shift.clockIn, shift.clockOut);
      }
      return sum;
    }, 0);

    const openShift = shifts.find((shift) => shift.status === "OPEN") || null;

    return res.json({ dateKey, totalMinutes, openShift, shifts });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get("/attendance/summary", requireAuth, async (req, res) => {
  try {
    const range = String(req.query.range || "day").toLowerCase();
    if (!["day", "week", "month"].includes(range)) {
      return res.status(400).json({ error: "Invalid range" });
    }
    const baseDate = req.query.date ? new Date(req.query.date) : new Date();
    const { start, end } = getRangeBounds(range, baseDate);

    const shifts = await Attendance.find({
      employeeId: req.user.id,
      clockIn: { $lt: end },
      $or: [{ clockOut: { $exists: false } }, { clockOut: { $gt: start } }],
    }).sort({ clockIn: 1 });

    let totalMinutes = 0;
    shifts.forEach((shift) => {
      const shiftStart = new Date(shift.clockIn);
      const shiftEnd = shift.clockOut ? new Date(shift.clockOut) : new Date();
      const effectiveStart = shiftStart > start ? shiftStart : start;
      const effectiveEnd = shiftEnd < end ? shiftEnd : end;
      if (effectiveEnd > effectiveStart) {
        totalMinutes += minutesBetween(effectiveStart, effectiveEnd);
      }
    });

    const from = getDateKey(start);
    const to = getDateKey(new Date(end.getTime() - 1));

    return res.json({ range, from, to, totalMinutes });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
