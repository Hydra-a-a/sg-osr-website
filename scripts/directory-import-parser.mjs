import { createHash } from 'node:crypto';

const KNOWN_CATEGORIES = [
  'Academic Organization',
  'Non-Academic Organization',
  'Central Student Council',
  'College / Institute Student Council',
  'Supreme Student Council',
];

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  const candidate = normalize(value).replace(/[<>]/g, '').toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : '';
}

function normalizeFacebookUrl(value) {
  const candidate = extractFormulaUrl(value).replace(/[<>]/g, '').trim();
  if (!candidate) return '';

  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:' || !/(^|\.)facebook\.com$/i.test(parsed.hostname)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeKeyPart(value) {
  return normalize(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function buildDirectoryKey({ entryType, sourceLabel, name, email = '', category = '' }) {
  const identity = [entryType, sourceLabel, name, email, category].map(normalizeKeyPart).join('|');
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 16);
  return `${normalizeKeyPart(entryType) || 'entry'}-${digest}`;
}

function extractFormulaUrl(value) {
  const formula = normalize(value);
  const match = formula.match(/^=\s*HYPERLINK\(\s*"([^"]+)"\s*,/i);
  return match?.[1]?.trim() || formula;
}

function extractDriveFileId(value) {
  const raw = extractFormulaUrl(value);
  try {
    const parsed = new URL(raw);
    const isDrive = ['drive.google.com', 'www.drive.google.com', 'docs.google.com'].includes(parsed.hostname.toLowerCase());
    if (!isDrive) return null;
    const pathMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (pathMatch?.[1]) return { fileId: pathMatch[1], resourceKey: parsed.searchParams.get('resourcekey') || '' };
    const id = parsed.searchParams.get('id');
    if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return { fileId: id, resourceKey: parsed.searchParams.get('resourcekey') || '' };
  } catch {
    return null;
  }
  return null;
}

function normalizeLogo(value) {
  const raw = extractFormulaUrl(value);
  if (!raw) return { imageUrl: '', driveFileId: '', resourceKey: '' };
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return { imageUrl: raw, driveFileId: '', resourceKey: '' };
  }
  const drive = extractDriveFileId(raw);
  if (drive) {
    const query = drive.resourceKey ? `?resourcekey=${encodeURIComponent(drive.resourceKey)}` : '';
    return {
      imageUrl: `/api/directory/logos/${encodeURIComponent(drive.fileId)}${query}`,
      driveFileId: drive.fileId,
      resourceKey: drive.resourceKey,
    };
  }

  try {
    const parsed = new URL(raw);
    // Directory logos must be Drive-backed or local static fallbacks. Do not
    // import arbitrary external image hosts into the public directory.
    if (parsed.protocol === 'https:') return { imageUrl: '', driveFileId: '', resourceKey: '' };
  } catch {
    // Invalid logo values are ignored rather than written to Neon.
  }
  return { imageUrl: '', driveFileId: '', resourceKey: '' };
}

function normalizeCategory(cells, fallback) {
  const joined = cells.map(normalize).join(' ').toLowerCase();
  const category = KNOWN_CATEGORIES.find((candidate) => joined.includes(candidate.toLowerCase()));
  return category || normalize(fallback);
}

function headerIndexes(rows, predicates, defaults) {
  const headerRowIndex = rows.findIndex((row) => {
    const joined = row.map(normalize).join(' ').toLowerCase();
    return predicates.some((predicate) => joined.includes(predicate));
  });
  const header = headerRowIndex >= 0 ? rows[headerRowIndex].map((cell) => normalize(cell).toLowerCase()) : [];
  const find = (terms, fallback) => {
    const index = header.findIndex((cell) => terms.some((term) => cell.includes(term)));
    return index >= 0 ? index : fallback;
  };
  return {
    headerRowIndex,
    nameIndex: find(['organization name', 'office name', 'organization', 'name'], defaults.nameIndex),
    acronymIndex: find(['acronym', 'initials', 'initialism'], defaults.acronymIndex),
    categoryIndex: find(['category', 'branch', 'unit'], defaults.categoryIndex),
    emailIndex: find(['contact email', 'email'], defaults.emailIndex),
    logoIndex: find(['logo'], defaults.logoIndex),
    facebookIndex: find(['facebook'], defaults.facebookIndex),
    officialIndex: find(['official', 'head', 'director'], defaults.officialIndex),
    titleIndex: find(['title', 'position'], defaults.titleIndex),
    locationIndex: find(['location'], defaults.locationIndex),
  };
}

function isSectionRow(name, cells) {
  const lower = normalize(name).toLowerCase();
  if (KNOWN_CATEGORIES.some((category) => category.toLowerCase() === lower)) return true;
  return cells.filter((cell) => normalize(cell)).length === 1;
}

export function parseDirectorySheets({ organizations = [], offices = [] } = {}) {
  const result = { entries: [], blockers: [], skippedRows: 0 };
  const keyOwners = new Map();

  const addEntry = (entry) => {
    if (keyOwners.has(entry.directoryKey)) {
      result.blockers.push({ source: entry.sourceLabel, row: entry.sourceRow, code: 'DUPLICATE_DIRECTORY_KEY' });
      return;
    }
    keyOwners.set(entry.directoryKey, entry);
    result.entries.push(entry);
  };

  for (const source of organizations) {
    const rows = Array.isArray(source.rows) ? source.rows : [];
    const indexes = headerIndexes(rows, ['organization', 'acronym', 'email', 'initials'], {
      nameIndex: 0, acronymIndex: 1, categoryIndex: -1, emailIndex: 2, logoIndex: 4, facebookIndex: 3,
      officialIndex: -1, titleIndex: -1, locationIndex: -1,
    });
    const start = Number(source.startRow || 1);
    let order = 0;

    rows.forEach((row, rowIndex) => {
      if (rowIndex <= indexes.headerRowIndex || !row.some((cell) => normalize(cell))) return;
      const cells = row.map(normalize);
      const name = cells[indexes.nameIndex] || '';
      const email = normalizeEmail(cells[indexes.emailIndex]);
      const acronym = cells[indexes.acronymIndex] || '';
      const category = normalizeCategory(cells, source.fallbackCategory || source.sourceLabel);
      if (!name || isSectionRow(name, cells)) {
        result.skippedRows += 1;
        return;
      }

      if (!email && !acronym && !cells[indexes.logoIndex]) {
        result.blockers.push({ source: source.sourceLabel, row: start + rowIndex, code: 'MISSING_ORGANIZATION_DETAILS' });
        return;
      }

      const logo = normalizeLogo(cells[indexes.logoIndex]);
      addEntry({
        directoryKey: buildDirectoryKey({ entryType: 'organization', sourceLabel: source.sourceLabel, name, email, category }),
        entryType: 'organization',
        sourceLabel: source.sourceLabel,
        sourceRow: start + rowIndex,
        name,
        roleOrOffice: acronym || 'Organization',
        councilOrUnit: category,
        email,
        imageUrl: logo.imageUrl,
        driveFileId: logo.driveFileId,
        resourceKey: logo.resourceKey,
        sortOrder: order++,
        publicDataJson: { category, facebookUrl: normalizeFacebookUrl(cells[indexes.facebookIndex]) },
      });
    });
  }

  for (const source of offices) {
    const rows = Array.isArray(source.rows) ? source.rows : [];
    const indexes = headerIndexes(rows, ['office', 'director', 'location', 'branch'], {
      nameIndex: 0, acronymIndex: 1, categoryIndex: 2, emailIndex: 4, logoIndex: 3, facebookIndex: -1,
      officialIndex: 5, titleIndex: 6, locationIndex: 7,
    });
    const start = Number(source.startRow || 1);
    let order = 0;

    rows.forEach((row, rowIndex) => {
      if (rowIndex <= indexes.headerRowIndex || !row.some((cell) => normalize(cell))) return;
      const cells = row.map(normalize);
      const name = cells[indexes.nameIndex] || '';
      if (!name) {
        result.blockers.push({ source: source.sourceLabel, row: start + rowIndex, code: 'MISSING_OFFICE_NAME' });
        return;
      }

      const email = normalizeEmail(cells[indexes.emailIndex]);
      const branch = cells[indexes.categoryIndex] || source.fallbackCategory || 'University Office';
      const official = cells[indexes.officialIndex] || '';
      const title = cells[indexes.titleIndex] || '';
      const location = cells[indexes.locationIndex] || '';
      const acronym = cells[indexes.acronymIndex] || '';
      const logo = normalizeLogo(cells[indexes.logoIndex]);
      if (!email && !official && !title && !location && !acronym && !logo.imageUrl) {
        result.skippedRows += 1;
        return;
      }

      addEntry({
        directoryKey: buildDirectoryKey({ entryType: 'office', sourceLabel: source.sourceLabel, name, email, category: branch }),
        entryType: 'office',
        sourceLabel: source.sourceLabel,
        sourceRow: start + rowIndex,
        name,
        roleOrOffice: [official, title].filter(Boolean).join(' - '),
        councilOrUnit: branch,
        email,
        imageUrl: logo.imageUrl,
        driveFileId: logo.driveFileId,
        resourceKey: logo.resourceKey,
        sortOrder: order++,
        publicDataJson: { location },
      });
    });
  }

  return result;
}

export function summarizeDirectoryImport(result) {
  const blockerCounts = {};
  for (const blocker of result.blockers) blockerCounts[blocker.code] = (blockerCounts[blocker.code] || 0) + 1;
  return {
    parsedEntries: result.entries.length,
    organizations: result.entries.filter((entry) => entry.entryType === 'organization').length,
    offices: result.entries.filter((entry) => entry.entryType === 'office').length,
    logos: result.entries.filter((entry) => entry.imageUrl).length,
    skippedRows: result.skippedRows,
    blockers: result.blockers.length,
    blockerCounts,
  };
}
