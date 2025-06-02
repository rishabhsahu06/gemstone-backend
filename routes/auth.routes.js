import express from "express"
import { register, login, getMe, updateProfile, updatePassword } from "../controllers/auth.controller.js"
import { protect } from "../middleware/auth.middleware.js"
import { sendRegistrationOTP,otpLimiter, verifyOTPAndRegister, resendOTP, sendLoginOTP, verifyLoginOTP } from "../controllers/otp.controller.js"

const router = express.Router()
router.post('/send-otp', otpLimiter, sendRegistrationOTP);
router.post('/verify-otp', verifyOTPAndRegister);
router.post('/resend-otp', otpLimiter, resendOTP);

// OTP-based login flow
router.post('/login-otp', otpLimiter, sendLoginOTP);
router.post('/verify-login-otp', verifyLoginOTP);
router.post('/resend-login-otp', otpLimiter, resendOTP);
// -------------------basically we are handling the otp based login flow for now but user also can register and update and me api is for work as before-------------------------
router.post("/register", register)
router.post("/login", login)
router.get("/me", protect, getMe)
router.put("/updateprofile", protect, updateProfile)
router.put("/updatepassword", protect, updatePassword)

export default router
