// models/BookingCall.js
import mongoose from "mongoose";

const bookingCallSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
  },
  phoneNumber: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"]
  },
  gender: {
    type: String,
    required: [true, "Gender is required"],
    enum: ["male", "female", "other"],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, "Date of birth is required"],
    validate: {
      validator: function(value) {
        return value < new Date();
      },
      message: "Date of birth cannot be in the future"
    }
  },
  timeOfBirth: {
    type: String,
    required: [true, "Time of birth is required"],
    trim: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, "Please enter time in HH:MM:SS format"]
  },
  birthPlace: {
    type: String,
    required: [true, "Birth place is required"],
    trim: true,
    maxlength: [200, "Birth place cannot exceed 200 characters"]
  },
  purpose: {
    type: String,
    required: [true, "Purpose is required"],
    enum: ["Gemstone Consultation", "Career Guidance", "Health Issues", "Relationship Advice", "Business Consultation", "Other"],
    trim: true
  },
  message: {
    type: String,
    trim: true,
    maxlength: [1000, "Message cannot exceed 1000 characters"]
  },
  status: {
    type: String,
    enum: ["Pending", "Scheduled", "Completed", "Cancelled"],
    default: "Pending"
  },
  scheduledDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, "Notes cannot exceed 500 characters"]
  }
}, {
  timestamps: true
});

// Index for efficient querying
bookingCallSchema.index({ email: 1 });
bookingCallSchema.index({ status: 1 });
bookingCallSchema.index({ createdAt: -1 });

const BookingCall = mongoose.model("BookingCall", bookingCallSchema);

export default BookingCall;