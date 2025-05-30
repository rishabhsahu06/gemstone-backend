import Enquiry from "../models/enquiry.model.js"
import { AppError } from "../utils/appError.js"
import { catchAsync } from "../utils/catchAsync.js"

// @desc    Create new enquiry
// @route   POST /api/enquiries
// @access  Public
export const createEnquiry = catchAsync(async (req, res, next) => {
  const enquiry = await Enquiry.create(req.body)

  res.status(201).json({
    success: true,
    data: enquiry,
  })
})

// @desc    Get all enquiries
// @route   GET /api/enquiries
// @access  Private/Admin
export const getEnquiries = catchAsync(async (req, res, next) => {
  // Build query
  const queryObj = { ...req.query }
  const excludedFields = ["page", "sort", "limit", "fields"]
  excludedFields.forEach((el) => delete queryObj[el])

  // Advanced filtering
  let queryStr = JSON.stringify(queryObj)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`)

  let query = Enquiry.find(JSON.parse(queryStr))

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ")
    query = query.sort(sortBy)
  } else {
    query = query.sort("-createdAt")
  }

  // Field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ")
    query = query.select(fields)
  } else {
    query = query.select("-__v")
  }

  // Pagination
  const page = Number.parseInt(req.query.page, 10) || 1
  const limit = Number.parseInt(req.query.limit, 10) || 10
  const skip = (page - 1) * limit

  query = query.skip(skip).limit(limit)

  // Execute query
  const enquiries = await query

  // Get total count for pagination
  const total = await Enquiry.countDocuments(JSON.parse(queryStr))

  res.status(200).json({
    success: true,
    count: enquiries.length,
    total,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: enquiries,
  })
})

// @desc    Get single enquiry
// @route   GET /api/enquiries/:id
// @access  Private/Admin
export const getEnquiry = catchAsync(async (req, res, next) => {
  const enquiry = await Enquiry.findById(req.params.id)

  if (!enquiry) {
    return next(new AppError(`Enquiry not found with id of ${req.params.id}`, 404))
  }

  res.status(200).json({
    success: true,
    data: enquiry,
  })
})

// @desc    Update enquiry status
// @route   PUT /api/enquiries/:id
// @access  Private/Admin
export const updateEnquiry = catchAsync(async (req, res, next) => {
  const { status, adminNotes } = req.body

  const updateFields = {}
  if (status) updateFields.status = status
  if (adminNotes) updateFields.adminNotes = adminNotes

  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true,
  })

  if (!enquiry) {
    return next(new AppError(`Enquiry not found with id of ${req.params.id}`, 404))
  }

  res.status(200).json({
    success: true,
    data: enquiry,
  })
})

// @desc    Delete enquiry
// @route   DELETE /api/enquiries/:id
// @access  Private/Admin
export const deleteEnquiry = catchAsync(async (req, res, next) => {
  const enquiry = await Enquiry.findById(req.params.id)

  if (!enquiry) {
    return next(new AppError(`Enquiry not found with id of ${req.params.id}`, 404))
  }

  await enquiry.deleteOne()

  res.status(200).json({
    success: true,
    data: {},
  })
})
