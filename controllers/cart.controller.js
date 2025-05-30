import Cart from "../models/cart.model.js"
import Product from "../models/product.model.js"
import { AppError } from "../utils/appError.js"
import { catchAsync } from "../utils/catchAsync.js"

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
// export const getCart = catchAsync(async (req, res, next) => {
//   let cart = await Cart.findOne({ user: req.user.id }).populate({
//     path: "items.product",
//     // select: "name images discountedPrice originalPrice isAvailable stock", //that means only these fields will be give to response
//   select:"-__v"
//   })

//   if (!cart) {
//     // Create empty cart if none exists
//     cart = await Cart.create({
//       user: req.user.id,
//       items: [],
//       totalAmount: 0,
//     })
//   }

//   res.status(200).json({
//     success: true,
//     data: cart,
//   })
// })
export const getCart = catchAsync(async (req, res, next) => {
    let cart = await Cart.findOne({ user: req.user.id }).populate({
    path: "items.product",
    // select: "name images discountedPrice originalPrice isAvailable stock", //that means only these fields will be give to response
  select:"-__v"
  })

  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: [],
      totalAmount: 0,
    });
  }

  const cartItems = cart.items.map((item) => {
    const subtotal = item.price * item.quantity;
    return {
      _id: item._id,
      quantity: item.quantity,
      price: item.price,
      subtotal,
      product: item.product,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      _id: cart._id,
      user: cart.user,
      items: cartItems,
      totalAmount: cart.totalAmount,
    },
  });
});


// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
export const addItemToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product) return next(new AppError("Product not found", 404));

  if (!product.isAvailable || product.stock < quantity) {
    return next(new AppError("Product is not available in the requested quantity", 400));
  }

  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: [],
      totalAmount: 0,
    });
  }

  const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);
  const price = product.discountedPrice || product.originalPrice;

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
    cart.items[itemIndex].price = price;
  } else {
    cart.items.push({
      product: productId,
      quantity,
      price,
    });
  }

  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await cart.save();

  // Populate full product
  cart = await Cart.findById(cart._id).populate("items.product");

  const cartItems = cart.items.map((item) => ({
    _id: item._id,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.price * item.quantity,
    product: item.product,
  }));

  res.status(200).json({
    success: true,
    data: {
      _id: cart._id,
      user: cart.user,
      items: cartItems,
      totalAmount: cart.totalAmount,
    },
  });
});


// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Private
export const updateCartItem = catchAsync(async (req, res, next) => {
  const { quantity } = req.body
  const { itemId } = req.params

  // Validate quantity
  if (quantity < 1) {
    return next(new AppError("Quantity must be at least 1", 400))
  }

  // Get user cart
  let cart = await Cart.findOne({ user: req.user.id })
  if (!cart) {
    return next(new AppError("Cart not found", 404))
  }

  // Find item in cart
  const itemIndex = cart.items.findIndex((item) => item._id.toString() === itemId)

  if (itemIndex === -1) {
    return next(new AppError("Item not found in cart", 404))
  }

  // Check product availability and stock
  const product = await Product.findById(cart.items[itemIndex].product)
  if (!product.isAvailable || product.stock < quantity) {
    return next(new AppError("Product is not available in the requested quantity", 400))
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity

  // Calculate total
  let total = 0
  for (const item of cart.items) {
    total += item.price * item.quantity
  }
  cart.totalAmount = total

  await cart.save()

  // Populate product details
  cart = await Cart.findById(cart._id).populate({
    path: "items.product",
    select: "name images discountedPrice originalPrice isAvailable stock",
  })

  res.status(200).json({
    success: true,
    data: cart,
  })
})

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
export const removeCartItem = catchAsync(async (req, res, next) => {
  const { itemId } = req.params

  // Get user cart
  let cart = await Cart.findOne({ user: req.user.id })
  if (!cart) {
    return next(new AppError("Cart not found", 404))
  }

  // Remove item
  cart.items = cart.items.filter((item) => item._id.toString() !== itemId)

  // Calculate total
  let total = 0
  for (const item of cart.items) {
    total += item.price * item.quantity
  }
  cart.totalAmount = total

  await cart.save()

  // Populate product details
  cart = await Cart.findById(cart._id).populate({
    path: "items.product",
    select: "name images discountedPrice originalPrice isAvailable stock",
  })

  res.status(200).json({
    success: true,
    data: cart,
  })
})

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = catchAsync(async (req, res, next) => {
  // Get user cart
  const cart = await Cart.findOne({ user: req.user.id })
  if (!cart) {
    return next(new AppError("Cart not found", 404))
  }

  // Clear items and reset total
  cart.items = []
  cart.totalAmount = 0

  await cart.save()

  res.status(200).json({
    success: true,
    data: cart,
  })
})
