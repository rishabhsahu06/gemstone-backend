import express from "express"
import {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from "../controllers/enquiry.controller.js"
import { protect, authorize } from "../middleware/auth.middleware.js"

const router = express.Router()

// Public route for creating enquiries
router.post("/", createEnquiry)

// Admin only routes
router.use(protect, authorize("admin"))

router.get("/", getEnquiries)
router.route("/:id").get(getEnquiry).put(updateEnquiry).delete(deleteEnquiry)

export default router
