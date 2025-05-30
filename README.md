
# Gemstone E-Commerce Backend API

A robust, secure, and scalable backend system for a gemstone e-commerce website built with Node.js, Express.js, MongoDB, and Stripe.

## Features

- **Product Management**: Full CRUD operations for gemstone products
- **Shopping Cart System**: Add, update, remove items with persistence
- **Stripe Payment Integration**: Secure checkout experience
- **WhatsApp Order Confirmation**: Automated messaging via Twilio
- **User Enquiry System**: Public API endpoint for customer questions
- **Authentication & Admin Dashboard**: JWT-based auth with role management
- **Search & Filter Functionality**: Dynamic product filtering

## Tech Stack

- **Node.js & Express.js**: Server and API framework
- **MongoDB**: Database with Mongoose ODM
- **JWT**: Authentication
- **Stripe**: Payment processing
- **Twilio**: WhatsApp messaging
- **Swagger**: API documentation

## Project Structure

The project follows MVC architecture:

\`\`\`
├── app.js                  # Entry point
├── config/                 # Configuration files
├── controllers/            # Request handlers
├── middleware/             # Custom middleware
├── models/                 # Database models
├── routes/                 # API routes
├── services/               # External services
└── utils/                  # Utility functions
\`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/updateprofile` - Update user profile
- `PUT /api/auth/updatepassword` - Update password

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create new product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:itemId` - Update cart item
- `DELETE /api/cart/:itemId` - Remove item from cart
- `DELETE /api/cart` - Clear cart

### Orders
- `POST /api/orders/checkout` - Create checkout session
- `POST /api/orders/webhook` - Stripe webhook
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id` - Update order status (Admin)

### Enquiries
- `POST /api/enquiries` - Create new enquiry
- `GET /api/enquiries` - Get all enquiries (Admin)
- `GET /api/enquiries/:id` - Get single enquiry (Admin)
- `PUT /api/enquiries/:id` - Update enquiry status (Admin)
- `DELETE /api/enquiries/:id` - Delete enquiry (Admin)

### Admin
- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/orders` - Get all orders
- `GET /api/admin/users` - Get all users

## Installation

1. Clone the repository
   \`\`\`bash
   git clone https://github.com/yourusername/gemstone-ecommerce-backend.git
   cd gemstone-ecommerce-backend
   \`\`\`

2. Install dependencies
   \`\`\`bash
   npm install
   \`\`\`

3. Create a `.env` file in the root directory and add your environment variables (see `.env.example`)

4. Start the server
   \`\`\`bash
   # Development
   npm run dev
   
   # Production
   npm start
   \`\`\`

5. Access the API documentation at `http://localhost:8000/api-docs`

## Environment Variables

See `.env.example` for required environment variables.

## License

MIT
