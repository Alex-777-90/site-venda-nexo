const express = require('express');
const path = require('path');

const router = express.Router();

// Rota para a página inicial
router.get('/', (req, res) => {
    console.log('Rota / acessada');
    res.sendFile(path.resolve(__dirname, '..', 'views', 'index.html'));
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
