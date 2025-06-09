import User from "../models/user.model.js";
import { AppError } from "../utils/appError.js";
import { catchAsync } from "../utils/catchAsync.js";
import validator from "validator";

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

// Validation helpers
const validateAddressField = (field, value, fieldName, maxLength = 100) => {
  if (!value || !value.trim()) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  
  if (value.trim().length > maxLength) {
    throw new AppError(`${fieldName} cannot exceed ${maxLength} characters`, 400);
  }
  
  return value.trim();
};

const validatePostalCode = (postalCode, country) => {
  if (!postalCode || !postalCode.trim()) {
    throw new AppError("Postal code is required", 400);
  }
  
  const code = postalCode.trim();
  
  // Basic validation based on country
  switch (country.toLowerCase()) {
    case 'india':
    case 'in':
      if (!/^\d{6}$/.test(code)) {
        throw new AppError("Please provide a valid 6-digit postal code for India", 400);
      }
      break;
    case 'united states':
    case 'usa':
    case 'us':
      if (!/^\d{5}(-\d{4})?$/.test(code)) {
        throw new AppError("Please provide a valid US postal code (12345 or 12345-6789)", 400);
      }
      break;
    case 'canada':
    case 'ca':
      if (!/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(code)) {
        throw new AppError("Please provide a valid Canadian postal code (A1A 1A1)", 400);
      }
      break;
    default:
      // Generic validation for other countries
      if (code.length < 3 || code.length > 10) {
        throw new AppError("Postal code must be between 3-10 characters", 400);
      }
  }
  
  return code;
};

// @desc    Update user address for checkout
// @route   POST /api/auth/checkout-address
// @access  Private
export const updateCheckoutAddress = catchAsync(async (req, res, next) => {
  try {
    const { street, city, state, postalCode, country } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!street || !city || !state || !postalCode || !country) {
      return res.status(400).json(formatResponse(
        false,
        "All address fields are required (street, city, state, postalCode, country)",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    // Validate and sanitize each field
    const validatedAddress = {
      street: validateAddressField(street, street, "Street address", 200),
      city: validateAddressField(city, city, "City", 50),
      state: validateAddressField(state, state, "State", 50),
      country: validateAddressField(country, country, "Country", 50),
      postalCode: validatePostalCode(postalCode, country)
    };

    // Find and update user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json(formatResponse(
        false,
        "User not found",
        null,
        "USER_NOT_FOUND"
      ));
    }

    // Update user address
    user.address = validatedAddress;
    await user.save({ validateBeforeSave: false });

    console.log(`Address updated for user: ${user.email} (ID: ${user._id})`);

    // Return updated address
    const addressResponse = {
      street: user.address.street,
      city: user.address.city,
      state: user.address.state,
      postalCode: user.address.postalCode,
      country: user.address.country,
      updatedAt: user.updatedAt
    };

    return res.status(200).json(formatResponse(
      true,
      "Address updated successfully for checkout",
      {
        address: addressResponse,
        userId: user._id
      }
    ));

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(formatResponse(
        false,
        error.message,
        null,
        "VALIDATION_ERROR"
      ));
    }

    console.error('Update checkout address error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error while updating address",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// @desc    Get user address for checkout
// @route   GET /api/auth/checkout-address
// @access  Private
export const getCheckoutAddress = catchAsync(async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('address name email phone');
    
    if (!user) {
      return res.status(404).json(formatResponse(
        false,
        "User not found",
        null,
        "USER_NOT_FOUND"
      ));
    }

    // Check if address exists and is complete
    const hasCompleteAddress = user.address && 
      user.address.street && 
      user.address.city && 
      user.address.state && 
      user.address.postalCode && 
      user.address.country;

    const responseData = {
      userId: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address || null,
      hasCompleteAddress
    };

    return res.status(200).json(formatResponse(
      true,
      hasCompleteAddress ? "Address retrieved successfully" : "No complete address found",
      responseData
    ));

  } catch (error) {
    console.error('Get checkout address error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error while retrieving address",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});

// @desc    Validate address for checkout (without saving)
// @route   POST /api/auth/validate-address
// @access  Private
export const validateCheckoutAddress = catchAsync(async (req, res, next) => {
  try {
    const { street, city, state, postalCode, country } = req.body;

    // Validate required fields
    if (!street || !city || !state || !postalCode || !country) {
      return res.status(400).json(formatResponse(
        false,
        "All address fields are required for validation",
        null,
        "MISSING_REQUIRED_FIELDS"
      ));
    }

    // Validate each field (this will throw AppError if invalid)
    const validatedAddress = {
      street: validateAddressField(street, street, "Street address", 200),
      city: validateAddressField(city, city, "City", 50),
      state: validateAddressField(state, state, "State", 50),
      country: validateAddressField(country, country, "Country", 50),
      postalCode: validatePostalCode(postalCode, country)
    };

    return res.status(200).json(formatResponse(
      true,
      "Address validation successful",
      {
        validatedAddress,
        isValid: true
      }
    ));

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(formatResponse(
        false,
        error.message,
        {
          isValid: false,
          field: error.message.split(' ')[0].toLowerCase()
        },
        "VALIDATION_ERROR"
      ));
    }

    console.error('Validate address error:', error);
    return res.status(500).json(formatResponse(
      false,
      "Internal server error during validation",
      null,
      "INTERNAL_SERVER_ERROR"
    ));
  }
});