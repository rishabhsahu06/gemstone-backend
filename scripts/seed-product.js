import mongoose from "mongoose"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import fs from "fs"

// Get the directory name
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from parent directory
const envPath = join(__dirname, "..", ".env")
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })

// Import Product model
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a product name"],
      trim: true,
      maxlength: [100, "Name cannot be more than 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Please provide a product description"],
      maxlength: [2000, "Description cannot be more than 2000 characters"],
    },
    primaryCategory: {
      type: String,
      required: [true, "Please provide a primary category"],
      enum: ["Yellow Sapphire", "Blue Sapphire", "Emerald", "Ruby", "Opal", "Red Coral", "Pearl", "Hessonite", "Other"],
    },
    secondaryCategory: {
      type: String,
      enum: ["Gemstone Pendants", "Gemstone Bracelets", "Gemstone Rings", "Gemstone Earrings", "None"],
      default: "None",
    },
    originalPrice: {
      type: Number,
      required: [true, "Please provide the original price"],
      min: [0, "Price must be positive"],
    },
    discountedPrice: {
      type: Number,
      min: [0, "Discounted price must be positive"],
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        alt: {
          type: String,
          default: "Product image",
        },
      },
    ],
    videoUrl: {
      type: String,
    },
    stock: {
      type: Number,
      required: [true, "Please provide stock quantity"],
      min: [0, "Stock cannot be negative"],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    weight: {
      type: Number,
      min: [0, "Weight cannot be negative"],
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    features: [String],
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: [0, "Rating must be at least 0"],
        max: [5, "Rating cannot be more than 5"],
        set: (val) => Math.round(val * 10) / 10, // Round to 1 decimal place
      },
      count: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true },
)

// Create slug from name before saving
productSchema.pre("save", function (next) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-")
  next()
})

// Add index for search functionality
productSchema.index({ name: "text", description: "text" })

const Product = mongoose.model("Product", productSchema)

// Sample product data
const sampleProducts = [
  {
    name: "Natural Blue Sapphire",
    description:
      "This stunning natural blue sapphire is of exceptional quality. Known for its deep blue color and excellent clarity, this gemstone is perfect for jewelry settings. Blue sapphires are associated with wisdom, loyalty, and nobility.",
    primaryCategory: "Blue Sapphire",
    originalPrice: 599.99,
    discountedPrice: 499.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?q=80&w=1000&auto=format&fit=crop",
        alt: "Natural Blue Sapphire",
      },
    ],
    stock: 15,
    isAvailable: true,
    weight: 2.5,
    dimensions: {
      length: 8,
      width: 6,
      height: 4,
    },
    features: ["Natural", "Excellent Clarity", "Deep Blue Color", "Certified"],
  },
  {
    name: "Premium Yellow Sapphire",
    description:
      "This premium yellow sapphire exhibits a vibrant yellow color that symbolizes wealth and prosperity. Yellow sapphires are believed to attract financial success and are highly sought after for their beauty and metaphysical properties.",
    primaryCategory: "Yellow Sapphire",
    originalPrice: 799.99,
    discountedPrice: 699.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1616019465099-6a9c9b2d1d7f?q=80&w=1000&auto=format&fit=crop",
        alt: "Premium Yellow Sapphire",
      },
    ],
    stock: 10,
    isAvailable: true,
    weight: 3.2,
    features: ["Premium Quality", "Vibrant Color", "Certified", "Untreated"],
  },
  {
    name: "Natural Emerald Gemstone",
    description:
      "This natural emerald features the classic rich green color that emeralds are famous for. Emeralds symbolize rebirth and love, making them perfect for special occasions and meaningful gifts.",
    primaryCategory: "Emerald",
    originalPrice: 899.99,
    discountedPrice: 849.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?q=80&w=1000&auto=format&fit=crop",
        alt: "Natural Emerald Gemstone",
      },
    ],
    stock: 8,
    isAvailable: true,
    weight: 1.8,
    features: ["Natural", "Rich Green Color", "Excellent Clarity", "Certified"],
  },
  {
    name: "Ruby Pendant Necklace",
    description:
      "This elegant ruby pendant necklace features a stunning natural ruby set in 18k gold. The deep red color of the ruby symbolizes passion and love, making it a perfect gift for someone special.",
    primaryCategory: "Ruby",
    secondaryCategory: "Gemstone Pendants",
    originalPrice: 1299.99,
    discountedPrice: 1199.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1000&auto=format&fit=crop",
        alt: "Ruby Pendant Necklace",
      },
    ],
    stock: 5,
    isAvailable: true,
    weight: 4.5,
    features: ["18k Gold Setting", "Natural Ruby", "Adjustable Chain", "Gift Box Included"],
  },
  {
    name: "Opal Ring",
    description:
      "This beautiful opal ring showcases the unique play of colors that opals are famous for. Set in sterling silver, this ring makes a statement with its vibrant flashes of blue, green, and orange.",
    primaryCategory: "Opal",
    secondaryCategory: "Gemstone Rings",
    originalPrice: 349.99,
    discountedPrice: 299.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1611955167811-4711904bb9f8?q=80&w=1000&auto=format&fit=crop",
        alt: "Opal Ring",
      },
    ],
    stock: 12,
    isAvailable: true,
    weight: 3.0,
    features: ["Sterling Silver", "Australian Opal", "Unique Color Play", "Adjustable Size"],
  },
  {
    name: "Red Coral Bracelet",
    description:
      "This red coral bracelet features natural coral beads that are known for their protective properties. Red coral is believed to ward off negative energy and bring good fortune to the wearer.",
    primaryCategory: "Red Coral",
    secondaryCategory: "Gemstone Bracelets",
    originalPrice: 249.99,
    discountedPrice: 199.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1000&auto=format&fit=crop",
        alt: "Red Coral Bracelet",
      },
    ],
    stock: 20,
    isAvailable: true,
    weight: 15.0,
    features: ["Natural Coral", "Elastic String", "Protective Properties", "Handcrafted"],
  },
  {
    name: "Pearl Earrings",
    description:
      "These elegant pearl earrings feature lustrous freshwater pearls set in 14k gold. Pearls symbolize purity and wisdom, making these earrings a timeless addition to any jewelry collection.",
    primaryCategory: "Pearl",
    secondaryCategory: "Gemstone Earrings",
    originalPrice: 199.99,
    discountedPrice: 179.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?q=80&w=1000&auto=format&fit=crop",
        alt: "Pearl Earrings",
      },
    ],
    stock: 25,
    isAvailable: true,
    weight: 2.0,
    features: ["Freshwater Pearls", "14k Gold", "Hypoallergenic", "Gift Box Included"],
  },
  {
    name: "Hessonite Garnet",
    description:
      "This hessonite garnet, also known as Gomed, is prized for its warm honey-brown color. In Vedic astrology, hessonite is associated with Rahu and is believed to bring positive changes and remove obstacles.",
    primaryCategory: "Hessonite",
    originalPrice: 399.99,
    discountedPrice: 349.99,
    images: [
      {
        url: "https://images.unsplash.com/photo-1600701353149-f78d6e28c606?q=80&w=1000&auto=format&fit=crop",
        alt: "Hessonite Garnet",
      },
    ],
    stock: 7,
    isAvailable: true,
    weight: 3.5,
    features: ["Natural Hessonite", "Excellent Clarity", "Certified", "Astrological Benefits"],
  },
]

/**
 * Seed the database with sample products
 */
async function seedProducts() {
  try {
    // Clear existing products
    await Product.deleteMany({})
    console.log("Cleared existing products")

    // Insert sample products
    const createdProducts = await Product.insertMany(sampleProducts)
    console.log(`Successfully seeded ${createdProducts.length} products`)

    return createdProducts
  } catch (error) {
    console.error("Error seeding products:", error)
    throw error
  }
}

// Seed products
seedProducts()
  .then(() => {
    console.log("Database seeding completed successfully!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Database seeding failed:", error)
    process.exit(1)
  })
