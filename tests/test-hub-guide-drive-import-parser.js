const assert = require('assert');

(async () => {
  const { parseHubGuideDriveFiles, summarizeHubGuideDriveImport } = await import('../scripts/hub-guide-drive-import-parser.mjs');
  const guides = parseHubGuideDriveFiles([
    { id: 'other', name: 'Notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { id: 'beta', name: 'Student-Handbook.pdf', mimeType: 'application/pdf' },
    { id: 'alpha', name: 'Academic_Calendar.PDF', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/alpha/view' },
  ]);
  assert.deepStrictEqual(guides.map((guide) => guide.title), ['Academic Calendar', 'Student Handbook']);
  assert.deepStrictEqual(guides.map((guide) => guide.sortOrder), [0, 1]);
  assert.strictEqual(guides[0].driveFileId, 'alpha');
  assert.deepStrictEqual(summarizeHubGuideDriveImport([1, 2, 3], guides), { scannedFiles: 3, pdfFiles: 2, skippedNonPdfFiles: 1, guideTitles: ['Academic Calendar', 'Student Handbook'] });
  console.log('test-hub-guide-drive-import-parser: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
