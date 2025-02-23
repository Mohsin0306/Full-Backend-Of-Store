const express = require('express');
const router = express.Router();
const { 
  registerBuyer, 
  login 
} = require('../controllers/authController');

// Register route for buyer only
router.post('/register/buyer', registerBuyer);

// Login route
router.post('/login', login);

module.exports = router; 