import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import config from "../config/config.js"

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      // Required for password/Google users; OTP phone login uses a synthetic email
      required: [true, "Please provide an email"],
      unique: true,
      match: [/^([\w-.]+@([\w-]+\.)+[\w-]{2,4})?$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      // required: [true, "Please provide a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      // required: [true, "Please provide a phone number"],
      unique: true,
      sparse: true,
      match: [/^\+[1-9]\d{1,14}$/, "Please provide a valid phone number with country code"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null values
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true },
)

// Encrypt password using bcrypt
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next()
  }
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  })
}

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

const User = mongoose.model("User", userSchema)

export default User
