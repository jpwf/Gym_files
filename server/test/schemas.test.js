const assert = require('node:assert/strict');
const test = require('node:test');
const { cardioSchema } = require('../src/lib/schemas');

test('accepts cardio duration strings from multipart forms and coerces them to numbers', () => {
  const result = cardioSchema.safeParse({
    tipo: 'Corrida Rua',
    duracao_min: '30',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.duracao_min, 30);
});

test('keeps cardio duration validation after coercion', () => {
  for (const duracao_min of ['abc', '0', '-1', '30.5', '1441']) {
    assert.equal(cardioSchema.safeParse({
      tipo: 'Corrida Rua',
      duracao_min,
    }).success, false);
  }
});
