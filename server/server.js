const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()

// 🍃 Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ✅ Multi-Origin CORS setup
const allowedOrigins = [
  process.env.CLIENT_URL,              // public store frontend
  process.env.ADMIN_DASHBOARD,         // Netlify admin dashboard
  'http://localhost:3000',             // local frontend dev
  'http://localhost:5173'              // local dashboard dev
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

// 🔗 DB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI)
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    process.exit(1)
  }
}

connectDB()

// 📦 API Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/payments', require('./routes/payments'))
app.use('/api/users', require('./routes/users'))

// 🩺 Health Check
app.get('/', (req, res) => {
  res.json({
    message: '🌟 Welcome to GlowGroove API!',
    status: 'Server is running smoothly ✨',
    environment: process.env.NODE_ENV || 'development',
    docs: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/api-docs` : 'http://localhost:3000/api-docs'
  })
})

// 🚨 Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack)
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  })
})

// 🕵️ Catch-All for Unknown Routes
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
    method: req.method
  })
})

// 🚀 Server Boot
const PORT = process.env.PORT || 5000
const server = app.listen(PORT, () => {
  console.log(`🚀 GlowGroove server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Allowed Origins:`, allowedOrigins.filter(Boolean).join(', '))
})

// 🧯 Safety Handlers
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err)
  server.close(() => process.exit(1))
})

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err)
  server.close(() => process.exit(1))
})