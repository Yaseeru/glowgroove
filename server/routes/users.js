const express = require('express')
const router = express.Router()
const User = require('../models/User')
const { protect, admin } = require('../middleware/auth')

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
router.get('/', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password')
    res.json({
      success: true,
      count: users.length,
      data: { users }
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    })
  }
})

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
router.get('/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      data: { user }
    })
  } catch (error) {
    console.error('Get single user error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error fetching user'
    })
  }
})

/**
 * @desc    Enable or disable user (admin only)
 * @route   PUT /api/users/:id/status
 * @access  Private/Admin
 */
router.put('/:id/status', protect, admin, async (req, res) => {
  const { isActive } = req.body

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid isActive value (true or false)'
    })
  }

  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    user.isActive = isActive
    await user.save()

    res.json({
      success: true,
      message: `User ${isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          role: user.role
        }
      }
    })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error updating user status'
    })
  }
})

module.exports = router