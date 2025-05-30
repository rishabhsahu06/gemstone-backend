import express from "express"
import { getDashboardStats, getAllOrders, getAllUsers } from "../controllers/admin.controller.js"
import { protect, authorize } from "../middleware/auth.middleware.js"

const router = express.Router()

// All admin routes are protected and restricted to admin role
router.use(protect, authorize("admin"))

router.get("/dashboard", getDashboardStats)
router.get("/orders", getAllOrders)
router.get("/users", getAllUsers)

export default router
