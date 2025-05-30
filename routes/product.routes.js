import express from "express"
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByPrimaryCategory,
} from "../controllers/product.controller.js"
import { protect, authorize } from "../middleware/auth.middleware.js"
import { upload } from "../middleware/multer.middleware.js"

const router = express.Router()

// router.route("/").get(getProducts).post(protect, authorize("admin"), createProduct)

router
  .route("/")
  .get(getProducts)
  .post(protect, authorize("admin"), createProduct)

router
  .route("/:id")
  .get(getProduct)
  .put(protect, authorize("admin"), updateProduct)
  .delete(protect, authorize("admin"), deleteProduct)

  router.get("/get-primaryCategory/:primaryCategory", getProductsByPrimaryCategory)

export default router
