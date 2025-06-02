import express from "express"
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByPrimaryCategory,
  getPrimaryCategories,
} from "../controllers/product.controller.js"
import { protect, authorize } from "../middleware/auth.middleware.js"
import { upload } from "../middleware/multer.middleware.js"

const router = express.Router()

// Get all primary categories - place this before the /:id route
router.get("/primary-categories", getPrimaryCategories)

// Get products by primary category
router.get("/get-primaryCategory/:primaryCategory", getProductsByPrimaryCategory)

// Main CRUD routes
router
  .route("/")
  .get(getProducts)
  .post(protect, authorize("admin"), createProduct)

router
  .route("/:id")
  .get(getProduct)
  .put(protect, authorize("admin"), updateProduct)
  .delete(protect, authorize("admin"), deleteProduct)

export default router