import Product from "../models/product.model.js";
import { AppError } from "../utils/appError.js";
import { catchAsync } from "../utils/catchAsync.js";
import NodeCache from "node-cache";

// Initialize cache with TTL (Time To Live) settings
const cache = new NodeCache({
  stdTTL: 1, // Default cache time: 1 second means 1 if 600 seconds means (600)
  checkperiod: 60, // Check for expired keys every 1 minute
  useClones: false, // For better performance, set to true if you modify cached objects
});

// Cache key generators
const generateCacheKey = {
  allProducts: (query) => `products:all:${JSON.stringify(query)}`,
  singleProduct: (id) => `product:${id}`,
  productsByCategory: (category) => `products:category:${category}`,
  productCount: (query) => `products:count:${JSON.stringify(query)}`,
  primaryCategories: () => `products:primary-categories`,
};

// Cache invalidation helpers
const invalidateProductCaches = (productId = null, primaryCategory = null) => {
  // Clear all product list caches
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => 
    key.startsWith('products:all:') || 
    key.startsWith('products:count:') ||
    (primaryCategory && key === `products:category:${primaryCategory}`)
  );
  
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
  }
  
  // Clear specific product cache if ID provided
  if (productId) {
    cache.del(generateCacheKey.singleProduct(productId));
  }

  // Clear primary categories cache when products are modified
  cache.del(generateCacheKey.primaryCategories());
};

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
    productType,
    ...filters
  } = req.query;

  // Generate cache keys
  const queryForCache = { search, minPrice, maxPrice, isAvailable, sort, fields, page, limit, productType, ...filters };
  const cacheKey = generateCacheKey.allProducts(queryForCache);
  const countCacheKey = generateCacheKey.productCount({ productType, ...filters });

  // Try to get from cache first
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.status(200).json(cachedResult);
  }

  const queryObj = { ...filters };

  // Advanced filtering (e.g., price[gte]=10)
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);
  const parsedFilters = JSON.parse(queryStr);

  if (productType === "jewellery") {
    parsedFilters.productType = "jewellery";
  } else if (productType === "gemstone") {
    parsedFilters.$or = [
      { productType: "gemstone" },
      { productType: { $exists: false } },
      { productType: null },
    ];
  }

  let mongoQuery = Product.find(parsedFilters);

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

  // Execute queries
  const [products, total] = await Promise.all([
    mongoQuery,
    cache.get(countCacheKey) || Product.countDocuments(parsedFilters)
  ]);

  // Cache the count if not already cached
  if (!cache.get(countCacheKey)) {
    cache.set(countCacheKey, total, 300); // Cache count for 5 minutes
  }

  const response = {
    success: true,
    count: products.length,
    total,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
    data: products,
  };

  // Cache the response for 10 minutes
  cache.set(cacheKey, response, 600);

  res.status(200).json(response);
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = catchAsync(async (req, res, next) => {
  const cacheKey = generateCacheKey.singleProduct(req.params.id);
  
  // Try to get from cache first
  const cachedProduct = cache.get(cacheKey);
  if (cachedProduct) {
    return res.status(200).json({
      success: true,
      data: cachedProduct,
    });
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError(`Product not found with ID: ${req.params.id}`, 404));
  }

  // Cache the product for 15 minutes (longer for individual products)
  cache.set(cacheKey, product, 900);

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Get all primary categories
// @route   GET /api/products/primary-categories
// @access  Public
export const getPrimaryCategories = catchAsync(async (req, res, next) => {
  const cacheKey = generateCacheKey.primaryCategories();
  
  // Try to get from cache first
  const cachedCategories = cache.get(cacheKey);
  if (cachedCategories) {
    return res.status(200).json(cachedCategories);
  }

  // Get products with distinct primary categories and their images
  const products = await Product.aggregate([
    {
      $match: {
        primaryCategory: { $ne: "jewellery" },
        productType: { $ne: "jewellery" },
      },
    },
    {
      $group: {
        _id: '$primaryCategory',
        primaryCategoryImage: { $first: '$primaryCategoryImage' }
      }
    },
    {
      $project: {
        _id: 0,
        primaryCategory: '$_id',
        primaryCategoryImage: 1
      }
    }
  ]);

  // Create response with id, name, and image for each category
  const formattedCategories = products.map((product, index) => ({
    id: index + 1,
    name: product.primaryCategory,
    displayName: product.primaryCategory
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '), // Convert "yellow-sapphire" to "Yellow Sapphire"
    primaryCategoryImage: product.primaryCategoryImage
  }));

  const response = {
    success: true,
    count: formattedCategories.length,
    data: formattedCategories,
  };

  // Cache the response for 30 minutes (longer since categories don't change often)
  cache.set(cacheKey, response, 1800);

  res.status(200).json(response);
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = catchAsync(async (req, res, next) => {
  const isJewellery = req.body.productType === "jewellery";

  if (isJewellery) {
    req.body.primaryCategory = req.body.primaryCategory || "jewellery";
    req.body.secondaryCategory = req.body.secondaryCategory || "none";
    if (req.body.isAvailable === undefined || req.body.isAvailable === null) {
      req.body.isAvailable = true;
    }
  }

  const {
    name,
    description,
    originalPrice,
    primaryCategory,
    images,
    stock,
    jewelleryType,
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

  if (isJewellery && !jewelleryType) {
    return res.status(400).json({
      success: false,
      message: "Please provide jewelleryType for jewellery products.",
    });
  }

  // Generate slug from name
  const slug = name.toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-");

  // Save all data from request body, along with generated slug
  const product = await Product.create({
    ...req.body,
    slug,
    productType: isJewellery ? "jewellery" : req.body.productType || "gemstone",
  });

  // Invalidate relevant caches
  invalidateProductCaches(null, primaryCategory);

  res.status(201).json({
    success: true,
    data: product,
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = catchAsync(async (req, res, next) => {
  // Get the old product to know its category for cache invalidation
  const oldProduct = await Product.findById(req.params.id);
  
  if (!oldProduct) {
    return next(new AppError(`Product not found with ID: ${req.params.id}`, 404));
  }

  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Invalidate caches for both old and potentially new categories
  const oldCategory = oldProduct.primaryCategory;
  const newCategory = req.body.primaryCategory || oldCategory;
  
  invalidateProductCaches(req.params.id, oldCategory);
  if (newCategory !== oldCategory) {
    invalidateProductCaches(null, newCategory);
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

  // Invalidate relevant caches
  invalidateProductCaches(req.params.id, product.primaryCategory);

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
    data: {},
  });
});

// @desc    Get products by primary category
// @route   GET api/products/get-primaryCategory/:primaryCategory
// @access  Public
export const getProductsByPrimaryCategory = catchAsync(async (req, res, next) => {
  const { primaryCategory } = req.params;
 
  const cacheKey = generateCacheKey.productsByCategory(primaryCategory);

  // Try to get from cache first
  const cachedProducts = cache.get(cacheKey);
  if (cachedProducts) {
    return res.status(200).json(cachedProducts);
  }

  const products = await Product.find({ primaryCategory });

  if (products.length === 0) {
    return res.status(404).json({ 
      success: false,
      message: "No products found for this category" 
    });
  }

  const response = {
    success: true,
    count: products.length,
    data: products,
  };

  // Cache the products for 10 minutes
  cache.set(cacheKey, response, 600);

  res.status(200).json(response);
});

// @desc    Clear cache (utility endpoint for admin)
// @route   DELETE /api/products/cache
// @access  Private/Admin
export const clearCache = catchAsync(async (req, res, next) => {
  const { key } = req.query;
  
  if (key) {
    // Clear specific cache key
    const deleted = cache.del(key);
    return res.status(200).json({
      success: true,
      message: `Cache key cleared: ${key}`,
      deleted: deleted > 0,
    });
  } else {
    // Clear all product-related caches
    const keys = cache.keys();
    const productKeys = keys.filter(k => k.startsWith('product'));
    cache.del(productKeys);
    
    return res.status(200).json({
      success: true,
      message: "All product caches cleared",
      clearedKeys: productKeys.length,
    });
  }
});

// @desc    Get cache statistics
// @route   GET /api/products/cache/stats
// @access  Private/Admin
export const getCacheStats = catchAsync(async (req, res, next) => {
  const stats = cache.getStats();
  const keys = cache.keys();
  
  res.status(200).json({
    success: true,
    data: {
      ...stats,
      totalKeys: keys.length,
      productKeys: keys.filter(k => k.startsWith('product')).length,
    },
  });
});

// Export cache instance for use in other modules if needed
export { cache };