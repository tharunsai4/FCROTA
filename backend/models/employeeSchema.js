const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    storeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
      },
    ],
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      select: false,
    },
    emailVerifyExpires: {
      type: Date,
      select: false,
    },

    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    role: {
      type: String,
      enum: ["DIRECTOR", "MANAGER", "STORE_MANAGER", "SALES_EXECUTIVE", "STAFF"],
      default: "STAFF",
      required: true,
    },

    storeNames: [
      {
        type: String,
        trim: true,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

employeeSchema.path("storeIds").validate(function (value) {
  if (this.role === "DIRECTOR") return true;
  return Array.isArray(value) && value.length > 0;
}, "storeIds required");

employeeSchema.path("storeNames").validate(function (value) {
  if (this.role === "DIRECTOR") return true;
  const ids = Array.isArray(this.storeIds) ? this.storeIds.length : 0;
  return Array.isArray(value) && value.length > 0 && value.length === ids;
}, "storeNames required");

module.exports = mongoose.model("Employee", employeeSchema);
