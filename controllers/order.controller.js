import Razorpay from "razorpay"
import crypto from "crypto"
import Order from "../models/order.model.js"
import Cart from "../models/cart.model.js"
import Product from "../models/product.model.js"
import User from "../models/user.model.js"
import { AppError } from "../utils/appError.js"
import { catchAsync } from "../utils/catchAsync.js"
import config from "../config/config.js"
import { sendWhatsAppMessage, validateWhatsAppConfig } from "../services/watsapp.service.js"

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
    currency: "INR",
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

  console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id })

  // Verify payment signature
  const body = razorpay_order_id + "|" + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body.toString())
    .digest("hex")

  if (expectedSignature !== razorpay_signature) {
    console.error('Payment signature verification failed')
    return next(new AppError("Payment verification failed", 400))
  }

  try {
    // Get order details from Razorpay
    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id)
    const payment = await razorpay.payments.fetch(razorpay_payment_id)

    console.log('Payment verified successfully:', payment.id)

    // Create order in database
    const order = await createOrder(razorpayOrder, payment, req.user.id)

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      orderId: order._id,
    })
  } catch (error) {
    console.error('Error in payment verification:', error)
    return next(new AppError("Failed to process order after payment verification", 500))
  }
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
    
    console.log("Payment captured:", payment.id)
  }

  res.status(200).json({ received: true })
})

// @desc    Get user orders (or all orders for admin)
// @route   GET /api/orders
// @access  Private
export const getUserOrders = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1
  const limit = parseInt(req.query.limit, 10) || 10
  const skip = (page - 1) * limit

  // Build query - if admin, get all orders, otherwise only user's orders
  const query = req.user.role === "admin" ? {} : { user: req.user.id }
  
  // Add status filter if provided
  if (req.query.status) {
    query.status = req.query.status
  }

  // Add user filter for admin (optional - to filter by specific user)
  if (req.user.role === "admin" && req.query.userId) {
    query.user = req.query.userId
  }

  // Add date range filter if provided
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {}
    if (req.query.startDate) {
      query.createdAt.$gte = new Date(req.query.startDate)
    }
    if (req.query.endDate) {
      query.createdAt.$lte = new Date(req.query.endDate)
    }
  }

  const orders = await Order.find(query)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit)
    .populate({
      path: "items.product",
      select: "name images category"
    })
    .populate({
      path: "user",
      select: "name email phone"
    })

  const total = await Order.countDocuments(query)

  // Calculate summary for admin dashboard
  let summary = null
  if (req.user.role === "admin") {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    const [
      todayOrders,
      monthlyOrders,
      pendingOrders,
      totalRevenue,
      todayRevenue
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Order.countDocuments({ createdAt: { $gte: thisMonth, $lt: nextMonth } }),
      Order.countDocuments({ status: { $in: ["Processing", "Shipped"] } }),
      Order.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: today, $lt: tomorrow },
            status: { $ne: "Cancelled" }
          } 
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])
    ])

    summary = {
      todayOrders,
      monthlyOrders,
      pendingOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      todayRevenue: todayRevenue[0]?.total || 0
    }
  }

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: orders,
    summary, // Only included for admin users
  })
})

// @desc    Get all orders with advanced filtering (Admin only)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
export const getAllOrdersAdmin = catchAsync(async (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return next(new AppError("Access denied. Admin privileges required.", 403))
  }

  const page = parseInt(req.query.page, 10) || 1
  const limit = parseInt(req.query.limit, 10) || 20
  const skip = (page - 1) * limit

  // Build advanced query for admin
  const query = {}
  
  // Filter by status
  if (req.query.status) {
    query.status = req.query.status
  }

  // Filter by user ID
  if (req.query.userId) {
    query.user = req.query.userId
  }

  // Filter by payment method
  if (req.query.paymentMethod) {
    query["paymentInfo.method"] = req.query.paymentMethod
  }

  // Filter by date range
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {}
    if (req.query.startDate) {
      query.createdAt.$gte = new Date(req.query.startDate)
    }
    if (req.query.endDate) {
      query.createdAt.$lte = new Date(req.query.endDate)
    }
  }

  // Filter by amount range
  if (req.query.minAmount || req.query.maxAmount) {
    query.totalAmount = {}
    if (req.query.minAmount) {
      query.totalAmount.$gte = parseFloat(req.query.minAmount)
    }
    if (req.query.maxAmount) {
      query.totalAmount.$lte = parseFloat(req.query.maxAmount)
    }
  }

  // Search by order ID or customer name/email
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i')
    
    // First, find users matching the search term
    const matchingUsers = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    }).select('_id')

    const userIds = matchingUsers.map(user => user._id)

    query.$or = [
      { _id: searchRegex },
      { user: { $in: userIds } }
    ]
  }

  // Sort options
  const sortOptions = {
    newest: "-createdAt",
    oldest: "createdAt",
    amount_high: "-totalAmount",
    amount_low: "totalAmount",
    status: "status"
  }
  
  const sortBy = sortOptions[req.query.sortBy] || "-createdAt"

  const orders = await Order.find(query)
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .populate({
      path: "items.product",
      select: "name images category originalPrice discountedPrice"
    })
    .populate({
      path: "user",
      select: "name email phone createdAt"
    })

  const total = await Order.countDocuments(query)

  // Calculate analytics for filtered results
  const analytics = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        avgOrderValue: { $avg: "$totalAmount" },
        totalOrders: { $sum: 1 }
      }
    }
  ])

  // Status breakdown
  const statusBreakdown = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        revenue: { $sum: "$totalAmount" }
      }
    }
  ])

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: orders,
    analytics: analytics[0] || { totalRevenue: 0, avgOrderValue: 0, totalOrders: 0 },
    statusBreakdown,
  })
})

// @desc    Get order statistics for admin dashboard
// @route   GET /api/orders/admin/stats
// @access  Private/Admin
export const getOrderStats = catchAsync(async (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return next(new AppError("Access denied. Admin privileges required.", 403))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const thisWeek = new Date(today)
  thisWeek.setDate(today.getDate() - 7)
  
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  
  const thisYear = new Date(today.getFullYear(), 0, 1)

  // Parallel queries for better performance
  const [
    totalOrders,
    todayOrders,
    weeklyOrders,
    monthlyOrders,
    yearlyOrders,
    totalRevenue,
    todayRevenue,
    weeklyRevenue,
    monthlyRevenue,
    yearlyRevenue,
    totalProducts,
    statusCounts,
    recentOrders,
    topCustomers,
    dailyStats
  ] = await Promise.all([
    // Order counts
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.countDocuments({ createdAt: { $gte: thisWeek } }),
    Order.countDocuments({ createdAt: { $gte: thisMonth } }),
    Order.countDocuments({ createdAt: { $gte: thisYear } }),
    
    // Revenue
    Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: today }, status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thisWeek }, status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thisMonth }, status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thisYear }, status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]),
    
    // Total products count
    Product.countDocuments(),
    
    // Status breakdown
    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    
    // Recent orders
    Order.find()
      .sort("-createdAt")
      .limit(10)
      .populate("user", "name email")
      .select("_id totalAmount status createdAt"),
    
    // Top customers
    Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          name: "$userDetails.name",
          email: "$userDetails.email",
          totalSpent: 1,
          orderCount: 1
        }
      }
    ]),
    
    // Daily stats for the last 30 days
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $ne: ["$status", "Cancelled"] }, "$totalAmount", 0]
            }
          }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ])
  ])

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalOrders,
        totalProducts,
        todayOrders,
        weeklyOrders,
        monthlyOrders,
        yearlyOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        weeklyRevenue: weeklyRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        yearlyRevenue: yearlyRevenue[0]?.total || 0,
        avgOrderValue: totalOrders > 0 ? (totalRevenue[0]?.total || 0) / totalOrders : 0
      },
      statusBreakdown: statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {}),
      recentOrders,
      topCustomers,
      dailyStats: dailyStats.map(stat => ({
        date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
        orders: stat.orders,
        revenue: stat.revenue
      }))
    }
  })
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = catchAsync(async (req, res, next) => {
  const orderId = req.params.id

  // Validate ObjectId format
  if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid order ID format", 400))
  }

  const order = await Order.findById(orderId)
    .populate({
      path: "user",
      select: "name email phone"
    })
    .populate({
      path: "items.product",
      select: "name images description category"
    })

  if (!order) {
    return next(new AppError("Order not found", 404))
  }

  // Check if order belongs to user or user is admin
  if (order.user._id.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Not authorized to access this order", 403))
  }

  // Calculate order summary
  const orderSummary = {
    subtotal: order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: order.totalAmount
  }

  res.status(200).json({
    success: true,
    data: {
      ...order.toObject(),
      summary: orderSummary
    },
  })
})

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private/Admin
export const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status, trackingNumber } = req.body
  const orderId = req.params.id

  // Validate status
  const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled","Pending"]
  if (!validStatuses.includes(status)) {
    return next(new AppError("Invalid order status", 400))
  }

  const order = await Order.findById(orderId)
    .populate({
      path: "user",
      select: "name phone email"
    })

  if (!order) {
    return next(new AppError("Order not found", 404))
  }

  // Don't allow status changes for delivered or cancelled orders
  if (order.status === "Delivered" || order.status === "Cancelled") {
    return next(new AppError("Cannot update status of delivered or cancelled orders", 400))
  }

  const oldStatus = order.status
  order.status = status

  // Set delivery date if status is delivered
  if (status === "Delivered" && oldStatus !== "Delivered") {
    order.deliveredAt = new Date()
  }

  // Add tracking number if provided
  if (trackingNumber) {
    order.trackingNumber = trackingNumber
  }

  await order.save()

  // Send WhatsApp notification for status update
  await sendOrderStatusUpdate(order, oldStatus)

  res.status(200).json({
    success: true,
    message: `Order status updated from ${oldStatus} to ${status}`,
    data: order,
  })
})


// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = catchAsync(async (req, res, next) => {
  const orderId = req.params.id
  const { reason } = req.body

  const order = await Order.findById(orderId)

  if (!order) {
    return next(new AppError("Order not found", 404))
  }

  // Check if order belongs to user
  if (order.user.toString() !== req.user.id) {
    return next(new AppError("Not authorized to cancel this order", 403))
  }

  // Only allow cancellation if order is not shipped or delivered
  if (order.status === "Shipped" || order.status === "Delivered") {
    return next(new AppError("Cannot cancel shipped or delivered orders", 400))
  }

  if (order.status === "Cancelled") {
    return next(new AppError("Order is already cancelled", 400))
  }

  // Update order status
  order.status = "Cancelled"
  order.cancelledAt = new Date()
  order.cancellationReason = reason || "Cancelled by customer"

  // Restore product stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity }
    })
  }

  await order.save()

  res.status(200).json({
    success: true,
    message: "Order cancelled successfully",
    data: order,
  })
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

// Helper function to send WhatsApp order confirmation
// Helper function to send WhatsApp order confirmation
// Helper function to send WhatsApp order confirmation
const sendOrderConfirmation = async (order, user) => {
  try {
    // Validate WhatsApp configuration before attempting to send
    if (!validateWhatsAppConfig()) {
      console.warn('WhatsApp service not properly configured, skipping notifications')
      return
    }

    // Check if notification already sent to avoid duplicates
    if (order.whatsappNotificationSent) {
      console.log('WhatsApp notification already sent for order:', order._id)
      return
    }

    // Validate phone numbers
    if (!user.phone) {
      console.warn('User phone number not available for WhatsApp notification')
      return
    }

    // Format phone numbers (ensure they have country code)
    const customerPhone = formatPhoneNumber(user.phone)
    const adminPhone = config.adminPhone ? formatPhoneNumber(config.adminPhone) : null

    // Prepare message for customer
    let customerMessage = `🎉 Thank you for your order, ${user.name}!\n\n`
    customerMessage += `📦 Order ID: ${order._id}\n`
    customerMessage += `💰 Total Amount: ₹${order.totalAmount}\n\n`
    customerMessage += `📋 Items Ordered:\n`

    for (const item of order.items) {
      customerMessage += `• ${item.name} x${item.quantity}: ₹${item.price * item.quantity}\n`
    }

    customerMessage += `\n✅ Payment Status: Confirmed\n`
    customerMessage += `🚚 We'll process your order soon and keep you updated!\n\n`
    customerMessage += `Thank you for shopping with us! 🛍️`

    // Send message to customer with error handling
    try {
      console.log('Sending WhatsApp message to customer:', customerPhone)
      await sendWhatsAppMessage(customerPhone, customerMessage)
      console.log('Customer notification sent successfully')
    } catch (customerError) {
      console.error('Failed to send customer WhatsApp notification:', customerError.message)
      // Continue with admin notification even if customer notification fails
    }

    // Prepare and send admin message
    if (adminPhone) {
      try {
        let adminMessage = `🔔 New Order Received!\n\n`
        adminMessage += `📦 Order ID: ${order._id}\n`
        adminMessage += `👤 Customer: ${user.name}\n`
        adminMessage += `📧 Email: ${user.email}\n`
        adminMessage += `📱 Phone: ${user.phone}\n`
        adminMessage += `💰 Total Amount: ₹${order.totalAmount}\n\n`
        adminMessage += `📋 Items:\n`

        for (const item of order.items) {
          adminMessage += `• ${item.name} x${item.quantity}: ₹${item.price * item.quantity}\n`
        }

        adminMessage += `\n📍 Shipping Address:\n`
        const addr = order.shippingAddress
        adminMessage += `${addr.street}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`

        console.log('Sending WhatsApp message to admin:', adminPhone)
        await sendWhatsAppMessage(adminPhone, adminMessage)
        console.log('Admin notification sent successfully')
      } catch (adminError) {
        console.error('Failed to send admin WhatsApp notification:', adminError.message)
      }
    } else {
      console.warn('Admin phone number not configured, skipping admin notification')
    }

    // Mark notification as sent (even if some failed)
    order.whatsappNotificationSent = true
    await order.save()
    
    console.log('WhatsApp notification process completed for order:', order._id)
  } catch (error) {
    console.error("WhatsApp notification error for order", order._id, ":", error.message)
    // Don't throw error to avoid breaking the order flow
  }
}

// Helper function to format phone numbers
const formatPhoneNumber = (phone) => {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '')
  
  // If phone doesn't start with country code, assume India (+91)
  if (cleanPhone.length === 10) {
    return `+91${cleanPhone}`
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    return `+${cleanPhone}`
  } else if (phone.startsWith('+')) {
    return phone
  } else {
    return `+${cleanPhone}`
  }
}

// Helper function to send WhatsApp status update
const sendOrderStatusUpdate = async (order, oldStatus) => {
  try {
    let message = `Order Status Update\n\n`
    message += `Order ID: ${order._id}\n`
    message += `Status changed from: ${oldStatus} → ${order.status}\n`

    if (order.trackingNumber) {
      message += `Tracking Number: ${order.trackingNumber}\n`
    }

    if (order.status === "Shipped") {
      message += `\nYour order has been shipped and is on its way!`
    } else if (order.status === "Delivered") {
      message += `\nYour order has been delivered. Thank you for shopping with us!`
    }

    // Send message to customer
    await sendWhatsAppMessage(order.user.phone, message)
  } catch (error) {
    console.error("WhatsApp status update error:", error)
  }
}