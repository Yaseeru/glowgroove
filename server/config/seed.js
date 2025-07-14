const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
require('dotenv').config();

// Connect to database
const connectDB = async () => {
     try {
          await mongoose.connect(process.env.MONGODB_URI);
          console.log('🍃 MongoDB Connected');
     } catch (error) {
          console.error('❌ Database connection failed:', error.message);
          process.exit(1);
     }
};

// Sample Users
const users = [
     {
          name: 'Admin User',
          email: 'admin@glowgroove.com',
          password: 'admin123',
          role: 'admin',
          phone: '+1-555-0001',
          address: {
               street: '123 Admin Street',
               city: 'San Francisco',
               state: 'CA',
               zipCode: '94105',
               country: 'US'
          }
     },
     {
          name: 'Emma Johnson',
          email: 'emma@example.com',
          password: 'password123',
          role: 'user',
          phone: '+1-555-0002',
          address: {
               street: '456 User Avenue',
               city: 'Los Angeles',
               state: 'CA',
               zipCode: '90001',
               country: 'US'
          }
     }
];

// Optional: Sample Products (if you have a Product schema ready)
const products = [
     {
          name: 'Soothing Lavender Candle',
          description: 'A hand-poured soy candle infused with calming lavender essential oil.',
          price: 19.99,
          originalPrice: 24.99,
          category: 'candles',
          images: [
               {
                    url: 'https://example.com/images/lavender-candle.jpg',
                    alt: 'Lavender Candle in Glass Jar'
               }
          ],
          stock: 40,
          features: ['100% soy wax', '40-hour burn time', 'Handmade in the USA'],
          specifications: {
               dimensions: '3x3x4 in',
               weight: '0.5 lb',
               material: 'Soy wax, glass',
               color: 'Purple',
               burnTime: '40h'
          },
          tags: ['relaxation', 'aromatherapy', 'lavender'],
          isFeatured: true
     },
     {
          name: 'Eco Bamboo Journal',
          description: 'A beautifully bound journal made from sustainable bamboo and recycled paper.',
          price: 14.5,
          category: 'journals',
          images: [
               {
                    url: 'https://example.com/images/bamboo-journal.jpg',
                    alt: 'Eco-friendly Bamboo Journal'
               }
          ],
          stock: 65,
          features: ['120 lined pages', 'Hardcover', 'Eco-friendly'],
          specifications: {
               dimensions: '5x8 in',
               weight: '0.3 lb',
               material: 'Bamboo, recycled paper',
               pages: 120,
               color: 'Natural'
          },
          tags: ['eco', 'stationery', 'bamboo']
     }
];

const seedData = async () => {
     try {
          await connectDB();

          // Clear old data
          await User.deleteMany();
          await Product.deleteMany();

          // Hash passwords
          const hashedUsers = await Promise.all(
               users.map(async user => {
                    const hashedPassword = await bcrypt.hash(user.password, 12);
                    return { ...user, password: hashedPassword };
               })
          );

          const createdUsers = await User.insertMany(hashedUsers);
          console.log(`👤 Inserted ${createdUsers.length} users`);

          const createdProducts = await Product.insertMany(products);
          console.log(`🛍️ Inserted ${createdProducts.length} products`);

          console.log('🌱 Database seeding complete');
          mongoose.connection.close();
     } catch (err) {
          console.error('🚨 Seeding failed:', err);
          process.exit(1);
     }
};

seedData();