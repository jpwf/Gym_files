const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateLogin = require('./middleware/validateLogin');
const verifyJWT = require('./middleware/verifyJWT'); 

const PIPEFY_TOKEN = process.env.PIPEFYKEY;
const ORG_ID = process.env.PIPEFY_ORG_ID;

// Inicialização segura do Prisma Client
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.error('ERRO AO INICIALIZAR O PRISMA:', e.message);
}


router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;

  if (!prisma) {
    return res.status(500).json({ 
      error: 'Prisma não disponível no servidor. Configure a camada de dados.' 
    });
  }

  try {
    const cleanEmail = email?.trim();

    const user = await prisma.users.findUnique({ 
      where: { email: cleanEmail } 
    });
    if (!user) {
      console.log(`[LOGIN FAILED] Usuário "${cleanEmail}" não foi encontrado no banco.`);
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        reason: 'USER_NOT_FOUND'
      });
    }

    const storedPassword = user.secretkey || user.password_hash;
    const isBcryptHash = storedPassword && storedPassword.startsWith('$2');
    let validPassword = false;

    if (isBcryptHash) {
      validPassword = await bcrypt.compare(password, storedPassword);
    } else {
      validPassword = (password === storedPassword);

      if (validPassword) {
        console.log(`Migrando senha do usuário "${cleanEmail}" para hash BCrypt...`);
        const newHash = await bcrypt.hash(password, 10);
        
        await prisma.users.update({
          where: { id: user.id },
          data: { secretkey: newHash }
        });
      }
    }

    if (!validPassword) {
      console.log(`[LOGIN FAILED] Senha incorreta para o usuário "${cleanEmail}".`);
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        reason: 'INVALID_PASSWORD'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERRO CRÍTICO: JWT_SECRET não definida no ambiente (.env)');
      return res.status(500).json({ error: 'Erro de configuração no servidor' });
    }

    const userId = typeof user.id === 'bigint' ? user.id.toString() : user.id;
    const token = jwt.sign(
      { 
        id: userId, 
        email: user.email, 
        admin: user.admin 
      }, 
      jwtSecret, 
      { expiresIn: '3h' }
    );

    return res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        admin: user.admin
      }
    });

  } catch (error) {
    console.error('Erro ao executar login no servidor:', error);
    return res.status(500).json({ error: 'Erro interno ao processar login' });
  }
});

module.exports = router;