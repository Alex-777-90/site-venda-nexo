const express = require('express');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

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

router.get('/cadastroClientes', requireAuth, (req, res) => {
  console.log('Rota / cadastroClientes');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'cadastroClientes.html'));
});

router.get('/consultaCliente', requireAuth, (req, res) => {
  console.log('Rota / consultaCliente');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'consultaCliente.html'));
});

router.get('/consultaProduto', requireAuth, (req, res) => {
  console.log('Rota / consultaProduto');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'consultaProduto.html'));
});

router.get('/cotacao', requireAuth, (req, res) => {
  console.log('Rota / cotacao');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'cotacao.html'));
});

router.get('/estoqueItem', requireAuth, (req, res) => {
  console.log('Rota / estoqueItem');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'estoqueItem.html'));
});

router.get('/listaPreco', requireAuth, (req, res) => {
  console.log('Rota / listaPreco');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'listaPreco.html'));
});

router.get('/pedido', requireAuth, (req, res) => {
  console.log('Rota / pedido');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'pedido.html'));
});

router.get('/relatorio', requireAuth, (req, res) => {
  console.log('Rota / pedido');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'dashboard.html'));
});

router.get('/requesicaoAmostra', requireAuth, (req, res) => {
  console.log('Rota / solicitação Amostra');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'requisicao-amostra.html'));
});

router.get(
  '/cadastroRepresentante',
  requireAuth,
  requireRole(['admin', 'NDR', 'AGRO']),
  (req, res) => {
    console.log('Rota / cadastroRepresentante');
    res.sendFile(path.resolve(__dirname, '..', 'views', 'cadastroRepresentante.html'));
  }
);


// Rota para página de qualidade
router.get('/rnc', requireAuth, (req, res) => {
  console.log('Rota / RNC');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'RNC.html'));
});

router.get('/5porques', requireAuth, (req, res) => {
  console.log('Rota / 5 Porques');
  res.sendFile(path.resolve(__dirname, '..', 'views', '5Porque.html'));
});

router.get('/fotoNC', requireAuth, (req, res) => {
  console.log('Rota / Foto NC');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'fotoNC.html'));
});

router.get('/descricaoFalha', requireAuth, (req, res) => {
  console.log('Rota / descrição de Falha');
  res.sendFile(path.resolve(__dirname, '..', 'views', 'descricaoFalha.html'));
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
