const { z } = require('zod');

// Login: email OU username + senha (mín 6)
const loginSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(80).optional(),
  password: z.string().min(6),
}).refine(data => data.email || data.username, {
  message: 'Email ou username obrigatório',
  path: ['email']
});

// Cardio: tipo, duração (min), data opcional
const cardioSchema = z.object({
  tipo: z.string().min(1).max(100),
  duracao_min: z.coerce.number().int().positive().max(1440), // max 24h
  data: z.string().datetime().optional(),
});

// Treino: tipo (string ou array de strings), data opcional
const treinoSchema = z.object({
  tipo: z.union([z.string(), z.array(z.string())]),
  data: z.string().datetime().optional(),
}).refine(data => {
  if (Array.isArray(data.tipo)) {
    return data.tipo.length > 0 && data.tipo.every(t => typeof t === 'string' && t.trim());
  }
  return typeof data.tipo === 'string' && data.tipo.trim().length > 0;
}, {
  message: 'Informe pelo menos um grupamento muscular',
  path: ['tipo']
});

// Profile: username e/ou email (pelo menos um)
const profileSchema = z.object({
  username: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
}).refine(data => data.username || data.email, {
  message: 'Informe ao menos um campo para atualizar',
});

// Root user creation
const createUserSchema = z.object({
  username: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).regex(/\d/).regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
    message: 'Senha deve ter pelo menos 8 chars, 1 número e 1 símbolo'
  }),
  is_admin: z.boolean().optional(),
});

// Root user update (parcial)
const updateUserSchema = z.object({
  username: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  is_admin: z.boolean().optional(),
  is_root: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Nenhum campo para atualizar',
});

// Cardio suggestion
const cardioSuggestionSchema = z.object({
  meta_semanal: z.number().positive(),
  atualizar: z.boolean().optional(),
});

// Meta cardio (trainer)
const metaCardioSchema = z.object({
  meta_minutos: z.number().int().nonnegative(),
});

module.exports = {
  loginSchema,
  cardioSchema,
  treinoSchema,
  profileSchema,
  createUserSchema,
  updateUserSchema,
  cardioSuggestionSchema,
  metaCardioSchema,
};
