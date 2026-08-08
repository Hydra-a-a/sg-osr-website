const assert = require('assert');

async function main() {
  const parser = await import('../scripts/directory-import-parser.mjs');
  const result = parser.parseDirectorySheets({
    organizations: [{
      sourceLabel: 'Supreme Student Council',
      fallbackCategory: 'Supreme Student Council',
      rows: [
        ['Organization', 'Acronym', 'Email', 'Facebook', 'Logo'],
        ['Office of the Secretary General', 'OSG', 'osg@rtu.edu.ph', '', 'https://drive.google.com/file/d/legacyLogo123456/view'],
        ['Office of the Secretary General', 'OSG', 'osg@rtu.edu.ph', '', ''],
      ],
    }],
    offices: [{
      sourceLabel: 'University Offices',
      rows: [
        ['Office Name', 'Acronym', 'Branch', 'Logo', 'Email', 'Official', 'Title', 'Location'],
        ['Registrar', 'RO', 'Academic', '', 'registrar@rtu.edu.ph', 'A. Official', 'Registrar', 'Mandaluyong'],
      ],
    }],
  });

  assert.strictEqual(result.entries.length, 2);
  assert.strictEqual(result.entries[0].imageUrl, '/api/directory/logos/legacyLogo123456');
  assert.strictEqual(result.entries[0].directoryKey, parser.buildDirectoryKey({
    entryType: 'organization',
    sourceLabel: 'Supreme Student Council',
    name: 'Office of the Secretary General',
    email: 'osg@rtu.edu.ph',
    category: 'Supreme Student Council',
  }));
  assert.strictEqual(result.blockers.length, 1);
  assert.strictEqual(result.blockers[0].code, 'DUPLICATE_DIRECTORY_KEY');

  const summary = parser.summarizeDirectoryImport(result);
  assert.deepStrictEqual(summary.blockerCounts, { DUPLICATE_DIRECTORY_KEY: 1 });

  const edgeCases = parser.parseDirectorySheets({
    organizations: [{
      sourceLabel: 'Organizations',
      fallbackCategory: 'Academic Organization',
      rows: [
        ['Organization', 'Acronym', 'Email', 'Logo'],
        ['', 'EMPTY', '', ''],
        ['External Logo Org', 'ELO', 'elo@rtu.edu.ph', 'https://images.example.test/logo.png'],
      ],
    }],
    offices: [{
      sourceLabel: 'Offices',
      rows: [['Office Name', 'Acronym', 'Branch', 'Logo', 'Email', 'Official', 'Title', 'Location']],
    }],
  });
  assert.strictEqual(edgeCases.entries.length, 1, 'missing names should not become DB entries.');
  assert.strictEqual(edgeCases.entries[0].imageUrl, '', 'arbitrary external logo URLs should not be imported.');
  assert.strictEqual(edgeCases.entries[0].directoryKey, parser.buildDirectoryKey({
    entryType: 'organization',
    sourceLabel: 'Organizations',
    name: 'External Logo Org',
    email: 'elo@rtu.edu.ph',
    category: 'Academic Organization',
  }));
  console.log('test-directory-import-parser: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
