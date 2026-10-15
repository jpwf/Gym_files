const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const validateLogin = require('./middleware/validateLogin');
const verifyJWT = require('./middleware/verifyJWT'); 
const {
  createCardioProofSignedUrl,
  removeCardioProofFiles,
  uploadCardioProof,
} = require('./services/supabase-storage');
const { obterSugestaoCardio, removeCardioSuggestionCache } = require('./services/ia-suggestions');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

function requireRoot(req, res, next) {
  if (req.user?.is_root !== true) {
    return res.status(403).json({ error: 'Acesso restrito ao usuário root.' });
  }

  return next();
}

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de acesso. Aguarde antes de tentar novamente.' },
});

const googleAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de autenticação. Aguarde antes de tentar novamente.' },
});

const cardioSuggestionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  keyGenerator: (req) => `user:${req.user.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Limite de sugestões atingido. Tente novamente mais tarde.' },
});


router.post('/auth/google', googleAuthRateLimit, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const { idToken, nonce } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ error: 'idToken do Google não informado.' });
    }

    if (typeof nonce !== 'string' || !nonce) {
      return res.status(400).json({ error: 'Nonce da autenticação Google não informado.' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      if (!process.env.GOOGLE_CLIENT_IDS) {
        return res.status(500).json({ error: 'Configure GOOGLE_CLIENT_IDS no servidor.' });
      }
    }

    const acceptedGoogleClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
    ].map((clientId) => clientId.trim()).filter(Boolean);

    if (acceptedGoogleClientIds.length === 0) {
      return res.status(500).json({ error: 'Configure GOOGLE_CLIENT_IDS no servidor.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: acceptedGoogleClientIds,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;

    if (payload?.nonce !== nonce) {
      return res.status(401).json({ error: 'Nonce do token Google inválido.' });
    }

    if (!email || payload?.email_verified !== true) {
      return res.status(401).json({ error: 'O Google não confirmou o e-mail desta conta.' });
    }

    let user = await prisma.users.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Não foi possível autenticar com essa conta.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERRO CRÍTICO: JWT_SECRET não definida no ambiente (.env)');
      return res.status(500).json({ error: 'Erro de configuração no servidor' });
    }

    const appToken = jwt.sign(
      {
        id: String(user.id),
        email: user.email,
        admin: user.admin === true,
      },
      jwtSecret,
      { expiresIn: '3h' }
    );

    return res.json({
      token: appToken,
      user: {
        id: String(user.id),
        email: user.email,
        username: user.username,
        admin: user.admin === true,
      },
    });
  } catch (error) {
    console.error('Erro ao autenticar com Google:', error?.code || error?.status);
    return res.status(401).json({ error: 'Não foi possível autenticar com essa conta.' });
  }
});

router.post('/cardio/sugestao', verifyJWT, cardioSuggestionRateLimit, obterSugestaoCardio);

router.post('/login', loginRateLimit, validateLogin, async (req, res) => {
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
      console.warn('[LOGIN FAILED] Credenciais inválidas.');
      return res.status(401).json({ message: 'Acesso ou senha incorretos.' });
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
      console.warn('[LOGIN FAILED] Credenciais inválidas.');
      return res.status(401).json({ message: 'Acesso ou senha incorretos.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERRO CRÍTICO: JWT_SECRET não definida no ambiente (.env)');
      return res.status(500).json({ error: 'Erro de configuração no servidor' });
    }

    const isTrainer = user.admin === true;
    const userId = typeof user.id === 'bigint' ? user.id.toString() : user.id;
    const token = jwt.sign(
      { 
        id: userId, 
        email: user.email, 
        admin: isTrainer
      }, 
      jwtSecret, 
      { expiresIn: '3h' }
    );

    return res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        admin: isTrainer
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
          u.admin,
          COALESCE(t.total_treinos, 0)::INTEGER AS treinos,
          COALESCE(c.total_minutos, 0)::INTEGER AS minutos,
          COALESCE(c.total_pontos, 0)::INTEGER AS pontos,
          COALESCE(u.cardio_meta_min, 0)::INTEGER AS meta_cardio_minutos,
          GREATEST(COALESCE(u.cardio_meta_min, 0) - COALESCE(c.total_minutos, 0), 0)::INTEGER AS minutos_faltantes
      FROM users u
      LEFT JOIN (
          SELECT user_id, COUNT(id) AS total_treinos
          FROM treinos
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
          SELECT user_id,
                 SUM(duracao_min) AS total_minutos,
                 SUM(
                   CASE
                     WHEN lower(tipo) LIKE '%escada%' THEN duracao_min * 2
                     WHEN lower(tipo) LIKE '%caminhada%' THEN duracao_min * 0.5
                     ELSE duracao_min
                   END
                 ) AS total_pontos
          FROM cardios
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) c ON c.user_id = u.id
      ORDER BY pontos DESC, treinos DESC;
    `;

    const userIndex = rankingResult.findIndex(item => String(item.user_id) === String(userId));
    const isTrainer = req.user.admin === true;

    const userData = userIndex !== -1 ? rankingResult[userIndex] : {
      treinos: 0,
      minutos: 0,
      pontos: 0,
      meta_cardio_minutos: 0,
      minutos_faltantes: 0,
      admin: isTrainer,
      username: req.user.email.split('@')[0],
    };
    const rankPosition = userIndex !== -1 ? userIndex + 1 : rankingResult.length + 1;

    return res.json({
      nome: userData.username || req.user.email.split('@')[0],
      resumoTreinos: userData.treinos,
      minutosCardio: userData.minutos,
      pontosCardio: userData.pontos,
      metaCardioMinutos: userData.meta_cardio_minutos ?? 0,
      minutosFaltantesCardio: userData.minutos_faltantes ?? 0,
      posicaoRanking: rankPosition,
      admin: userData.admin === true,
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

    const foto_url = await uploadCardioProof(userId, req.file.buffer);

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
    if (error.statusCode === 415) {
      return res.status(415).json({ error: error.message });
    }
    console.error('Erro ao inserir cardio:', error.message);
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
          COALESCE(c.total_minutos, 0)::INTEGER AS minutos,
          COALESCE(c.total_pontos, 0)::INTEGER AS pontos
      FROM users u
      LEFT JOIN (
          SELECT user_id, COUNT(id) AS total_treinos
          FROM treinos
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
          SELECT user_id,
                 SUM(duracao_min) AS total_minutos,
                 SUM(
                   CASE
                     WHEN lower(tipo) LIKE '%escada%' THEN duracao_min * 2
                     ELSE duracao_min
                   END
                 ) AS total_pontos
          FROM cardios
          WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
          GROUP BY user_id
      ) c ON c.user_id = u.id
      ORDER BY pontos DESC, treinos DESC;
    `;

    const rankingComPosicao = rankingResult.map((item, index) => ({
      posicao: index + 1,
      user_id: typeof item.user_id === 'bigint' ? item.user_id.toString() : item.user_id,
      username: item.username,
      treinos: item.treinos,
      minutos: item.minutos,
      pontos: item.pontos,
    }));

    return res.json({ ranking: rankingComPosicao });

  } catch (error) {
    console.error('Erro ao buscar ranking semanal:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar ranking.' });
  }
});
router.get('/trainer-athletes', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  if (req.user.admin !== true) {
    return res.status(403).json({ error: 'Acesso restrito ao treinador.' });
  }

  try {
    const athletes = await prisma.$queryRaw`
      SELECT
        u.id AS user_id,
        u.username,
        u.email,
        COALESCE(t.total_treinos, 0)::INTEGER AS treinos,
        COALESCE(c.total_minutos, 0)::INTEGER AS minutos,
        COALESCE(u.cardio_meta_min, 0)::INTEGER AS meta_minutos,
        GREATEST(COALESCE(u.cardio_meta_min, 0) - COALESCE(c.total_minutos, 0), 0)::INTEGER AS faltando_minutos
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(id) AS total_treinos
        FROM treinos
        WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
        GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(duracao_min) AS total_minutos
        FROM cardios
        WHERE DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW())
        GROUP BY user_id
      ) c ON c.user_id = u.id
      WHERE u.admin = false
      ORDER BY faltando_minutos DESC, u.username ASC;
    `;

    return res.json(athletes.map((athlete) => ({
      user_id: typeof athlete.user_id === 'bigint' ? athlete.user_id.toString() : athlete.user_id,
      username: athlete.username,
      email: athlete.email,
      treinos: Number(athlete.treinos || 0),
      minutos: Number(athlete.minutos || 0),
      meta_minutos: Number(athlete.meta_minutos || 0),
      faltando_minutos: Number(athlete.faltando_minutos || 0),
    })));
  } catch (error) {
    console.error('Erro ao buscar atletas do treinador:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar atletas.' });
  }
});

router.get('/trainer-athletes/:id', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  if (req.user.admin !== true) {
    return res.status(403).json({ error: 'Acesso restrito ao treinador.' });
  }

  try {
    const athleteId = BigInt(req.params.id);

    const athlete = await prisma.users.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        username: true,
        email: true,
        cardio_meta_min: true,
      },
    });

    if (!athlete) {
      return res.status(404).json({ error: 'Atleta não encontrado.' });
    }

    const [treinoMaisRecente] = await prisma.$queryRaw`
      SELECT tipo, data
      FROM treinos
      WHERE user_id = ${athleteId}
      ORDER BY data DESC
      LIMIT 1;
    `;

    const [cardioMaisRecente] = await prisma.$queryRaw`
      SELECT tipo, duracao_min, data, foto_url
      FROM cardios
      WHERE user_id = ${athleteId}
      ORDER BY data DESC
      LIMIT 1;
    `;
    const cardioFotoUrl = cardioMaisRecente?.foto_url
      ? await createCardioProofSignedUrl(cardioMaisRecente.foto_url)
      : null;

    const [weekSummary] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(duracao_min), 0)::INTEGER AS minutos_semana
      FROM cardios
      WHERE user_id = ${athleteId}
        AND DATE_TRUNC('week', data) = DATE_TRUNC('week', NOW());
    `;

    const metaMinutos = Number(athlete.cardio_meta_min ?? 0);
    const minutosSemana = Number(weekSummary?.minutos_semana ?? 0);
    const minutosFaltantes = Math.max(metaMinutos - minutosSemana, 0);

    return res.json({
      user_id: athlete.id.toString(),
      username: athlete.username,
      email: athlete.email,
      metaMinutos,
      minutosSemana,
      minutosFaltantes,
      treinoMaisRecente: treinoMaisRecente ? {
        data: new Date(treinoMaisRecente.data).toISOString(),
        grupos: String(treinoMaisRecente.tipo || 'Sem grupo informado'),
      } : null,
      cardioMaisRecente: cardioMaisRecente ? {
        tipo: cardioMaisRecente.tipo || 'Cardio',
        duracao_min: Number(cardioMaisRecente.duracao_min || 0),
        data: new Date(cardioMaisRecente.data).toISOString(),
        foto_url: cardioFotoUrl,
      } : null,
    });
  } catch (error) {
    console.error('Erro ao buscar dados do atleta:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar detalhes do atleta.' });
  }
});

router.post('/athletes/:id/meta-cardio', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  if (req.user.admin !== true) {
    return res.status(403).json({ error: 'Acesso restrito ao treinador.' });
  }

  try {
    const athleteId = BigInt(req.params.id);
    const metaMinutos = Number(req.body.meta_minutos || 0);

    if (!Number.isFinite(metaMinutos) || metaMinutos < 0) {
      return res.status(400).json({ error: 'Informe uma meta de minutos válida.' });
    }

    const athlete = await prisma.users.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      return res.status(404).json({ error: 'Atleta não encontrado.' });
    }

    const updated = await prisma.users.update({
      where: { id: athleteId },
      data: { cardio_meta_min: metaMinutos },
    });

    return res.json({
      user_id: updated.id.toString(),
      metaMinutos: Number(updated.cardio_meta_min || 0),
    });
  } catch (error) {
    console.error('Erro ao salvar meta de cardio:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar meta de cardio.' });
  }
});

router.get('/root/users', verifyJWT, requireRoot, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        admin: true,
        is_root: true,
        added: true,
      },
      orderBy: { added: 'desc' },
    });

    return res.json(users.map((user) => ({
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      is_admin: user.admin === true,
      is_root: user.is_root === true,
      createdAt: user.added,
    })));
  } catch (error) {
    console.error('Erro ao listar usuários para root:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
});

router.post('/root/users', verifyJWT, requireRoot, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    const isAdmin = req.body?.is_admin === true;

    if (!username || username.length > 80) {
      return res.status(400).json({ error: 'Informe um nome de usuário de até 80 caracteres.' });
    }

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
    }

    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { username: { equals: username, mode: 'insensitive' } },
        ],
      },
      select: { email: true, username: true },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Este e-mail ou nome de usuário já está em uso.' });
    }

    const secretkey = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        username,
        email,
        secretkey,
        admin: isAdmin,
        is_root: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        admin: true,
        is_root: true,
        added: true,
      },
    });

    return res.status(201).json({
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      is_admin: user.admin === true,
      is_root: user.is_root === true,
      createdAt: user.added,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Este e-mail já está em uso.' });
    }

    console.error('Erro ao criar usuário para root:', error.message);
    return res.status(500).json({ error: 'Não foi possível criar o usuário.' });
  }
});

router.delete('/root/users/:id', verifyJWT, requireRoot, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  let targetId;
  try {
    targetId = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
  }

  if (targetId.toString() === String(req.user.id)) {
    return res.status(409).json({ error: 'Não é permitido remover a própria conta.' });
  }

  try {
    const target = await prisma.users.findUnique({
      where: { id: targetId },
      select: { id: true, is_root: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (target.is_root === true) {
      return res.status(403).json({ error: 'Não é permitido remover outra conta root.' });
    }

    await removeCardioSuggestionCache(target.id);
    await removeCardioProofFiles(target.id);
    await prisma.users.delete({ where: { id: targetId } });
    return res.json({ message: 'Usuário removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover usuário para root:', error.message);
    return res.status(500).json({ error: 'Não foi possível remover o usuário.' });
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
        is_root: true,
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
      is_admin: user.admin === true,
      is_root: user.is_root === true,
    });

  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar perfil.' });
  }
});

router.put('/profile-data', verifyJWT, async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Prisma não disponível no servidor.' });
  }

  try {
    const userId = req.user.id;
    const currentUser = await prisma.users.findUnique({ where: { id: userId } });
    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const incomingUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const incomingEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

    const nextUsername = incomingUsername || currentUser.username || '';
    const nextEmail = incomingEmail || currentUser.email || '';

    if (!nextUsername) {
      return res.status(400).json({ error: 'Informe um nome de usuário válido.' });
    }

    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    const hasAnyFieldChanged =
      incomingUsername !== '' && incomingUsername !== (currentUser.username || '') ||
      incomingEmail !== '' && incomingEmail !== (currentUser.email || '');

    if (!hasAnyFieldChanged) {
      return res.status(400).json({ error: 'Informe ao menos um campo para atualizar.' });
    }

    const usernameConflict = await prisma.users.findFirst({
      where: {
        username: {
          equals: nextUsername,
          mode: 'insensitive',
        },
        NOT: { id: userId },
      },
    });

    if (usernameConflict) {
      return res.status(409).json({ error: 'Este nome de usuário já está em uso.' });
    }

    const emailConflict = await prisma.users.findFirst({
      where: {
        email: {
          equals: nextEmail,
          mode: 'insensitive',
        },
        NOT: { id: userId },
      },
    });

    if (emailConflict) {
      return res.status(409).json({ error: 'Este e-mail já está em uso.' });
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        username: nextUsername,
        email: nextEmail,
      },
    });

    return res.json({
      id: typeof updatedUser.id === 'bigint' ? updatedUser.id.toString() : updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      admin: updatedUser.admin,
      is_admin: updatedUser.admin === true,
      is_root: updatedUser.is_root === true,
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar alterações do perfil.' });
  }
});
router.get('/health', (req, res) => {
  return res.status(200).send('OK');
});
module.exports = router;