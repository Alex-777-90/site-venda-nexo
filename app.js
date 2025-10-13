// app.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const viewsRouter = require('./router/viewsRouter');




const app = express();
const PORT = process.env.PORT || 4000;


// Configurar o tamanho máximo do corpo da requisição
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Middleware para parsing de JSON
app.use(express.json());

// Configurar a pasta 'public' para arquivos estáticos (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));


// Adicionar esta linha para configurar o proxy
app.set('trust proxy', 1); // Necessário para cookies seguros em proxies (como Vercel)


app.use(cookieParser());

// Usar o router para as views
app.use('/', viewsRouter);

app.get('/teste', (req, res) => {
    res.send('Rota de teste funcionando!');
});



app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://pedido-venda-teste.vercel.app'); // Substitua pela URL do seu site
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
