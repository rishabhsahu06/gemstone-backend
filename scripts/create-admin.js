import mongoose from "mongoose"
import dotenv from "dotenv"
import bcrypt from "bcryptjs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import fs from "fs"

// Get the directory name
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from parent directory
const envPath = join(__dirname, "..", ".env")
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })

// Import User model
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      match: [/^([\w-.]+@([\w-]+\.)+[\w-]{2,4})?$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Please provide a phone number"],
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
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true },
)

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next()
  }
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

const User = mongoose.model("User", UserSchema)

/**
 * Create a new admin user or promote an existing user to admin
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - Created or updated user
 */
async function createOrPromoteAdmin(userData) {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email })

    if (existingUser) {
      console.log(`User with email ${userData.email} already exists. Promoting to admin...`)
      existingUser.role = "admin"
      await existingUser.save()
      console.log(`User ${existingUser.name} (${existingUser.email}) promoted to admin successfully!`)
      return existingUser
    }

    // Create new admin user
    const adminUser = await User.create({
      ...userData,
      role: "admin",
    })

    console.log(`Admin user ${adminUser.name} (${adminUser.email}) created successfully!`)
    return adminUser
  } catch (error) {
    console.error("Error creating/promoting admin user:", error)
    throw error
  }
}

// Get admin details from command line arguments or use defaults
const adminData = {
  name: process.argv[2] || "Admin User",
  email: process.argv[3] || "admin@example.com",
  password: process.argv[4] || "admin123",
  phone: process.argv[5] || "+1234567890",
}

// Create or promote admin user
createOrPromoteAdmin(adminData)
  .then(() => {
    console.log("Admin user operation completed successfully!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Failed to create/promote admin user:", error)
    process.exit(1)
  })
