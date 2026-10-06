import express from "express"
import { register, login, getMe, updateProfile, updatePassword, googleLogin } from "../controllers/auth.controller.js"
import { protect } from "../middleware/auth.middleware.js"
import {
  sendRegistrationOTP,
  otpLimiter,
  verifyOTPAndRegister,
  resendOTP,
  sendLoginOTP,
  verifyLoginOTP,
  mobileUserLogin,
} from "../controllers/otp.controller.js"
import { getCheckoutAddress, updateCheckoutAddress, validateCheckoutAddress } from "../controllers/user.address.controller.js"

const router = express.Router()
router.post("/send-otp", otpLimiter, sendRegistrationOTP)
router.post("/verify-otp", verifyOTPAndRegister)
router.post("/resend-otp", otpLimiter, resendOTP)

// OTP-based login flow (Twilio)
router.post("/login-otp", otpLimiter, sendLoginOTP)
router.post("/verify-login-otp", verifyLoginOTP)
router.post("/resend-login-otp", otpLimiter, resendOTP)

// MSG91 frontend OTP — phone already verified; find/create user + JWT
router.post("/mobile-user", mobileUserLogin)
router.post("/otp-login", mobileUserLogin)

router.post("/google-login", googleLogin)
router.post("/register", register)
router.post("/login", login)
router.get("/me", protect, getMe)
router.put("/updateprofile", protect, updateProfile)
router.put("/updatepassword", protect, updatePassword)

router.post("/checkout-address", protect, updateCheckoutAddress)
router.get("/checkout-address", protect, getCheckoutAddress)
router.post("/validate-address", protect, validateCheckoutAddress)
export default router
