const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Página de login
router.get('/login2', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'views', 'login.html'));
});

// Home protegida (opcional — remova requireAuth se quiser pública)
router.get('/', requireAuth, (req, res) => {
  console.log('Rota / Forecast');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'index.html'));
});

router.get('/capa', requireAuth, (req, res) => {
  console.log('Rota / Capa');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'capa.html'));
});


// Rota para página de erro 401 (Senha incorreta)
router.get('/error-401', (req, res) => {
    res.status(401).sendFile(path.join(__dirname, '..', 'views', 'error-401.html'));
});

// Rota para página de erro 404 (Usuário não encontrado)
router.get('/error-404', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'views', 'error-404.html'));
});


module.exports = router;
