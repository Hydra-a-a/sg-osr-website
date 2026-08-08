const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const commuteSchema = read(path.join('schemas', 'commute.ts'));
const providerSource = read(path.join('lib', 'commute-providers.ts'));
const commutePageSource = read(path.join('app', 'hub', 'commute', 'page.tsx'));
const envExampleSource = read('.env.example');
const packageJsonSource = read('package.json');
const mapPanelPath = path.join(__dirname, '..', 'components', 'commute', 'CommuteMapPanel.tsx');

assert(commuteSchema.includes('CommuteCoordinateSchema'), 'Commute schema should define a coordinate schema for map rendering.');
assert(commuteSchema.includes('routeGeometry'), 'Commute schema should expose optional route geometry.');
assert(commuteSchema.includes('originCoordinate'), 'Commute schema should expose an origin coordinate.');
assert(commuteSchema.includes('destinationCoordinate'), 'Commute schema should expose a destination coordinate.');
assert(commuteSchema.includes('waypoints'), 'Commute schema should expose waypoint markers for curated routes.');

assert(providerSource.includes('COMMUTE_GEOCODER_ENDPOINT'), 'Commute provider should support an environment-driven geocoder endpoint.');
assert(providerSource.includes('resolveRouteMapData'), 'Commute provider should resolve map data for route responses.');
assert(providerSource.includes('route_geometry_json') || providerSource.includes('Route_Geometry_Json') || providerSource.includes('routeGeometry'), 'Commute provider should account for coordinate-ready curated route geometry.');
assert(providerSource.includes('origin_lat') || providerSource.includes('Origin_Lat') || providerSource.includes('originCoordinate'), 'Commute provider should account for curated origin coordinates.');

assert(fs.existsSync(mapPanelPath), 'Commute map panel component should exist.');
const mapPanelSource = fs.existsSync(mapPanelPath) ? fs.readFileSync(mapPanelPath, 'utf8') : '';
assert(mapPanelSource.includes('maplibre-gl') || mapPanelSource.includes('MapLibre'), 'Commute map panel should use MapLibre for the temporary map shell.');
assert(!mapPanelSource.includes('this is a test'), 'Commute map panel should not ship placeholder copy.');
assert(!mapPanelSource.includes('testing testing.'), 'Commute map panel should not ship placeholder provider copy.');
assert(commutePageSource.includes('CommuteMapPanel'), 'Commute page should render the commute map panel.');
assert(
  commutePageSource.includes('Map preview')
  || commutePageSource.includes('Map canvas')
  || mapPanelSource.includes('Map preview')
  || mapPanelSource.includes('Map canvas'),
  'Commute page should label the new map area.',
);

assert(envExampleSource.includes('COMMUTE_GEOCODER_ENDPOINT='), '.env.example should document the commute geocoder endpoint.');
assert(envExampleSource.includes('NEXT_PUBLIC_COMMUTE_MAP_STYLE_URL='), '.env.example should document the public commute map style URL.');
assert(packageJsonSource.includes('maplibre-gl'), 'Package manifest should include maplibre-gl for the commute map shell.');

console.log('test-commute-map-rollout: PASS');
