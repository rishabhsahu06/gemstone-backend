import twilio from 'twilio';
import User from "../models/user.model.js";
import { AppError } from "../utils/appError.js";
import { catchAsync } from "../utils/catchAsync.js";
import validator from "validator";
import rateLimit from "express-rate-limit";
import config from "../config/config.js"

// Initialize Twilio client
const twilioClient = twilio(
  config.twilio.accountSid,
  config.twilio.authToken
);
// In-memory store for temporary user data (use Redis in production)
const tempUserStore = new Map();

// Rate limiting for OTP requests
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 OTP requests per windowMs
  message: {
    success: false,
    message: "Too many OTP requests, please try again later",
    error: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation helpers
const validateEmail = (email) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }
  if (!validator.isEmail(email)) {
    throw new AppError("Please provide a valid email address", 400);
  }
  return email.toLowerCase().trim();
};

const validateName = (name) => {
  if (!name) {
    throw new AppError("Name is required", 400);
  }
  if (name.length < 2 || name.length > 50) {
    throw new AppError("Name must be between 2 and 50 characters", 400);
  }
  if (!/^[a-zA-Z\s]+$/.test(name)) {
    throw new AppError("Name can only contain letters and spaces", 400);
  }
  return name.trim();
};

const validatePhone = (phone) => {
  if (!phone) {
    throw new AppError("Phone number is required", 400);
  }

  const phoneStr = String(phone);
  let formattedPhone = phoneStr.replace(/\D/g, '');

  if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
    formattedPhone = '1' + formattedPhone;
  }

  if (formattedPhone.length < 10 || formattedPhone.length > 15) {
    throw new AppError("Please provide a valid phone number with country code", 400);
  }

  return '+' + formattedPhone;
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Standard response formatter
const formatResponse = (success, message, data = null, error = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    response.data = data;
  }
  
  if (error) {
    response.error = error;
  }
  
  return response;
};

// @desc    Send OTP for registration
// @route   POST /api/auth/send-otp
// @access  Public
export const sendRegistrationOTP = catchAsync(async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json(formatResponse(
        false,
        "Name, email, and phone number are required",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    // Validate all fields
    const validatedName = validateName(name);
    const validatedEmail = validateEmail(email);
    const validatedPhone = validatePhone(phone);

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: validatedEmail },
        { phone: validatedPhone }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === validatedEmail ? 'email' : 'phone number';
      return res.status(409).json(formatResponse(
        false,
        `User with this ${field} already exists`,
        null,
        "USER_ALREADY_EXISTS"
      ));
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store temporary user data
    const tempUserId = `temp_${Date.now()}_${Math.random()}`;
    tempUserStore.set(tempUserId, {
      name: validatedName,
      email: validatedEmail,
      phone: validatedPhone,
      otp,
      otpExpiry,
      attempts: 0,
      createdAt: new Date(),
      type: 'registration'
    });

    console.log(`Temporary user data stored for ${validatedPhone} with ID: ${tempUserId}`);

    // Send OTP via Twilio
    try {
      await twilioClient.messages.create({
        body: `Your verification code is: ${otp}. This code will expire in 10 minutes.`,
        from: config.twilio.phoneNumber,
        to: validatedPhone
      });

      console.log(`OTP sent to ${validatedPhone} for registration`);

      return res.status(200).json(formatResponse(
        true,
        "OTP sent successfully to your phone number",
        {
          tempUserId,
          expiresIn: 600, // 10 minutes in seconds
          phone: validatedPhone.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1***$3$4') // Masked phone
        }
      ));

    } catch (twilioError) {
      console.error('Twilio error:', twilioError);
      
      // Clean up temp data on SMS failure
      tempUserStore.delete(tempUserId);
      
      return res.status(500).json(formatResponse(
        false,
        "Failed to send OTP. Please check your phone number and try again",
        null,
        "SMS_DELIVERY_FAILED"
      ));
    }

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(formatResponse(
        false,
        error.message,
        null,
        "VALIDATION_ERROR"
      ));
    }

    console.error('Send OTP error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error while sending OTP",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// @desc    Verify OTP and complete registration
// @route   POST /api/auth/register
// @access  Public
export const verifyOTPAndRegister = catchAsync(async (req, res, next) => {
  try {
    const { tempUserId, otp, password } = req.body;

    if (!tempUserId || !otp) {
      return res.status(400).json(formatResponse(
        false,
        "Temporary user ID and OTP are required",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    // Get temporary user data
    const tempUserData = tempUserStore.get(tempUserId);

    if (!tempUserData || tempUserData.type !== 'registration') {
      return res.status(400).json(formatResponse(
        false,
        "Invalid or expired verification session",
        null,
        "INVALID_SESSION"
      ));
    }

    // Check if OTP has expired
    if (new Date() > tempUserData.otpExpiry) {
      tempUserStore.delete(tempUserId);
      return res.status(400).json(formatResponse(
        false,
        "OTP has expired. Please request a new one",
        null,
        "OTP_EXPIRED"
      ));
    }

    // Check attempt limit
    if (tempUserData.attempts >= 3) {
      tempUserStore.delete(tempUserId);
      return res.status(429).json(formatResponse(
        false,
        "Too many failed attempts. Please request a new OTP",
        null,
        "MAX_ATTEMPTS_EXCEEDED"
      ));
    }

    // Verify OTP
    if (tempUserData.otp !== otp.toString()) {
      tempUserData.attempts += 1;
      tempUserStore.set(tempUserId, tempUserData);
      
      return res.status(400).json(formatResponse(
        false,
        `Invalid OTP. ${3 - tempUserData.attempts} attempts remaining`,
        { attemptsRemaining: 3 - tempUserData.attempts },
        "INVALID_OTP"
      ));
    }

    // OTP verified successfully - create user account
    const userData = {
      name: tempUserData.name,
      email: tempUserData.email,
      phone: tempUserData.phone,
      password: password,
      role: 'user',
      isPhoneVerified: true,
    };

    const user = await User.create(userData);

    if (!user) {
      return res.status(500).json(formatResponse(
        false,
        "Failed to create user account",
        null,
        "USER_CREATION_FAILED"
      ));
    }

    // Clean up temporary data
    tempUserStore.delete(tempUserId);

    // Generate JWT token
    const token = user.getSignedJwtToken();

    if (!token) {
      return res.status(500).json(formatResponse(
        false,
        "Failed to generate authentication token",
        null,
        "TOKEN_GENERATION_FAILED"
      ));
    }

    console.log(`New user registered via OTP: ${user.email} (ID: ${user._id})`);

    // Generate user response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(201).json(formatResponse(
      true,
      "Registration completed successfully",
      {
        user: userResponse,
        token,
        expiresIn: '24h' // or whatever your JWT expiry is
      }
    ));

  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json(formatResponse(
        false,
        `User with this ${field} already exists`,
        null,
        "DUPLICATE_USER"
      ));
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json(formatResponse(
        false,
        error.message,
        null,
        "VALIDATION_ERROR"
      ));
    }

    console.error('OTP verification error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error during verification",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = catchAsync(async (req, res, next) => {
  try {
    const { tempUserId } = req.body;

    if (!tempUserId) {
      return res.status(400).json(formatResponse(
        false,
        "Temporary user ID is required",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    const tempUserData = tempUserStore.get(tempUserId);
    
    if (!tempUserData) {
      console.log(`No data found for tempUserId: ${tempUserId}`);
      return res.status(400).json(formatResponse(
        false,
        "Invalid verification session",
        null,
        "INVALID_SESSION"
      ));
    }

    // Generate new OTP
    const newOTP = generateOTP();
    const newOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update temp data
    tempUserData.otp = newOTP;
    tempUserData.otpExpiry = newOTPExpiry;
    tempUserData.attempts = 0; // Reset attempts
    
    console.log(`Resending OTP for ${tempUserData.phone} with ID: ${tempUserId}`);
    tempUserStore.set(tempUserId, tempUserData);

    // Send new OTP
    try {
      const otpMessage = tempUserData.type === 'login' 
        ? `Your new login verification code is: ${newOTP}. This code will expire in ${tempUserData.type === 'login' ? '5' : '10'} minutes.`
        : `Your new verification code is: ${newOTP}. This code will expire in 10 minutes.`;

      await twilioClient.messages.create({
        body: otpMessage,
        from: config.twilio.phoneNumber,
        to: tempUserData.phone
      });

      console.log(`OTP resent to ${tempUserData.phone}`);

      return res.status(200).json(formatResponse(
        true,
        "New OTP sent successfully",
        {
          expiresIn: tempUserData.type === 'login' ? 300 : 600,
          phone: tempUserData.phone.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1***$3$4')
        }
      ));

    } catch (twilioError) {
      console.error('Twilio resend error:', twilioError);
      return res.status(500).json(formatResponse(
        false,
        "Failed to resend OTP",
        null,
        "SMS_DELIVERY_FAILED"
      ));
    }

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error while resending OTP",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// @desc    Send Login OTP
// @route   POST /api/auth/send-login-otp
// @access  Public
export const sendLoginOTP = catchAsync(async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json(formatResponse(
        false,
        "Phone number is required",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    const validatedPhone = validatePhone(phone);

    // Check if user exists
    const user = await User.findOne({ phone: validatedPhone });

    if (!user) {
      return res.status(404).json(formatResponse(
        false,
        "No account found with this phone number",
        null,
        "USER_NOT_FOUND"
      ));
    }

    if (user.status === 'suspended') {
      return res.status(403).json(formatResponse(
        false,
        "Account has been suspended",
        null,
        "ACCOUNT_SUSPENDED"
      ));
    }

    // Generate OTP for login
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes for login

    // Store login OTP data
    const tempUserId = `login_${user._id}_${Date.now()}`;
    tempUserStore.set(tempUserId, {
      userId: user._id,
      phone: validatedPhone,
      otp,
      otpExpiry,
      attempts: 0,
      type: 'login'
    });

    // Send OTP
    try {
      await twilioClient.messages.create({
        body: `Your login verification code is: ${otp}. This code will expire in 5 minutes.`,
        from: config.twilio.phoneNumber,
        to: validatedPhone
      });

      console.log(`Login OTP sent to ${validatedPhone}`);

      return res.status(200).json(formatResponse(
        true,
        "Login OTP sent successfully",
        {
          tempUserId,
          expiresIn: 300, // 5 minutes
          phone: validatedPhone.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1***$3$4')
        }
      ));

    } catch (twilioError) {
      console.error('Twilio login OTP error:', twilioError);
      tempUserStore.delete(tempUserId);
      return res.status(500).json(formatResponse(
        false,
        "Failed to send login OTP",
        null,
        "SMS_DELIVERY_FAILED"
      ));
    }

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(formatResponse(
        false,
        error.message,
        null,
        "VALIDATION_ERROR"
      ));
    }

    console.error('Send login OTP error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// @desc    Verify login OTP
// @route   POST /api/auth/login
// @access  Public
export const verifyLoginOTP = catchAsync(async (req, res, next) => {
  try {
    const { tempUserId, otp } = req.body;

    if (!tempUserId || !otp) {
      return res.status(400).json(formatResponse(
        false,
        "Temporary user ID and OTP are required",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    const loginData = tempUserStore.get(tempUserId);

    if (!loginData || loginData.type !== 'login') {
      return res.status(400).json(formatResponse(
        false,
        "Invalid or expired login session",
        null,
        "INVALID_SESSION"
      ));
    }

    // Check expiry
    if (new Date() > loginData.otpExpiry) {
      tempUserStore.delete(tempUserId);
      return res.status(400).json(formatResponse(
        false,
        "Login OTP has expired",
        null,
        "OTP_EXPIRED"
      ));
    }

    // Check attempts
    if (loginData.attempts >= 3) {
      tempUserStore.delete(tempUserId);
      return res.status(429).json(formatResponse(
        false,
        "Too many failed attempts",
        null,
        "MAX_ATTEMPTS_EXCEEDED"
      ));
    }

    // Verify OTP
    if (loginData.otp !== otp.toString()) {
      loginData.attempts += 1;
      tempUserStore.set(tempUserId, loginData);
      return res.status(400).json(formatResponse(
        false,
        `Invalid OTP. ${3 - loginData.attempts} attempts remaining`,
        { attemptsRemaining: 3 - loginData.attempts },
        "INVALID_OTP"
      ));
    }

    // Get user
    const user = await User.findById(loginData.userId);

    if (!user) {
      tempUserStore.delete(tempUserId);
      return res.status(404).json(formatResponse(
        false,
        "User not found",
        null,
        "USER_NOT_FOUND"
      ));
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Clean up session data
    tempUserStore.delete(tempUserId);

    // Generate token
    const token = user.getSignedJwtToken();

    console.log(`User logged in via OTP: ${user.email} (ID: ${user._id})`);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt
    };

    return res.status(200).json(formatResponse(
      true,
      "Login successful",
      {
        user: userResponse,
        token,
        expiresIn: '24h' // or whatever your JWT expiry is
      }
    ));

  } catch (error) {
    console.error('Login OTP verification error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// Cleanup function for expired temp data
export const cleanupExpiredTempData = () => {
  const now = new Date();
  for (const [key, data] of tempUserStore.entries()) {
    if (data.otpExpiry && now > data.otpExpiry) {
      tempUserStore.delete(key);
    }
    // Also cleanup old temp registrations (older than 1 hour)
    if (data.createdAt && now - data.createdAt > 60 * 60 * 1000) {
      tempUserStore.delete(key);
    }
  }
};

// Run cleanup every 15 minutes
setInterval(cleanupExpiredTempData, 15 * 60 * 1000);