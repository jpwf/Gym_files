const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('node:crypto');

let groq;
let supabase;
const generationsInFlight = new Map();

class InvalidSuggestionError extends Error {}

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada.');
  }

  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  return groq;
}

function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada.');
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }

  return supabase;
}

const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';
const CARDIO_WEEKDAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];
const CARDIO_TIME_ZONE = 'America/Sao_Paulo';
const CARDIO_MOTIVATIONAL_MESSAGE = 'Mantenha a constância e avance no seu ritmo.';

function getAllowedCardioDays(skipToday = false, now = new Date()) {
  const todayKey = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: CARDIO_TIME_ZONE,
  }).format(now).toLowerCase();
  const todayIndex = CARDIO_WEEKDAYS.findIndex((day) => day.key === todayKey);
  const firstAllowedIndex = Math.max(todayIndex, 0) + Number(skipToday);

  return CARDIO_WEEKDAYS.slice(firstAllowedIndex).map((day) => ({
    ...day,
    isToday: day.key === todayKey,
  }));
}

function normalizeWeekday(day) {
  return String(day || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(?:-|\s)feira$/, '')
    .trim();
}

function validateSuggestion(suggestion, allowedDays, missingMinutes) {
  if (
    !suggestion ||
    typeof suggestion.mensagem_motivacional !== 'string' ||
    suggestion.mensagem_motivacional.trim().length === 0 ||
    suggestion.mensagem_motivacional.trim().split(/\s+/).length > 15 ||
    !Array.isArray(suggestion.sugestoes_diarias) ||
    suggestion.sugestoes_diarias.length === 0 ||
    suggestion.sugestoes_diarias.length > allowedDays.length
  ) {
    throw new InvalidSuggestionError('Formato ou mensagem da sugestão inválidos.');
  }

  const dayOptions = new Map();
  allowedDays.forEach((day) => {
    const displayLabel = day.isToday ? 'HOJE' : day.label;
    const index = CARDIO_WEEKDAYS.findIndex((weekday) => weekday.key === day.key);
    dayOptions.set(normalizeWeekday(day.label), { displayLabel, index });
    if (day.isToday) {
      dayOptions.set(normalizeWeekday('HOJE'), { displayLabel, index });
    }
  });

  const seenDays = new Set();
  let previousDayIndex = -1;
  const dailySuggestions = suggestion.sugestoes_diarias.map((item) => {
    const day = dayOptions.get(normalizeWeekday(item?.dia));
    if (
      !day ||
      seenDays.has(day.index) ||
      day.index <= previousDayIndex ||
      typeof item.minutos_sugeridos !== 'number' ||
      !Number.isFinite(item.minutos_sugeridos) ||
      item.minutos_sugeridos <= 0 ||
      typeof item.motivo !== 'string' ||
      item.motivo.trim().length === 0 ||
      item.motivo.trim().length > 180
    ) {
      throw new InvalidSuggestionError('A sugestão contém dias ou valores inválidos.');
    }

    seenDays.add(day.index);
    previousDayIndex = day.index;
    return {
      dia: day.displayLabel,
      minutos_sugeridos: item.minutos_sugeridos,
      motivo: item.motivo.trim(),
    };
  });

  const suggestedMinutes = dailySuggestions.reduce((total, item) => total + item.minutos_sugeridos, 0);
  if (Math.abs(Math.round(suggestedMinutes * 100) - Math.round(missingMinutes * 100)) > 1) {
    throw new InvalidSuggestionError('A soma sugerida não corresponde aos minutos faltantes.');
  }

  return {
    mensagem_motivacional: CARDIO_MOTIVATIONAL_MESSAGE,
    sugestoes_diarias: dailySuggestions,
  };
}

function buildContextKey(summary, metaSemanal, today, allowedDays) {
  const context = JSON.stringify({
    summary,
    metaSemanal,
    today,
    allowedDays: allowedDays.map((day) => day.key),
  });
  return createHash('sha256').update(context).digest('hex');
}

async function removeCardioSuggestionCache(userId) {
  const { error } = await getSupabaseClient()
    .from('ai_cache_sugestoes_app')
    .delete()
    .eq('app_user_id', String(userId));

  if (error) {
    throw new Error(`Erro ao remover cache do usuário: ${error.message}`);
  }
}

const obterSugestaoCardio = async (req, res) => {
  try {
    const { meta_semanal } = req.body || {};
    const user_id = req.user.id;
    const metaSemanal = Number(meta_semanal);

    if (!Number.isFinite(metaSemanal) || metaSemanal <= 0) {
      return res.status(400).json({ error: 'meta_semanal deve ser um número maior que zero.' });
    }

    const supabase = getSupabaseClient();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: CARDIO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // 1. Atualiza o resumo antes de validar o cache.
    const { data: summary, error: rpcError } = await supabase.rpc(
      'get_app_athlete_cardio_summary_bigint',
      { p_user_id: user_id, p_meta_semanal: metaSemanal }
    );

    if (rpcError) {
      throw new Error(`Erro no SQL Compressor: ${rpcError.message}`);
    }

    // Se o atleta já bateu a meta semanal
    if (!summary || typeof summary !== 'object') {
      throw new Error('A função de resumo não retornou dados válidos.');
    }

    const missingMinutes = Number(summary.faltante);
    if (!Number.isFinite(missingMinutes) || missingMinutes < 0) {
      throw new Error('A função de resumo retornou minutos faltantes inválidos.');
    }

    if (missingMinutes === 0) {
      const respostaMetaBatida = {
        mensagem_motivacional: 'Meta semanal concluída com sucesso! Mantenha o foco na recuperação.',
        sugestoes_diarias: []
      };
      return res.json({ origem: 'sistema', dados: respostaMetaBatida });
    }

    const allowedDays = getAllowedCardioDays(summary.realizado_hoje === true);
    if (allowedDays.length === 0) {
      return res.json({
        origem: 'sistema',
        dados: {
          mensagem_motivacional: 'Você já registrou seu cardio hoje. Retome as sugestões amanhã.',
          sugestoes_diarias: [],
        },
      });
    }

    const todayWeekday = CARDIO_WEEKDAYS.find((day) => day.key === new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: CARDIO_TIME_ZONE,
    }).format(new Date()).toLowerCase())?.label;
    const allowedDayLabels = allowedDays.map((day) => day.isToday ? 'HOJE' : day.label);
    const contextKey = buildContextKey(summary, metaSemanal, today, allowedDays);

    if (req.body?.atualizar !== true) {
      const { data: cache, error: cacheReadError } = await supabase
        .from('ai_cache_sugestoes_app')
        .select('sugestao_json')
        .eq('app_user_id', user_id)
        .maybeSingle();

      if (cacheReadError) {
        throw new Error(`Erro ao consultar cache da sugestão: ${cacheReadError.message}`);
      }

      if (cache?.sugestao_json?._context_key === contextKey) {
        try {
          const cachedSuggestion = validateSuggestion(
            cache.sugestao_json,
            allowedDays,
            missingMinutes
          );
          return res.json({ origem: 'cache', dados: cachedSuggestion });
        } catch {
          console.warn('Cache de sugestão inválido; será gerada uma nova resposta.');
        }
      }
    }

    const generationKey = `${user_id}:${contextKey}`;
    let generation = generationsInFlight.get(generationKey);

    if (!generation) {
      generation = (async () => {
        const groq = getGroqClient();
        const systemPrompt =
          'Use os dados fornecidos, que resumem as últimas 3 semanas de cardio do atleta. ' +
          'Planeje os minutos faltantes da meta semanal usando o menor número razoável de dias, ' +
          'respeitando o volume e os dias habituais do histórico. Não exceda o maior volume diário ' +
          'observado no histórico, salvo se isso tornar a meta impossível. Nunca inclua dia com 0 minutos. ' +
          'Use somente dias permitidos, na ordem informada, e distribua exatamente os minutos faltantes. ' +
          'Retorne somente um objeto JSON válido, sem markdown, comentários ou texto adicional, com o formato ' +
          '{"mensagem_motivacional":"frase genérica de incentivo, sem dias ou minutos","sugestoes_diarias":' +
          '[{"dia":"um dos dias permitidos","minutos_sugeridos":30,"motivo":"motivo curto"}]}. ' +
          'minutos_sugeridos deve ser numérico; não inclua campos adicionais.';
        const userPrompt =
          `Hoje é ${todayWeekday}. Dias permitidos: ${allowedDayLabels.join(', ')}. ` +
          `Minutos faltantes: ${missingMinutes}. Dados resumidos: ${JSON.stringify(summary)}`;
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];
        let completion;

        try {
          completion = await groq.chat.completions.create({
            messages,
            model: PRIMARY_MODEL,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 1000,
          });
        } catch (primaryError) {
          const status = Number(primaryError?.status);
          const jsonValidationFailed =
            primaryError?.code === 'json_validate_failed' ||
            primaryError?.error?.code === 'json_validate_failed' ||
            primaryError?.error?.error?.code === 'json_validate_failed';
          if (!jsonValidationFailed && status !== 429 && (!Number.isFinite(status) || status < 500)) {
            throw primaryError;
          }

          console.warn(
            `Falha no modelo primário (${PRIMARY_MODEL}); tentando fallback (${FALLBACK_MODEL}):`,
            primaryError?.status,
            primaryError?.message
          );
          completion = await groq.chat.completions.create({
            messages,
            model: FALLBACK_MODEL,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 1000,
          });
        }

        const suggestionText = completion.choices[0]?.message?.content;
        if (!suggestionText) {
          throw new InvalidSuggestionError('A IA retornou uma resposta vazia.');
        }

        let parsedSuggestion;
        try {
          parsedSuggestion = JSON.parse(suggestionText);
        } catch {
          throw new InvalidSuggestionError('A IA retornou um JSON inválido.');
        }

        const validatedSuggestion = validateSuggestion(
          parsedSuggestion,
          allowedDays,
          missingMinutes
        );
        const cachedSuggestion = {
          ...validatedSuggestion,
          _context_key: contextKey,
        };
        const { error: cacheError } = await supabase
          .from('ai_cache_sugestoes_app')
          .upsert({
            app_user_id: user_id,
            sugestao_json: cachedSuggestion,
            data_atualizacao: new Date().toISOString(),
          }, { onConflict: 'app_user_id' });

        if (cacheError) {
          throw new Error(`Erro ao salvar cache da sugestão: ${cacheError.message}`);
        }

        return validatedSuggestion;
      })();
      generationsInFlight.set(generationKey, generation);
    }

    try {
      const suggestion = await generation;
      return res.json({ origem: 'ia_gerado', dados: suggestion });
    } finally {
      if (generationsInFlight.get(generationKey) === generation) {
        generationsInFlight.delete(generationKey);
      }
    }

  } catch (error) {
    console.error('Erro na rota de sugestão de cardio:', error?.status, error?.message);
    if (error instanceof InvalidSuggestionError) {
      return res.status(502).json({
        error: 'A IA não conseguiu montar uma sugestão válida. Tente novamente.',
      });
    }
    return res.status(500).json({ error: 'Erro interno ao gerar sugestão de cardio.' });
  }
};

module.exports = {
  obterSugestaoCardio,
  removeCardioSuggestionCache,
  getAllowedCardioDays,
  validateSuggestion,
  buildContextKey,
};
