// router/authRouter.js
const express = require('express');
const { login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/api/login', login);
router.post('/api/logout', logout);
router.get('/api/me', requireAuth, me);

module.exports = router;
