const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

let groq;
let supabase;

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

function getAllowedCardioDays(now = new Date()) {
  const todayKey = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: CARDIO_TIME_ZONE,
  }).format(now).toLowerCase();
  const todayIndex = CARDIO_WEEKDAYS.findIndex((day) => day.key === todayKey);

  return CARDIO_WEEKDAYS.slice(Math.max(todayIndex, 0));
}

function normalizeWeekday(day) {
  return String(day || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(?:-|\s)feira$/, '')
    .trim();
}

function filterAllowedCardioDays(suggestion, allowedDays) {
  const dayLabels = new Map();
  allowedDays.forEach((day, index) => {
    const displayLabel = index === 0 ? 'HOJE' : day.label;
    dayLabels.set(normalizeWeekday(day.label), displayLabel);
    if (index === 0) {
      dayLabels.set(normalizeWeekday('HOJE'), 'HOJE');
    }
  });
  const sourceDays = Array.isArray(suggestion?.sugestoes_diarias)
    ? suggestion.sugestoes_diarias
    : [];
  const validSuggestions = sourceDays.flatMap((item) => {
    const dayLabel = dayLabels.get(normalizeWeekday(item?.dia));
    return dayLabel ? [{ ...item, dia: dayLabel }] : [];
  });

  return {
    ...suggestion,
    sugestoes_diarias: validSuggestions,
  };
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
    const groq = getGroqClient();
    const allowedDays = getAllowedCardioDays();
    const todayWeekday = allowedDays[0].label;
    const allowedDayLabels = allowedDays.map((day, index) => index === 0 ? 'HOJE' : day.label);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: CARDIO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // 1. Verifica no Supabase se já existe cache válido para O DIA DE HOJE
    const { data: cache } = await supabase
      .from('ai_cache_sugestoes_app')
      .select('sugestao_json')
      .eq('app_user_id', user_id)
      .gte('data_atualizacao', today)
      .single();

    if (cache) {
      const cachedDays = Array.isArray(cache.sugestao_json?.sugestoes_diarias)
        ? cache.sugestao_json.sugestoes_diarias
        : null;
      const filteredCache = filterAllowedCardioDays(cache.sugestao_json, allowedDays);

      if (cachedDays && filteredCache.sugestoes_diarias.length === cachedDays.length) {
        return res.json({ origem: 'cache', dados: filteredCache });
      }
    }

    // 2. Chama a função SQL compressor (obtém os dados sumarizados em poucos tokens)
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

    if (Number(summary.faltante) === 0) {
      const respostaMetaBatida = {
        mensagem_motivacional: 'Meta semanal concluída com sucesso! Mantenha o foco na recuperação.',
        sugestoes_diarias: []
      };
      return res.json({ origem: 'sistema', dados: respostaMetaBatida });
    }

    // 3. Monta os prompts otimizados
    const systemPrompt = 
      'Você é o personal trainer analítico do GymFiles. ' +
      'Com base nos dados compactos do atleta, distribua os minutos faltantes ' +
      'nos dias restantes da semana priorizando o padrão histórico dele. ' +
      'Retorne ESTRITAMENTE um JSON válido contendo as chaves: ' +
      '"mensagem_motivacional" (string de até 15 palavras) e ' +
      '"sugestoes_diarias" (lista de objetos com "dia", "minutos_sugeridos" e "motivo"). ' +
      `Hoje é ${todayWeekday}. Para o dia atual, use exatamente "HOJE". ` +
      `Sugira SOMENTE estes dias, nesta ordem: ${allowedDayLabels.join(', ')}. ` +
      'Nunca sugira dias anteriores a hoje e use exatamente os nomes informados. ' +
      'Retorne apenas um objeto JSON, sem markdown ou texto fora dele, neste formato: ' +
      '{"mensagem_motivacional":"...","sugestoes_diarias":[{"dia":"...","minutos_sugeridos":30,"motivo":"..."}]}.';

    const userPrompt = `Dias válidos para as sugestões: ${allowedDayLabels.join(', ')}. Dados do atleta: ${JSON.stringify(summary)}`;

    let sugestaoTexto = null;

    // 4. Execução no Groq com Fallback de Modelo
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: PRIMARY_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1200
      });

      sugestaoTexto = completion.choices[0]?.message?.content;
    } catch (primaryError) {
      console.warn(
        `Falha no modelo primário (${PRIMARY_MODEL}); tentando fallback (${FALLBACK_MODEL}):`,
        primaryError?.status,
        primaryError?.message
      );
      
      const fallbackCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: FALLBACK_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1200
      });

      sugestaoTexto = fallbackCompletion.choices[0]?.message?.content;
    }

    if (!sugestaoTexto) {
      throw new Error('Não foi possível obter resposta da IA.');
    }

    const sugestaoJson = filterAllowedCardioDays(JSON.parse(sugestaoTexto), allowedDays);

    // 5. Salva a resposta no cache do Supabase
    const { error: cacheError } = await supabase.from('ai_cache_sugestoes_app').upsert({
      app_user_id: user_id,
      sugestao_json: sugestaoJson,
      data_atualizacao: new Date().toISOString()
    }, { onConflict: 'app_user_id' });

    if (cacheError) {
      throw new Error(`Erro ao salvar cache da sugestão: ${cacheError.message}`);
    }

    return res.json({ origem: 'ia_gerado', dados: sugestaoJson });

  } catch (error) {
    console.error('Erro na rota de sugestão de cardio:', error?.status, error?.message);
    return res.status(500).json({ error: 'Erro interno ao gerar sugestão de cardio.' });
  }
};

module.exports = { obterSugestaoCardio };