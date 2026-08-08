function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

export function compareRecordSets(sourceRows, dbRows, { key, fields }) {
  const sourceMap = new Map();
  const dbMap = new Map();
  let duplicateSourceKeys = 0;
  let duplicateDbKeys = 0;

  sourceRows.forEach((row) => {
    const rowKey = String(row[key] || '').trim();
    if (!rowKey) return;
    if (sourceMap.has(rowKey)) duplicateSourceKeys += 1;
    sourceMap.set(rowKey, row);
  });

  dbRows.forEach((row) => {
    const rowKey = String(row[key] || '').trim();
    if (!rowKey) return;
    if (dbMap.has(rowKey)) duplicateDbKeys += 1;
    dbMap.set(rowKey, row);
  });

  let matchedKeys = 0;
  let fieldMismatchRows = 0;
  const fieldMismatchFields = {};

  sourceMap.forEach((sourceRow, rowKey) => {
    const dbRow = dbMap.get(rowKey);
    if (!dbRow) return;
    matchedKeys += 1;
    let rowMismatch = false;

    fields.forEach(({ name, sourceField = name, dbField = name }) => {
      if (valuesEqual(sourceRow[sourceField], dbRow[dbField])) return;
      rowMismatch = true;
      fieldMismatchFields[name] = (fieldMismatchFields[name] || 0) + 1;
    });

    if (rowMismatch) fieldMismatchRows += 1;
  });

  let missingInDb = 0;
  sourceMap.forEach((_, rowKey) => {
    if (!dbMap.has(rowKey)) missingInDb += 1;
  });

  let dbOnlyRows = 0;
  dbMap.forEach((_, rowKey) => {
    if (!sourceMap.has(rowKey)) dbOnlyRows += 1;
  });

  return {
    sourceRows: sourceMap.size,
    dbRows: dbMap.size,
    matchedKeys,
    missingInDb,
    dbOnlyRows,
    fieldMismatchRows,
    fieldMismatchFields,
    duplicateSourceKeys,
    duplicateDbKeys,
  };
}
