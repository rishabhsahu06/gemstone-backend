import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import helmet from "helmet"
import dotenv from "dotenv"
import morgan from "morgan"
import rateLimit from "express-rate-limit"
import swaggerUi from "swagger-ui-express"
import swaggerJsDoc from "swagger-jsdoc"
import twilio from "twilio"
import config from "./config/config.js"
// Import routes
import authRoutes from "./routes/auth.routes.js"
import productRoutes from "./routes/product.routes.js"
import cartRoutes from "./routes/cart.routes.js"
import orderRoutes from "./routes/order.routes.js"
import enquiryRoutes from "./routes/enquiry.routes.js"
import adminRoutes from "./routes/admin.routes.js"
import uploadMediaRoutes from "./routes/uploadMedia.routes.js";
import uploadVideo from "./routes/video.routes.js";
import bookingCallRoutes from "./routes/booking-recom-call.js"
// Import middleware
import { errorHandler } from "./middleware/error.middleware.js"
import { timeoutMiddleware } from "./middleware/timeout.middleware.js"

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()
// app.set('trust proxy', true);
// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Gemstone E-Commerce API",
      version: "1.0.0",
      description: "API documentation for Gemstone E-Commerce platform",
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production" ? "https://api.yourdomain.com" : "http://localhost:8000",
      },
    ],
  },
  apis: ["./routes/*.js", "./models/*.js"],
}
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',  
      'http://localhost:3001',
      'http://127.0.0.1:3000',  // Alternative localhost
      'http://127.0.0.1:3001',  // Alternative localhost
      'http://localhost:8000',  // API server
      'http://127.0.0.1:8000',  // API server
      'https://sunitagemstones.netlify.app',  // API server
      'https://gemston-admin.vercel.app',
      'https://sunitagemstones.com',  // Production server
      'https://sunitagemstones.com/api',
      'https://www.sunitagemstones.com',
      'www.sunitagemstones.com',
      'sunitagemstones.com',
      'https://main.d1w5mi9gl1l8g5.amplifyapp.com/'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};
const swaggerDocs = swaggerJsDoc(swaggerOptions)

// Middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cors(corsOptions));
// app.use(cors({
//   origin: '*',
//   credentials: true
// }));
app.use(helmet())
app.use(morgan("dev"))
app.use(timeoutMiddleware);
// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  validate: {
    xForwardedForHeader: false,
  },
})
//api for root route
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "Welcome to Gemstone E-Commerce API's" })
})

// app.post("/send-whatsapp-message", async (req, res) => {


// const client = twilio(config.whatsapp.accountSid, config.whatsapp.authToken)

// const response = await client.messages.create({
//     body: "heelo check",
//     from: "whatsapp:+16813813124",
//     to: "whatsapp:+919303191669",
//   })
//   res.status(200).json({ status: "ok", message: "Whatsapp message sent successfully", data: response })
// })



app.use("/api", limiter)

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/products", productRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/enquiries", enquiryRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs))
app.use("/api/upload-media", uploadMediaRoutes);
app.use("/api/video", uploadVideo);
app.use("/api/booking-call", bookingCallRoutes);
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" })
})

// Error handling middleware
app.use(errorHandler)

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
// mongoose.connect("mongodb+srv://sahushankar8202:Ans%40123456@cluster0.wzb9kx2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0") //this is gemstone db
// mongoose.connect("mongodb+srv://shankar_user:Ans%40123456@cluster0.0o8rt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0") //this is e-commerce
  .then(() => {
    console.log("Connected to MongoDB")
    // Start server
    const PORT = process.env.PORT || 8000
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })

export default app
