const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateLogin = require('./middleware/validateLogin');
const verifyJWT = require('./middleware/verifyJWT'); 
const path = require('path');
const { supabase } = require('./services/supabase-storage');

const PIPEFY_TOKEN = process.env.PIPEFYKEY;
const ORG_ID = process.env.PIPEFY_ORG_ID;
const upload = require('./middleware/upload_img');
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.error('ERRO AO INICIALIZAR O PRISMA:', e.message);
}


router.post('/login', validateLogin, async (req, res) => {
  const { email, password, username } = req.body;

  if (!prisma) {
    return res.status(500).json({ 
      message: 'Prisma não disponível no servidor. Configure a camada de dados.' 
    });
  }

  try {
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const cleanUsername = typeof username === 'string' ? username.trim() : '';
    const loginIdentifier = cleanEmail || cleanUsername;

    let user = null;

    if (cleanEmail) {
      user = await prisma.users.findUnique({
        where: { email: cleanEmail }
      });
    } else if (cleanUsername) {
      user = await prisma.users.findFirst({
        where: {
          username: {
            equals: cleanUsername,
            mode: 'insensitive'
          }
        }
      });
    }

    if (!user) {
      console.log(`[LOGIN FAILED] Usuário "${loginIdentifier}" não foi encontrado no banco.`);
      return res.status(401).json({
        message: 'Acesso ou senha incorretas',
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
        console.log(`Migrando senha do usuário "${user.email}" para hash BCrypt...`);
        const newHash = await bcrypt.hash(password, 10);

        await prisma.users.update({
          where: { id: user.id },
          data: { secretkey: newHash }
        });
      }
    }

    if (!validPassword) {
      console.log(`[LOGIN FAILED] Senha incorreta para o usuário "${user.email || user.username}".`);
      return res.status(401).json({
        message: 'Acesso ou senha incorretas',
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

router.get('/dashboard', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const userId = req.user.id;

    const rankingResult = await prisma.$queryRaw`
      SELECT 
          u.id AS user_id,
          u.username,
          COALESCE(t.total_treinos, 0)::INTEGER AS treinos,
          COALESCE(c.total_minutos, 0)::INTEGER AS minutos
      FROM users u
      LEFT JOIN (
          SELECT user_id, COUNT(id) AS total_treinos
          FROM treinos
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
          SELECT user_id,
                 SUM(
                   CASE
                     WHEN lower(tipo) LIKE '%escada%' THEN duracao_min * 2
                     ELSE duracao_min
                   END
                 ) AS total_minutos
          FROM cardios
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) c ON c.user_id = u.id
      ORDER BY minutos DESC, treinos DESC;
    `;

    const userIndex = rankingResult.findIndex(item => String(item.user_id) === String(userId));

    const userData = userIndex !== -1 ? rankingResult[userIndex] : { treinos: 0, minutos: 0 };
    const rankPosition = userIndex !== -1 ? userIndex + 1 : rankingResult.length + 1;

    return res.json({
      nome: userData.username || req.user.email.split('@')[0],
      resumoTreinos: userData.treinos,
      minutosCardio: userData.minutos,
      posicaoRanking: rankPosition,
    });

  } catch (error) {
    console.error('Erro ao executar query de dashboard:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar dados do painel.' });
  }
});
router.post('/cardios', verifyJWT, upload.single('foto'), async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const userId = BigInt(req.user.id);

    if (!req.file) {
      return res.status(400).json({ 
        error: 'É obrigatório enviar uma foto de comprovação para registrar o cardio.' 
      });
    }

    const { tipo, duracao_min, data } = req.body;

    if (!tipo || duracao_min === undefined) {
      return res.status(400).json({ error: 'Informe o tipo de cardio e a duração em minutos.' });
    }

    // --- ENVIAR PARA O SUPABASE STORAGE ---
    const fileExt = path.extname(req.file.originalname) || '.jpg';
    const fileName = `cardio-${userId}-${Date.now()}${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('comprovantes-cardio') // Nome do seu Bucket no Supabase
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Erro no Supabase Storage:', uploadError);
      return res.status(500).json({ error: 'Falha ao salvar a imagem na nuvem.' });
    }

    // Pega a URL pública gerada no Supabase Storage
    const { data: publicUrlData } = supabase.storage
      .from('comprovantes-cardio')
      .getPublicUrl(fileName);

    const foto_url = publicUrlData.publicUrl;
    // -------------------------------------

    const cardioDate = data ? new Date(data) : new Date();

    const novoCardio = await prisma.cardios.create({
      data: {
        user_id: userId,
        tipo: tipo,
        foto_url, // URL permanente do Supabase Storage
        duracao_min: Number(duracao_min),
        data: cardioDate,
      },
    });

    const cardioFormatado = {
      ...novoCardio,
      id: novoCardio.id.toString(),
      user_id: novoCardio.user_id.toString(),
    };

    return res.status(201).json({
      message: 'Cardio registrado com sucesso!',
      cardio: cardioFormatado,
    });

  } catch (error) {
    console.error('Erro ao inserir cardio:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar cardio.' });
  }
});
router.post('/treinos', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const userId = BigInt(req.user.id);
    const { tipo, data } = req.body;

    let tipoTreino = '';

    if (Array.isArray(tipo)) {
      const gruposSelecionados = tipo.filter((item) => typeof item === 'string' && item.trim());

      if (gruposSelecionados.length === 0) {
        return res.status(400).json({ error: 'Informe pelo menos um grupamento muscular.' });
      }

      tipoTreino = gruposSelecionados.join(', ');
    } else if (typeof tipo === 'string' && tipo.trim()) {
      tipoTreino = tipo.trim();
    } else {
      return res.status(400).json({ error: 'Informe o tipo do treino.' });
    }

    const treinoDate = data ? new Date(data) : new Date();

    const novoTreino = await prisma.treinos.create({
      data: {
        user_id: userId,
        tipo: tipoTreino,
        data: treinoDate,
      },
    });

    const treinoFormatado = {
      ...novoTreino,
      id: novoTreino.id.toString(),
      user_id: novoTreino.user_id.toString(),
    };

    return res.status(201).json({
      message: 'Treino registrado com sucesso!',
      treino: treinoFormatado,
    });

  } catch (error) {
    console.error('Erro ao inserir treino:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar treino.' });
  }
});
router.get('/ranking', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const rankingResult = await prisma.$queryRaw`
      SELECT 
          u.id AS user_id,
          u.username,
          COALESCE(t.total_treinos, 0)::INTEGER AS treinos,
          COALESCE(c.total_minutos, 0)::INTEGER AS minutos
      FROM users u
      LEFT JOIN (
          SELECT user_id, COUNT(id) AS total_treinos
          FROM treinos
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
          SELECT user_id,
                 SUM(
                   CASE
                     WHEN lower(tipo) LIKE '%escada%' THEN duracao_min * 2
                     ELSE duracao_min
                   END
                 ) AS total_minutos
          FROM cardios
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) c ON c.user_id = u.id
      ORDER BY minutos DESC, treinos DESC;
    `;

    const rankingComPosicao = rankingResult.map((item, index) => ({
      posicao: index + 1,
      user_id: typeof item.user_id === 'bigint' ? item.user_id.toString() : item.user_id,
      username: item.username,
      treinos: item.treinos,
      minutos: item.minutos,
    }));

    return res.json({ ranking: rankingComPosicao });

  } catch (error) {
    console.error('Erro ao buscar ranking semanal:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar ranking.' });
  }
});
router.get('/profile-data', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const userId = req.user.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        added: true,
        admin: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const formattedUserId = typeof user.id === 'bigint' ? user.id.toString() : user.id;

    return res.json({
      id: formattedUserId,
      email: user.email,
      username: user.username,
      createdAt: user.added,
      admin: user.admin,
    });

  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar perfil.' });
  }
});
router.get('/health', (req, res) => {
  return res.status(200).send('OK');
});
module.exports = router;