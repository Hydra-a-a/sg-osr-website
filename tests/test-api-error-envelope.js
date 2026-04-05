const fs = require('fs');
const path = require('path');

const apiErrorsPath = path.join(__dirname, '..', 'lib', 'api-errors.ts');
const source = fs.readFileSync(apiErrorsPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(source.includes('export class ApiError extends Error'), 'ApiError class is missing.');
assert(source.includes('export function toApiResponse(error: unknown)'), 'toApiResponse formatter is missing.');
assert(source.includes('error: {'), 'Standard error envelope object is missing.');
assert(source.includes('code'), 'Error envelope is missing code field.');
assert(source.includes('message'), 'Error envelope is missing message field.');
assert(source.includes("const code = 'INTERNAL_SERVER_ERROR';"), 'Internal server error code fallback is missing.');
assert(source.includes("const includeDetails = process.env.NODE_ENV !== 'production';"), 'Environment-based detail exposure guard is missing.');

console.log('test-api-error-envelope: PASS');
