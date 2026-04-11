const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const roots = ['app', 'components'];
const validExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const stylePropPattern = /\bstyle\s*=\s*\{/g;

function walkDirectory(directoryPath, collected) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      walkDirectory(fullPath, collected);
      continue;
    }

    if (!validExtensions.has(path.extname(entry.name))) {
      continue;
    }

    collected.push(fullPath);
  }
}

function collectSourceFiles() {
  const files = [];

  for (const root of roots) {
    const fullRoot = path.join(repoRoot, root);
    if (!fs.existsSync(fullRoot)) {
      continue;
    }

    walkDirectory(fullRoot, files);
  }

  return files.sort();
}

const files = collectSourceFiles();
const findings = [];
let totalMatches = 0;

for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');
  const matches = source.match(stylePropPattern);
  const count = matches ? matches.length : 0;

  if (count > 0) {
    totalMatches += count;
    findings.push({
      file: path.relative(repoRoot, filePath),
      count,
    });
  }
}

if (findings.length === 0) {
  console.log('scan-inline-styles: PASS (0 style props found in app/ and components/)');
  process.exit(0);
}

console.error(`scan-inline-styles: FAIL (${totalMatches} style props found)`);
for (const finding of findings) {
  console.error(`- ${finding.file}: ${finding.count}`);
}

process.exit(1);
