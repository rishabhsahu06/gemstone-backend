import express from "express"
import { getCart, addItemToCart, updateCartItem, removeCartItem, clearCart } from "../controllers/cart.controller.js"
import { protect } from "../middleware/auth.middleware.js"

const router = express.Router()

router.use(protect) // All cart routes are protected

router.route("/").get(getCart).post(addItemToCart).delete(clearCart)

router.route("/:itemId").put(updateCartItem).delete(removeCartItem)

export default router
