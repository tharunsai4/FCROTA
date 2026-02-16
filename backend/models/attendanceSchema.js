const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    clockIn: {
      type: Date,
      required: true,
    },
    clockOut: {
      type: Date,
    },
    totalMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },
    dateKey: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, status: 1 });
attendanceSchema.index({ employeeId: 1, dateKey: 1, status: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
