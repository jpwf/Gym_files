module.exports = function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return res.status(400).json({ error: 'Usuário inválido ou ausente' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Senha inválida ou ausente (mínimo 6 caracteres)' });
  }

  next();
};
