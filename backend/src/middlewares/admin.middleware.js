const jwt = require('jsonwebtoken');
const config = require('../config/default');

function adminMiddleware(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный или истёкший токен' });
  }
}

module.exports = adminMiddleware;
