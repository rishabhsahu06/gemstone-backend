import User from "../models/user.model.js"
import { AppError } from "../utils/appError.js"
import { catchAsync } from "../utils/catchAsync.js"
import validator from "validator"
import rateLimit from "express-rate-limit"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
// Rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Input validation helpers
const validateEmail = (email) => {
  if (!email) {
    throw new AppError("Email is required", 400)
  }
  if (!validator.isEmail(email)) {
    throw new AppError("Please provide a valid email address", 400)
  }
  return email.toLowerCase().trim()
}

const validatePassword = (password, fieldName = "password") => {
  if (!password) {
    throw new AppError(`${fieldName} is required`, 400)
  }
  if (password.length < 8) {
    throw new AppError(`${fieldName} must be at least 8 characters long`, 400)
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new AppError(`${fieldName} must contain at least one uppercase letter, one lowercase letter, and one number`, 400)
  }
  return password
}

const validateName = (name) => {
  if (!name) {
    throw new AppError("Name is required", 400)
  }
  if (name.length < 2 || name.length > 50) {
    throw new AppError("Name must be between 2 and 50 characters", 400)
  }
  if (!/^[a-zA-Z\s]+$/.test(name)) {
    throw new AppError("Name can only contain letters and spaces", 400)
  }
  return name.trim()
}

const validatePhone = (phone) => {
  if (!phone) {
    throw new AppError("Phone number is required", 400)
  }
  // Remove all non-numeric characters for validation
  const cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    throw new AppError("Please provide a valid phone number", 400)
  }
  return phone.trim()
}

// Helper function to generate user response
const generateUserResponse = (user, token = null) => {
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    address: user.address || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }

  const response = {
    success: true,
    user: userResponse
  }

  if (token) {
    response.token = token
  }

  return response
}

export const googleLogin = async (req, res) => {
  try {
    const { email, name, googleId } = req.body

    // Validate required fields
    if (!email || !name || !googleId) {
      return res.status(400).json({
        success: false,
        message: "Email, name, and Google ID are required"
      })
    }

    // Check if user already exists
    let user = await User.findOne({ email })

    if (user) {
      // User exists - update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId
        await user.save()
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_INS_IN || "30d" }
      )

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified
          },
          token
        }
      })
    } else {
      // User doesn't exist - create new user
      const newUser = new User({
        name,
        email,
        googleId,
        isVerified: true, // Google users are automatically verified
        role: "user", // Default role
        // Don't set password for Google users
      })

      await newUser.save()

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
      )

      return res.status(201).json({
        success: true,
        message: "Account created and login successful",
        data: {
          user: {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            isVerified: newUser.isVerified
          },
          token
        }
      })
    }
  } catch (error) {
    console.error("Google login error:", error)
    return res.status(500).json({
      success: false,
      message: "Server error during Google login",
      error: error.message
    })
  }
}






// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = catchAsync(async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body

    // Validate all required fields
    const validatedName = validateName(name)
    const validatedEmail = validateEmail(email)
    const validatedPassword = validatePassword(password)
    const validatedPhone = validatePhone(phone)

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: validatedEmail },
        { phone: validatedPhone }
      ]
    })

    if (existingUser) {
      const field = existingUser.email === validatedEmail ? 'email' : 'phone number'
      return next(new AppError(`User with this ${field} already exists`, 409))
    }

    // Create user
    const userData = {
      name: validatedName,
      email: validatedEmail,
      password: validatedPassword,
      phone: validatedPhone
    }

    const user = await User.create(userData)

    if (!user) {
      return next(new AppError("Failed to create user account", 500))
    }

    // Generate JWT token
    const token = user.getSignedJwtToken()

    if (!token) {
      return next(new AppError("Failed to generate authentication token", 500))
    }

    // Log successful registration (without sensitive data)
    console.log(`New user registered: ${user.email} (ID: ${user._id})`)

    // Send response
    res.status(201).json(generateUserResponse(user, token))

  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return next(new AppError(`User with this ${field} already exists`, 409))
    }

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message)
      return next(new AppError(messages.join('. '), 400))
    }

    // Handle custom AppError
    if (error instanceof AppError) {
      return next(error)
    }

    // Log unexpected errors
    console.error('Registration error:', error)
    return next(new AppError("Internal server error during registration", 500))
  }
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = catchAsync(async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body

    // Validate input
    const validatedEmail = validateEmail(email)
    if (!password) {
      return next(new AppError("Password is required", 400))
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: validatedEmail }).select("+password")

    if (!user) {
      return next(new AppError("Invalid email or password", 401))
    }

    // Check if account is active/not suspended //
    if (user.status === 'suspended') {
      return next(new AppError("Account has been suspended. Please contact support", 403))
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password)
    if (!isPasswordValid) {
      // Log failed login attempt
      console.log(`Failed login attempt for email: ${validatedEmail}`)
      return next(new AppError("Invalid email or password", 401))
    }

    // Update last login timestamp
    user.lastLoginAt = new Date()
    await user.save({ validateBeforeSave: false })

    // Generate JWT token
    const token = user.getSignedJwtToken(rememberMe ? '30d' : '1d')

    if (!token) {
      return next(new AppError("Failed to generate authentication token", 500))
    }

    // Log successful login
    console.log(`User logged in: ${user.email} (ID: ${user._id})`)

    // Optional: Set secure HTTP-only cookie
    if (process.env.USE_COOKIES === 'true') {
      res.cookie("token", token, {
        httpOnly: true,
        expires: new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000),
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      })
    }

    // Send response
    res.status(200).json(generateUserResponse(user, token))

  } catch (error) {
    // Handle custom AppError
    if (error instanceof AppError) {
      return next(error)
    }

    // Log unexpected errors
    console.error('Login error:', error)
    return next(new AppError("Internal server error during login", 500))
  }
})

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new AppError("User not authenticated", 401))
    }

    const user = await User.findById(req.user.id).select("-password")

    if (!user) {
      return next(new AppError("User not found", 404))
    }

    // Check if user account is still active
    if (user.status === 'suspended') {
      return next(new AppError("Account has been suspended", 403))
    }

    res.status(200).json({
      success: true,
      data: user
    })

  } catch (error) {
    // Handle MongoDB CastError (invalid ObjectId)
    if (error.name === 'CastError') {
      return next(new AppError("Invalid user ID", 400))
    }

    console.error('Get user profile error:', error)
    return next(new AppError("Failed to retrieve user profile", 500))
  }
})

// @desc    Update user profile
// @route   PUT /api/auth/updateprofile
// @access  Private
export const updateProfile = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new AppError("User not authenticated", 401))
    }

    const { name, phone, address } = req.body

    // Validate at least one field is provided
    if (!name && !phone && !address) {
      return next(new AppError("At least one field (name, phone, or address) is required for update", 400))
    }

    const updateFields = {}

    // Validate and set fields only if provided
    if (name !== undefined) {
      updateFields.name = validateName(name)
    }

    if (phone !== undefined) {
      const validatedPhone = validatePhone(phone)
      
      // Check if phone number is already taken by another user
      const existingUser = await User.findOne({ 
        phone: validatedPhone, 
        _id: { $ne: req.user.id } 
      })
      
      if (existingUser) {
        return next(new AppError("Phone number is already registered to another account", 409))
      }
      
      updateFields.phone = validatedPhone
    }

    if (address !== undefined) {
      if (address && address.length > 200) {
        return next(new AppError("Address must not exceed 200 characters", 400))
      }
      updateFields.address = address.trim()
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      updateFields, 
      {
        new: true,
        runValidators: true,
        select: "-password"
      }
    )

    if (!updatedUser) {
      return next(new AppError("User not found", 404))
    }

    // Log profile update
    console.log(`Profile updated for user: ${updatedUser.email} (ID: ${updatedUser._id})`)

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    })

  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return next(new AppError(`${field} is already registered to another account`, 409))
    }

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message)
      return next(new AppError(messages.join('. '), 400))
    }

    // Handle custom AppError
    if (error instanceof AppError) {
      return next(error)
    }

    console.error('Profile update error:', error)
    return next(new AppError("Failed to update profile", 500))
  }
})

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
export const updatePassword = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new AppError("User not authenticated", 401))
    }

    const { currentPassword, newPassword, confirmPassword } = req.body

    // Validate required fields
    if (!currentPassword) {
      return next(new AppError("Current password is required", 400))
    }

    if (!newPassword) {
      return next(new AppError("New password is required", 400))
    }

    if (!confirmPassword) {
      return next(new AppError("Password confirmation is required", 400))
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      return next(new AppError("New password and confirmation do not match", 400))
    }

    // Validate new password strength
    validatePassword(newPassword, "New password")

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return next(new AppError("New password must be different from current password", 400))
    }

    // Get user with current password
    const user = await User.findById(req.user.id).select("+password")

    if (!user) {
      return next(new AppError("User not found", 404))
    }

    // Verify current password
    const isCurrentPasswordValid = await user.matchPassword(currentPassword)
    if (!isCurrentPasswordValid) {
      return next(new AppError("Current password is incorrect", 401))
    }

    // Update password
    user.password = newPassword
    user.passwordChangedAt = new Date()
    await user.save()

    // Generate new token (invalidates old tokens)
    const token = user.getSignedJwtToken()

    if (!token) {
      return next(new AppError("Failed to generate new authentication token", 500))
    }

    // Log password change
    console.log(`Password changed for user: ${user.email} (ID: ${user._id})`)

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
      token
    })

  } catch (error) {
    // Handle custom AppError
    if (error instanceof AppError) {
      return next(error)
    }

    console.error('Password update error:', error)
    return next(new AppError("Failed to update password", 500))
  }
})

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = catchAsync(async (req, res, next) => {
  try {
    // Clear cookie if using cookie-based auth
    if (process.env.USE_COOKIES === 'true') {
      res.cookie("token", "", {
        httpOnly: true,
        expires: new Date(0),
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      })
    }

    // Log logout
    if (req.user && req.user.id) {
      console.log(`User logged out: ${req.user.email || req.user.id}`)
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    })

  } catch (error) {
    console.error('Logout error:', error)
    return next(new AppError("Failed to logout", 500))
  }
})

// @desc    Delete user account
// @route   DELETE /api/auth/deleteaccount
// @access  Private
export const deleteAccount = catchAsync(async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new AppError("User not authenticated", 401))
    }

    const { password, confirmDeletion } = req.body

    // Require password confirmation for account deletion
    if (!password) {
      return next(new AppError("Password is required to delete account", 400))
    }

    if (confirmDeletion !== 'DELETE') {
      return next(new AppError("Please type 'DELETE' to confirm account deletion", 400))
    }

    // Get user with password
    const user = await User.findById(req.user.id).select("+password")

    if (!user) {
      return next(new AppError("User not found", 404))
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password)
    if (!isPasswordValid) {
      return next(new AppError("Incorrect password", 401))
    }

    // Soft delete or hard delete based on your business logic
    await User.findByIdAndDelete(req.user.id)

    // Log account deletion
    console.log(`Account deleted: ${user.email} (ID: ${user._id})`)

    res.status(200).json({
      success: true,
      message: "Account deleted successfully"
    })

  } catch (error) {
    console.error('Account deletion error:', error)
    return next(new AppError("Failed to delete account", 500))
  }
})