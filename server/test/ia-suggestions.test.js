const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildContextKey,
  getAllowedCardioDays,
  validateSuggestion,
} = require('../src/services/ia-suggestions');

const now = new Date('2026-11-04T15:00:00.000Z');
const remainingDays = getAllowedCardioDays(false, now);
const allowedAfterCardio = getAllowedCardioDays(true, now);

test('days are limited to today through Sunday in the configured timezone', () => {
  assert.deepEqual(
    remainingDays.map((day) => day.key),
    ['wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  );
  assert.deepEqual(
    allowedAfterCardio.map((day) => day.key),
    ['thursday', 'friday', 'saturday', 'sunday']
  );
  assert.deepEqual(getAllowedCardioDays(true, new Date('2026-11-08T15:00:00.000Z')), []);
});

test('normalizes valid positive suggestions and preserves the exact missing total', () => {
  const suggestion = validateSuggestion({
    mensagem_motivacional: 'Consistência acima de tudo.',
    sugestoes_diarias: [
      { dia: 'HOJE', minutos_sugeridos: 30, motivo: 'Dia habitual de cardio.' },
      { dia: 'Sexta-feira', minutos_sugeridos: 30, motivo: 'Complementa a meta.' },
    ],
  }, remainingDays, 60);

  assert.deepEqual(suggestion.sugestoes_diarias.map((item) => item.dia), ['HOJE', 'Sexta-feira']);
});

test('rejects zero-minute, past-day, duplicate-day, and mismatched-total suggestions', () => {
  const base = {
    mensagem_motivacional: 'Mantenha a constância.',
    sugestoes_diarias: [
      { dia: 'HOJE', minutos_sugeridos: 60, motivo: 'Dia habitual.' },
    ],
  };

  assert.throws(() => validateSuggestion({
    ...base,
    sugestoes_diarias: [{ ...base.sugestoes_diarias[0], minutos_sugeridos: 0 }],
  }, remainingDays, 60), /inválidos/);
  assert.throws(() => validateSuggestion({
    ...base,
    sugestoes_diarias: [{ ...base.sugestoes_diarias[0], dia: 'Segunda-feira' }],
  }, remainingDays, 60), /inválidos/);
  assert.throws(() => validateSuggestion({
    ...base,
    sugestoes_diarias: [
      ...base.sugestoes_diarias,
      { dia: 'HOJE', minutos_sugeridos: 1, motivo: 'Duplicado.' },
    ],
  }, remainingDays, 61), /inválidos/);
  assert.throws(() => validateSuggestion({
    ...base,
    sugestoes_diarias: [{ ...base.sugestoes_diarias[0], minutos_sugeridos: 59 }],
  }, remainingDays, 60), /não corresponde/);
});

test('cache context changes when the summary, goal, date, or allowed days change', () => {
  const firstKey = buildContextKey({ faltante: 60 }, 100, '2026-11-04', remainingDays);

  assert.notEqual(
    buildContextKey({ faltante: 50 }, 100, '2026-11-04', remainingDays),
    firstKey
  );
  assert.notEqual(
    buildContextKey({ faltante: 60 }, 120, '2026-11-04', remainingDays),
    firstKey
  );
  assert.notEqual(
    buildContextKey({ faltante: 60 }, 100, '2026-11-05', remainingDays),
    firstKey
  );
  assert.notEqual(
    buildContextKey({ faltante: 60 }, 100, '2026-11-04', allowedAfterCardio),
    firstKey
  );
});
