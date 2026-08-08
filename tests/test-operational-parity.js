const assert = require('node:assert/strict');

async function main() {
  const { compareRecordSets } = await import('../scripts/operational-parity.mjs');
  const source = [
    { id: 'one', value: 'same', payload: { b: 2, a: 1 } },
    { id: 'two', value: 'source', payload: { a: 1 } },
  ];
  const db = [
    { id: 'one', value: 'same', payload: { a: 1, b: 2 } },
    { id: 'three', value: 'db-only', payload: {} },
  ];
  const result = compareRecordSets(source, db, {
    key: 'id',
    fields: ['value', 'payload'].map((name) => ({ name })),
  });

  assert.equal(result.sourceRows, 2);
  assert.equal(result.dbRows, 2);
  assert.equal(result.matchedKeys, 1);
  assert.equal(result.missingInDb, 1);
  assert.equal(result.dbOnlyRows, 1);
  assert.equal(result.fieldMismatchRows, 0);

  const mismatch = compareRecordSets([{ id: 'one', value: 'source' }], [{ id: 'one', value: 'db' }], {
    key: 'id',
    fields: [{ name: 'value' }],
  });
  assert.equal(mismatch.fieldMismatchRows, 1);
  assert.equal(mismatch.fieldMismatchFields.value, 1);

  console.log('test-operational-parity: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
