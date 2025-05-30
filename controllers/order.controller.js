import Razorpay from "razorpay"
import crypto from "crypto"
import Order from "../models/order.model.js"
import Cart from "../models/cart.model.js"
import Product from "../models/product.model.js"
import User from "../models/user.model.js"
import { AppError } from "../utils/appError.js"
import { catchAsync } from "../utils/catchAsync.js"
import config from "../config/config.js"
import { sendWhatsAppMessage } from "../services/watsapp.service.js"

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
})

// @desc    Create Razorpay order
// @route   POST /api/orders/create-order
// @access  Private
export const createRazorpayOrder = catchAsync(async (req, res, next) => {
  const { shippingAddress } = req.body

  // Validate shipping address
  if (
    !shippingAddress ||
    !shippingAddress.street ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.postalCode ||
    !shippingAddress.country
  ) {
    return next(new AppError("Please provide complete shipping address", 400))
  }

  // Get user cart
  console.log(req.user.id, "User ID for cart lookup")
  const cart = await Cart.findOne({ user: req.user.id }).populate({
    path: "items.product",
    select: "name images discountedPrice originalPrice isAvailable stock",
  })
console.log(cart, "Cart details for user")
  if (!cart || cart.items.length === 0) {
    return next(new AppError("Your cart is empty", 400))
  }

  // Check product availability and stock
  for (const item of cart.items) {
    const product = item.product
    if (!product.isAvailable || product.stock < item.quantity) {
      return next(new AppError(`${product.name} is not available in the requested quantity`, 400))
    }
  }

  // Convert amount to paise (Razorpay uses paise, not rupees)
  const amount = Math.round(cart.totalAmount * 100)

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: amount,
    currency: "INR", // Change to your preferred currency
    receipt: `order_${Date.now()}`,
    notes: {
      userId: req.user.id.toString(),
      cartId: cart._id.toString(),
      shippingAddress: JSON.stringify(shippingAddress),
    },
  })
 res.status(200).json({
    success: true,
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key: config.razorpay.keyId,
  })
})

// @desc    Verify Razorpay payment
// @route   POST /api/orders/verify-payment
// @access  Private
export const verifyRazorpayPayment = catchAsync(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

  // Verify payment signature
  const body = razorpay_order_id + "|" + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body.toString())
    .digest("hex")

  if (expectedSignature !== razorpay_signature) {
    return next(new AppError("Payment verification failed", 400))
  }

  // Get order details from Razorpay
  const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id)
  const payment = await razorpay.payments.fetch(razorpay_payment_id)

  // Create order in database
  const order = await createOrder(razorpayOrder, payment, req.user.id)

  res.status(200).json({
    success: true,
    message: "Payment verified successfully",
    orderId: order._id,
  })
})

// @desc    Handle Razorpay webhook
// @route   POST /api/orders/webhook
// @access  Public
export const razorpayWebhook = catchAsync(async (req, res, next) => {
  const signature = req.headers["x-razorpay-signature"]
  const body = req.body

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.webhookSecret)
    .update(body)
    .digest("hex")

  if (expectedSignature !== signature) {
    return res.status(400).send("Webhook signature verification failed")
  }

  const event = JSON.parse(body)

  // Handle payment.captured event
  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity
    const orderId = payment.order_id

    // Get order details
    const razorpayOrder = await razorpay.orders.fetch(orderId)
    
    // You can add additional processing here if needed
    console.log("Payment captured:", payment.id)
  }

  res.status(200).json({ received: true })
})

// Helper function to create order after successful payment
const createOrder = async (razorpayOrder, payment, userId) => {
  const cartId = razorpayOrder.notes.cartId
  const shippingAddress = JSON.parse(razorpayOrder.notes.shippingAddress)

  // Get user cart
  const cart = await Cart.findById(cartId).populate({
    path: "items.product",
    select: "name images stock",
  })

  if (!cart) {
    throw new AppError("Cart not found", 404)
  }

  // Create order items
  const orderItems = cart.items.map((item) => {
    return {
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.price,
      image: item.product.images[0]?.url || "",
    }
  })

  // Create order
  const order = await Order.create({
    user: userId,
    items: orderItems,
    shippingAddress,
    paymentInfo: {
      id: payment.id,
      orderId: razorpayOrder.id,
      status: payment.status,
      method: "Razorpay",
    },
    totalAmount: cart.totalAmount,
  })

  // Update product stock
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity },
    })
  }

  // Clear user cart
  cart.items = []
  cart.totalAmount = 0
  await cart.save()

  // Get user details for WhatsApp notification
  const user = await User.findById(userId)

  // Send WhatsApp notification
  await sendOrderConfirmation(order, user)

  return order
}

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
export const getUserOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id }).sort("-createdAt")

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  })
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)

  if (!order) {
    return next(new AppError("Order not found", 404))
  }

  // Check if order belongs to user or user is admin
  if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Not authorized to access this order", 401))
  }

  res.status(200).json({
    success: true,
    data: order,
  })
})

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private/Admin
export const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body

  const order = await Order.findById(req.params.id)

  if (!order) {
    return next(new AppError("Order not found", 404))
  }

  order.status = status

  if (status === "Delivered") {
    order.deliveredAt = Date.now()
  }

  await order.save()

  res.status(200).json({
    success: true,
    data: order,
  })
})

// Helper function to send WhatsApp order confirmation
const sendOrderConfirmation = async (order, user) => {
  try {
    if (order.whatsappNotificationSent) {
      return
    }

    // Prepare message for customer
    let customerMessage = `Thank you for your order, ${user.name}!\n\n`
    customerMessage += `Order ID: ${order._id}\n`
    customerMessage += `Total Amount: ₹${order.totalAmount}\n\n`
    customerMessage += `Items:\n`

    for (const item of order.items) {
      customerMessage += `- ${item.name} x${item.quantity}: ₹${item.price * item.quantity}\n`
    }

    customerMessage += `\nWe'll process your order soon. Thank you for shopping with us!`

    // Send message to customer
    await sendWhatsAppMessage(user.phone, customerMessage)

    // Prepare message for admin
    let adminMessage = `New Order Received!\n\n`
    adminMessage += `Order ID: ${order._id}\n`
    adminMessage += `Customer: ${user.name} (${user.email})\n`
    adminMessage += `Total Amount: ₹${order.totalAmount}\n\n`
    adminMessage += `Items:\n`

    for (const item of order.items) {
      adminMessage += `- ${item.name} x${item.quantity}: ₹${item.price * item.quantity}\n`
    }

    // Send message to admin
    await sendWhatsAppMessage(config.adminPhone, adminMessage)

    // Update order
    order.whatsappNotificationSent = true
    await order.save()
  } catch (error) {
    console.error("WhatsApp notification error:", error)
  }
}