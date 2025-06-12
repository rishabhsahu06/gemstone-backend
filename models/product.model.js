import mongoose from "mongoose";

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
enum: ["yellow-sapphire", "blue-sapphire", "pink-sapphire", "emerald", "ruby", "opal", "red-coral", "pearl", "hessonite", "other"],
    },
    secondaryCategory: {
      type: String,
      enum: ["gemstone-pendants", "gemstone-bracelets", "gemstone-rings", "loose-gemstone", "none"],
      default: "none",
    },
    productBenefits: [
      {
        type: String,
        enum: 
        [
  "Financial Growth",
  "Relationship Growth",
  "Promotes Good Health",
  "Spiritual Growth",
  "Emotional Stability",
  "Success in Education",
  "Career Success",
  "Protection from Negativity",
  "Enhanced Creativity",
  "Chakra Balancing",
  "Manifestation Power",
  "Psychic Abilities",
  "Courage & Confidence",
  "Detoxification",
  "Fertility & Vitality",
  "Better Sleep",
  "Luck & Fortune",
  "Longevity",
  "Astral Travel",
  "Divine Connection",
  "Past Life Recall",
  "Karmic Healing",
  "Aura Cleansing",
  "Grounding & Stability",
  "Enhanced Intuition",
  "Peace & Tranquility",
  "Angelic Communication",
  "DNA Activation",
  "Energy Amplification",
  "Stress Relief",
  "Pain Relief",
  "Enhanced Focus",
  "Protection from Electromagnetic (EMF) Radiation",
  "Dream Recall & Interpretation",
  "Enhanced Meditation",
  "Self-Discovery",
  "Transmutation of Negative Energy",
  "Other"
],
        required: [true, "Please provide a product benefit"],
        default: "Financial Growth",
      },
    ],
    origin: {
      type: String,
      default: "",
    },
    certification: {
      type: String,
      enum: ["Free Lab Certificate", "Govt Lab Certificate", "None"],
      default: "Free Lab Certificate",
    },
    poojaEnergization: {
      type: String,
      enum: ["No Energization", "With Energization"],
      default: "No Energization",
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
      type: Number, // in grams
      min: [0, "Weight cannot be negative"],
    },
    weightRatti: {
      type: Number,
    },
    weightCarat: {
      type: Number,
    },
    shape: {
      type: String,
      default: "Oval",
    },
    treatment: {
      type: String,
      default: "Unheated and Untreated (No Indications Observed)",
    },
    treatmentType: {
      type: String,
      default: "Faceted",
    },
    composition: {
      type: String,
      default: "Natural",
    },
    returnPolicy: {
      type: String,
      default: "10 Day Money-Back Returns Policy",
    },
    colour: {
      type: String,
      default: "Yellow",
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    refractiveIndex: {
      min: Number,
      max: Number,
    },
    dimensionType: {
      type: String,
      default: "Not Calibrated",
    },
    specificGravity: {
      type: Number,
    },
    features: [String], // e.g., ["Financial Growth", "Promotes Good Health", ...]
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: [0, "Rating must be at least 0"],
        max: [5, "Rating cannot be more than 5"],
        set: (val) => Math.round(val * 10) / 10,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

// Create slug from name before saving
productSchema.pre("save", function (next) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");

  next();
});

// Add index for search functionality
productSchema.index({ name: "text", description: "text" });

const Product = mongoose.model("Product", productSchema);

export default Product;
