const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mapPanelSource = read(path.join('components', 'commute', 'CommuteMapPanel.tsx'));

assert(mapPanelSource.includes('getMapQualityBadge'), 'Commute map panel should compute a map-quality badge.');
assert(mapPanelSource.includes('Full geometry'), 'Commute map panel should label full geometry routes.');
assert(mapPanelSource.includes('Line + endpoints'), 'Commute map panel should label routes that only have a line and endpoints.');
assert(mapPanelSource.includes('Stops + endpoints'), 'Commute map panel should label routes with mapped stops but no full line.');
assert(mapPanelSource.includes('Endpoints only'), 'Commute map panel should label routes with endpoint-only map data.');
assert(mapPanelSource.includes('No mapped data'), 'Commute map panel should label routes without map-ready data.');

console.log('test-commute-map-quality: PASS');
