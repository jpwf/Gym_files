module.exports = function validateLogin(req, res, next) {
  const { email, username, password } = req.body;
  const identifier = (email ?? username ?? '').trim();

  if (!identifier || typeof identifier !== 'string' || identifier.length === 0) {
    return res.status(400).json({ error: 'E-mail ou nome de usuário inválido ou ausente' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Senha inválida ou ausente (mínimo 6 caracteres)' });
  }

  next();
};
