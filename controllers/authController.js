// controllers/authController.js
const jwt = require('jsonwebtoken');

const USERS = [
  { email: 'vendas2@nexointernational.com.br', password: 'adminNexo29931', role: 'admin', name: 'Full Admin' },
  { email: 'giovana@p7additives.com',       password: 'NexoP7299431',      role: 'P7',    name: 'Giovana' },
  { email: 'ncollor@ncollor.com.br',        password: 'NexoNCOLLOR299431', role: 'NCOLLOR', name: 'NCOLLOR' },
  { email: 'uira@nexointernational.com.br', password: 'NexoNDR299431',     role: 'NDR',   name: 'Uira' }
];

function signJwt(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

function setAuthCookie(res, token) {
  // Em Vercel atrás de proxy, você já usa app.set('trust proxy', 1)
  res.cookie('auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  });
}

exports.login = (req, res) => {
  const { email, password } = req.body || {};
  const user = USERS.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
  if (user.password !== password) return res.status(401).json({ ok: false, error: 'BAD_PASSWORD' });

  const token = signJwt({ sub: user.email, role: user.role, name: user.name });
  setAuthCookie(res, token);
  return res.json({ ok: true, user: { email: user.email, role: user.role, name: user.name } });
};

exports.logout = (req, res) => {
  res.clearCookie('auth', { path: '/' });
  return res.json({ ok: true });
};

exports.me = (req, res) => {
  // preenchido pelo middleware
  return res.json({ ok: true, user: req.user });
};
