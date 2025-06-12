// routes/booking-recom-call.js
import express from "express";
import BookingCall from "../models/bookingCall.model.js";
import { protect, authorize } from "../middleware/auth.middleware.js"
import { body, validationResult } from "express-validator";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BookingCall:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - phoneNumber
 *         - gender
 *         - dateOfBirth
 *         - timeOfBirth
 *         - birthPlace
 *         - purpose
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the booking
 *         name:
 *           type: string
 *           description: Full name of the person
 *         email:
 *           type: string
 *           description: Email address
 *         phoneNumber:
 *           type: string
 *           description: Phone number
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *           description: Gender
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: Date of birth
 *         timeOfBirth:
 *           type: string
 *           description: Time of birth in HH:MM:SS format
 *         birthPlace:
 *           type: string
 *           description: Place of birth
 *         purpose:
 *           type: string
 *           enum: [Gemstone Consultation, Career Guidance, Health Issues, Relationship Advice, Business Consultation, Other]
 *           description: Purpose of consultation
 *         message:
 *           type: string
 *           description: Additional message or details
 *         status:
 *           type: string
 *           enum: [Pending, Scheduled, Completed, Cancelled]
 *           description: Status of the booking
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *           description: Scheduled date and time for the call
 *         notes:
 *           type: string
 *           description: Admin notes
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

// Validation middleware
const validateBookingCall = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("phoneNumber")
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),
  body("gender")
    .isIn(["Male", "Female", "Other"])
    .withMessage("Gender must be Male, Female, or Other"),
  body("dateOfBirth")
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value >= new Date()) {
        throw new Error("Date of birth cannot be in the future");
      }
      return true;
    }),
  body("timeOfBirth")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage("Time of birth must be in HH:MM:SS format"),
  body("birthPlace")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Birth place must be between 2 and 200 characters"),
  body("purpose")
    .isIn(["Gemstone Consultation", "Career Guidance", "Health Issues", "Relationship Advice", "Business Consultation", "Other"])
    .withMessage("Please select a valid purpose"),
  body("message")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Message cannot exceed 1000 characters")
];

/**
 * @swagger
 * /api/booking-call:
 *   post:
 *     summary: Create a new booking recommendation call
 *     tags: [BookingCall]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phoneNumber
 *               - gender
 *               - dateOfBirth
 *               - timeOfBirth
 *               - birthPlace
 *               - purpose
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john@example.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: "Male"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-15"
 *               timeOfBirth:
 *                 type: string
 *                 example: "14:30:00"
 *               birthPlace:
 *                 type: string
 *                 example: "New York, USA"
 *               purpose:
 *                 type: string
 *                 enum: [Gemstone Consultation, Career Guidance, Health Issues, Relationship Advice, Business Consultation, Other]
 *                 example: "Gemstone Consultation"
 *               message:
 *                 type: string
 *                 example: "I need guidance on which gemstone would be best for me"
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Booking created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BookingCall'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post("/", validateBookingCall, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      timeOfBirth,
      birthPlace,
      purpose,
      message
    } = req.body;

    // Check if user already has a pending booking
    const existingBooking = await BookingCall.findOne({
      email,
      status: "Pending"
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending booking. Please wait for it to be processed."
      });
    }

    // Create new booking
    const newBooking = new BookingCall({
      name,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      timeOfBirth,
      birthPlace,
      purpose,
      message
    });

    const savedBooking = await newBooking.save();

    res.status(201).json({
      success: true,
      message: "Booking created successfully. We will contact you soon!",
      data: savedBooking
    });

  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/booking-call:
 *   get:
 *     summary: Get all booking recommendation calls (Protected - Admin only)
 *     tags: [BookingCall]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of bookings per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Scheduled, Completed, Cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *         description: Filter by purpose
 *     responses:
 *       200:
 *         description: List of bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bookings retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BookingCall'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalBookings:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.purpose) {
      filter.purpose = req.query.purpose;
    }

    // Get total count for pagination
    const totalBookings = await BookingCall.countDocuments(filter);
    const totalPages = Math.ceil(totalBookings / limit);

    // Get bookings with pagination
    const bookings = await BookingCall.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: bookings,
      pagination: {
        currentPage: page,
        totalPages,
        totalBookings,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/booking-call/{id}:
 *   get:
 *     summary: Get booking recommendation call by ID (Protected)
 *     tags: [BookingCall]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Booking details retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BookingCall'
 *       404:
 *         description: Booking not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await BookingCall.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking details retrieved successfully",
      data: booking
    });

  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/booking-call/{id}:
 *   put:
 *     summary: Update booking recommendation call (Protected - Admin only)
 *     tags: [BookingCall]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Scheduled, Completed, Cancelled]
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *       404:
 *         description: Booking not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduledDate, notes } = req.body;

    // Validate status if provided
    if (status && !["Pending", "Scheduled", "Completed", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (scheduledDate) updateData.scheduledDate = scheduledDate;
    if (notes) updateData.notes = notes;

    const updatedBooking = await BookingCall.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking
    });

  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update booking",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/booking-call/{id}:
 *   delete:
 *     summary: Delete booking recommendation call (Protected - Admin only)
 *     tags: [BookingCall]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       404:
 *         description: Booking not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBooking = await BookingCall.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: deletedBooking
    });

  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/booking-call/stats/summary:
 *   get:
 *     summary: Get booking statistics (Protected - Admin only)
 *     tags: [BookingCall]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Booking statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBookings:
 *                       type: integer
 *                     pendingBookings:
 *                       type: integer
 *                     scheduledBookings:
 *                       type: integer
 *                     completedBookings:
 *                       type: integer
 *                     cancelledBookings:
 *                       type: integer
 *                     purposeBreakdown:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/stats/summary", protect, authorize("admin"), async (req, res) => {
  try {
    const totalBookings = await BookingCall.countDocuments();
    const pendingBookings = await BookingCall.countDocuments({ status: "Pending" });
    const scheduledBookings = await BookingCall.countDocuments({ status: "Scheduled" });
    const completedBookings = await BookingCall.countDocuments({ status: "Completed" });
    const cancelledBookings = await BookingCall.countDocuments({ status: "Cancelled" });

    // Get purpose breakdown
    const purposeBreakdown = await BookingCall.aggregate([
      {
        $group: {
          _id: "$purpose",
          count: { $sum: 1 }
        }
      }
    ]);

    const purposeStats = {};
    purposeBreakdown.forEach(item => {
      purposeStats[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      message: "Statistics retrieved successfully",
      data: {
        totalBookings,
        pendingBookings,
        scheduledBookings,
        completedBookings,
        cancelledBookings,
        purposeBreakdown: purposeStats
      }
    });

  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message
    });
  }
});

export default router;