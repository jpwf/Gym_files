const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const JWT_SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();

function canRootAccess(method, path) {
  return (
    (path === '/profile-data' && ['GET', 'PUT'].includes(method)) ||
    (path === '/root/users' && ['GET', 'POST'].includes(method)) ||
    (method === 'DELETE' && /^\/root\/users\/\d+$/.test(path))
  );
}

module.exports = function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }

    try {
      const userId = BigInt(decoded.id);
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, admin: true, is_root: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Usuário da sessão não existe.' });
      }

      req.user = {
        ...decoded,
        id: user.id.toString(),
        admin: user.admin === true,
        is_root: user.is_root === true,
      };

      if (req.user.is_root && !canRootAccess(req.method, req.path)) {
        return res.status(403).json({ error: 'Acesso root restrito ao perfil e à gestão de usuários.' });
      }

      return next();
    } catch (error) {
      console.error('Erro ao validar usuário do token:', error.message);
      return res.status(500).json({ error: 'Não foi possível validar a sessão.' });
    }
  });
};
