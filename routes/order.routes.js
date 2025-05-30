import express from "express"
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/order.controller.js"
import { catchAsync } from "../utils/catchAsync.js"
import { protect, authorize } from "../middleware/auth.middleware.js"

const router = express.Router()

// Razorpay webhook - needs raw body
router.post("/webhook", express.raw({ type: "application/json" }), razorpayWebhook)

// Protected routes
router.use(protect)

router.post("/create-order", createRazorpayOrder)
router.post("/verify-payment", verifyRazorpayPayment)
router.get("/", getUserOrders)
router.get("/:id", getOrderById)

// Admin only routes
router.put("/:id", authorize("admin"), updateOrderStatus)

export default router