import jwt from "jsonwebtoken"
import { promisify } from "util"
import User from "../models/user.model.js"
import config from "../config/config.js"
import { AppError } from "../utils/appError.js"

export const protect = async (req, res, next) => {
 
  try {
    // 1) Get token and check if it exists
    let token
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1]
    }

    if (!token) {
      // return next(new AppError("You are not logged in! Please log in to get access", 401))
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in! Please log in to get access",
      })
    }

    // 2) Verify token
 
    const decoded = await promisify(jwt.verify)(token, config.jwtSecret)

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id)

    if (!currentUser) {
      // return next(new AppError("The user belonging to this token no longer exists", 401))
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists",
      })
    }

    // 4) Grant access to protected route
    req.user = currentUser
    
    next()
  } catch (error) {
    next(new AppError("Not authorized to access this route", 401))
  }
}

export const authorize = (...roles) => {

  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      // return next(new AppError(`User role ${req.user.role} is not authorized to access this route`, 403))
      return res.status(403).json({
        status: "fail",
        message: `User role ${req.user.role} is not authorized to access this route`,
      })
    }
    next()
  }
}
