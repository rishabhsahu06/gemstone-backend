import Product from "../models/product.model.js";
import { AppError } from "../utils/appError.js";
import { catchAsync } from "../utils/catchAsync.js";

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = catchAsync(async (req, res, next) => {
  const {
    search,
    minPrice,
    maxPrice,
    isAvailable,
    sort,
    fields,
    page = 1,
    limit = 10,
    ...filters
  } = req.query;

  const queryObj = { ...filters };

  // Advanced filtering (e.g., price[gte]=10)
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);
  let mongoQuery = Product.find(JSON.parse(queryStr));

  // Search
  if (search) {
    mongoQuery = mongoQuery.find({ $text: { $search: search } });
  }

  // Price filtering
  if (minPrice || maxPrice) {
    mongoQuery = mongoQuery.find({
      discountedPrice: {
        ...(minPrice && { $gte: Number(minPrice) }),
        ...(maxPrice && { $lte: Number(maxPrice) }),
      },
    });
  }

  // Availability
  if (isAvailable !== undefined) {
    mongoQuery = mongoQuery.find({ isAvailable: isAvailable === "true" });
  }

  // Sorting
  if (sort) {
    const sortBy = sort.split(",").join(" ");
    mongoQuery = mongoQuery.sort(sortBy);
  } else {
    mongoQuery = mongoQuery.sort("-createdAt");
  }

  // Field selection
  if (fields) {
    const selectFields = fields.split(",").join(" ");
    mongoQuery = mongoQuery.select(selectFields);
  } else {
    mongoQuery = mongoQuery.select("-__v");
  }

  // Pagination
  const skip = (page - 1) * limit;
  mongoQuery = mongoQuery.skip(skip).limit(Number(limit));

  // Execute
  const products = await mongoQuery;
  const total = await Product.countDocuments(JSON.parse(queryStr));

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
    data: products,
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError(`Product not found with ID: ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = catchAsync(async (req, res, next) => {
  const {
    name,
    description,
    originalPrice,
    primaryCategory,
    images,
    stock,
  } = req.body;

  // Validate required fields
  if (
    !name ||
    !description ||
    originalPrice == null ||
    !primaryCategory ||
    !Array.isArray(images) ||
    images.length === 0 ||
    stock == null
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide all required fields: name, description, originalPrice, primaryCategory, images, and stock.",
    });
  }

  // Generate slug from name
  const slug = name.toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-");

  // Save all data from request body, along with generated slug
  const product = await Product.create({
    ...req.body,
    slug,
    // id:Date.now(),
  });

  res.status(201).json({
    success: true,
    data: product,
  });
});


// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return next(new AppError(`Product not found with ID: ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError(`Product not found with ID: ${req.params.id}`, 404));
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
    data: {},
  });
});

// @desc    Get products by primary category
// @route   GET api/products/get-primaryCategory/:primaryCategory
// @access  Public
export const getProductsByPrimaryCategory = async (req, res) => {
  try {
    const { primaryCategory } = req.params;

    const products = await Product.find({ primaryCategory });

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found for this category" });
    }

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
