import express from "express"
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrdersAdmin,
  getOrderStats,
} from "../controllers/order.controller.js"
import { protect, authorize } from "../middleware/auth.middleware.js"

const router = express.Router()

// Razorpay webhook - needs raw body (must be before other middleware)
router.post("/webhook", express.raw({ type: "application/json" }), razorpayWebhook)

// Protected routes
router.use(protect)

// Order creation and payment
router.post("/create-order", createRazorpayOrder)
router.post("/verify-payment", verifyRazorpayPayment)

// Order retrieval
router.get("/", getUserOrders)
router.get("/:id", getOrderById)


router.put("/:id/cancel", cancelOrder)

// Admin only routes
router.put("/:id", authorize("admin"), updateOrderStatus)
router.get("/admin/all", authorize("admin"), getAllOrdersAdmin)
router.get("/admin/stats", authorize("admin"), getOrderStats)//analytical data
export default router