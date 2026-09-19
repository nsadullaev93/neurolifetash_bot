function notFoundMiddleware(req, res) {
  res.status(404).json({ error: 'Маршрут не найден' });
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  console.error(err);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Запись не найдена' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка сервера' });
}

module.exports = { notFoundMiddleware, errorMiddleware };
