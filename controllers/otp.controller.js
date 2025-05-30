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
    message: "Too many OTP requests, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation helpers (keeping existing ones)
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

  const phoneStr = String(phone); // ✅ ensure it's a string
  let formattedPhone = phoneStr.replace(/\D/g, '');

  if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
    formattedPhone = '1' + formattedPhone; // Add US country code
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

// @desc    Send OTP for registration
// @route   POST /api/auth/send-otp
// @access  Public
export const sendRegistrationOTP = catchAsync(async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    // Validate all required fields
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
      return next(new AppError(`User with this ${field} already exists`, 409));
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
      createdAt: new Date()
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

      res.status(200).json({
        success: true,
        message: "OTP sent successfully to your phone number",
        tempUserId, // Send this back to client for verification
        expiresIn: 600 // 10 minutes in seconds
      });

    } catch (twilioError) {
      console.error('Twilio error:', twilioError);
      
      // Clean up temp data on SMS failure
      tempUserStore.delete(tempUserId);
      
      return next(new AppError("Failed to send OTP. Please check your phone number", 500));
    }

  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    console.error('Send OTP error:', error);
    return next(new AppError("Internal server error while sending OTP", 500));
  }
});

// @desc    Verify OTP and complete registration
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTPAndRegister = catchAsync(async (req, res, next) => {
  try {
    const { tempUserId, otp,password } = req.body;

    if (!tempUserId || !otp) {
      return next(new AppError("Temporary user ID and OTP are required", 400));
    }

    // Get temporary user data
    const tempUserData = tempUserStore.get(tempUserId);

    if (!tempUserData) {
      return next(new AppError("Invalid or expired verification session", 400));
    }

    // Check if OTP has expired
    if (new Date() > tempUserData.otpExpiry) {
      tempUserStore.delete(tempUserId);
      return next(new AppError("OTP has expired. Please request a new one", 400));
    }

    // Check attempt limit
    if (tempUserData.attempts >= 3) {
      tempUserStore.delete(tempUserId);
      return next(new AppError("Too many failed attempts. Please request a new OTP", 400));
    }

    // Verify OTP
    if (tempUserData.otp !== otp.toString()) {
      tempUserData.attempts += 1;
      tempUserStore.set(tempUserId, tempUserData);
      
      return next(new AppError(`Invalid OTP. ${3 - tempUserData.attempts} attempts remaining`, 400));
    }

    // OTP verified successfully - create user account
    const userData = {
      name: tempUserData.name,
      email: tempUserData.email,
      phone: tempUserData.phone,
      password: password,
      role: 'user', // Default role
      isPhoneVerified: true,
      // No password needed for OTP-based registration
    };

    const user = await User.create(userData);

    if (!user) {
      return next(new AppError("Failed to create user account", 500));
    }

    // Clean up temporary data
    tempUserStore.delete(tempUserId);

    // Generate JWT token
    const token = user.getSignedJwtToken();

    if (!token) {
      return next(new AppError("Failed to generate authentication token", 500));
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

    res.status(201).json({
      success: true,
      message: "Registration completed successfully",
      user: userResponse,
      token
    });

  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return next(new AppError(`User with this ${field} already exists`, 409));
    }

    if (error instanceof AppError) {
      return next(error);
    }

    console.error('OTP verification error:', error);
    return next(new AppError("Internal server error during verification", 500));
  }
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = catchAsync(async (req, res, next) => {
  try {
    const { tempUserId } = req.body;

    if (!tempUserId) {
      return next(new AppError("Temporary user ID is required", 400));
    }

    // Better debugging - show the Map contents and keys

    
    // You can also log all entries if needed for debugging
    // console.log('All tempUserStore entries:');
    // for (const [key, value] of tempUserStore.entries()) {
    //   console.log(`  ${key}:`, {
    //     phone: value.phone,
    //     email: value.email,
    //     otpExpiry: value.otpExpiry,
    //     type: value.type || 'registration'
    //   });
    // }

    const tempUserData = tempUserStore.get(tempUserId);
    
    if (!tempUserData) {
      console.log(`No data found for tempUserId: ${tempUserId}`);
      return next(new AppError("Invalid verification session", 400));
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
      await twilioClient.messages.create({
        body: `Your new verification code is: ${newOTP}. This code will expire in 10 minutes.`,
        from: config.twilio.phoneNumber,
        to: tempUserData.phone
      });

      console.log(`OTP resent to ${tempUserData.phone}`);

      res.status(200).json({
        success: true,
        message: "New OTP sent successfully",
        expiresIn: 600
      });

    } catch (twilioError) {
      console.error('Twilio resend error:', twilioError);
      return next(new AppError("Failed to resend OTP", 500));
    }

  } catch (error) {
    console.error('Resend OTP error:', error);
    return next(new AppError("Internal server error while resending OTP", 500));
  }
});
// @desc    Login with phone and OTP
// @route   POST /api/auth/login-otp
// @access  Public
export const sendLoginOTP = catchAsync(async (req, res, next) => {
  try {
    const { phone } = req.body;

    const validatedPhone = validatePhone(phone);

    // Check if user exists
    const user = await User.findOne({ phone: validatedPhone });

    if (!user) {
      return next(new AppError("No account found with this phone number", 404));
    }

    if (user.status === 'suspended') {
      return next(new AppError("Account has been suspended", 403));
    }

    // Generate OTP for login
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes for login

    // Store login OTP data
    const loginSessionId = `login_${user._id}_${Date.now()}`;
    tempUserStore.set(loginSessionId, {
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

      res.status(200).json({
        success: true,
        message: "Login OTP sent successfully",
        loginSessionId,
        expiresIn: 300 // 5 minutes
      });

    } catch (twilioError) {
      console.error('Twilio login OTP error:', twilioError);
      tempUserStore.delete(loginSessionId);
      return next(new AppError("Failed to send login OTP", 500));
    }

  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    console.error('Send login OTP error:', error);
    return next(new AppError("Internal server error", 500));
  }
});

// @desc    Verify login OTP
// @route   POST /api/auth/verify-login-otp
// @access  Public
export const verifyLoginOTP = catchAsync(async (req, res, next) => {
  try {
    const { loginSessionId, otp } = req.body;

    if (!loginSessionId || !otp) {
      return next(new AppError("Login session ID and OTP are required", 400));
    }

    const loginData = tempUserStore.get(loginSessionId);

    if (!loginData || loginData.type !== 'login') {
      return next(new AppError("Invalid or expired login session", 400));
    }

    // Check expiry
    if (new Date() > loginData.otpExpiry) {
      tempUserStore.delete(loginSessionId);
      return next(new AppError("Login OTP has expired", 400));
    }

    // Check attempts
    if (loginData.attempts >= 3) {
      tempUserStore.delete(loginSessionId);
      return next(new AppError("Too many failed attempts", 400));
    }

    // Verify OTP
    if (loginData.otp !== otp.toString()) {
      loginData.attempts += 1;
      tempUserStore.set(loginSessionId, loginData);
      return next(new AppError(`Invalid OTP. ${3 - loginData.attempts} attempts remaining`, 400));
    }

    // Get user
    const user = await User.findById(loginData.userId);

    if (!user) {
      tempUserStore.delete(loginSessionId);
      return next(new AppError("User not found", 404));
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Clean up session data
    tempUserStore.delete(loginSessionId);

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
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login OTP verification error:', error);
    return next(new AppError("Internal server error", 500));
  }
});

// Cleanup function for expired temp data (run periodically)
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

