const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const schema = read('prisma/schema.prisma');
const attempt = schema.slice(schema.indexOf('model SubmissionAttempt'), schema.indexOf('\nmodel ', schema.indexOf('model SubmissionAttempt') + 6));
for (const field of ['operation', 'keyHash', 'actorHash', 'payloadHash', 'state', 'entityId', 'stagedDriveFileId', 'expiresAt']) {
    assert.match(attempt, new RegExp(`\\b${field}\\b`));
}
assert.match(attempt, /@@unique\(\[operation, keyHash\]\)/);
assert.doesNotMatch(attempt, /trackingToken|responseBody|rawPayload|email\s+String/);

const ledger = read('lib/idempotency.ts');
assert.match(ledger, /createHmac\('sha256'/);
assert.match(ledger, /SUBMISSION_TOKEN_SECRET/);
assert.match(ledger, /SUBMISSION_IN_PROGRESS|kind: 'in_progress'/);
assert.match(ledger, /IDEMPOTENCY_KEY_REUSED|kind: 'reused'/);
assert.match(ledger, /markSubmissionSucceeded/);
assert.match(ledger, /recordStagedDriveReference/);
assert.match(read('lib/lost-found.ts'), /recordStagedDriveReference/);

for (const route of ['app/api/tickets/route.ts', 'app/api/proposals/route.ts', 'app/api/hub/lost-found/route.ts']) {
    assert.match(read(route), /Idempotency-Key/);
}
for (const client of ['app/services/grievance/page.tsx', 'app/services/proposals/page.tsx', 'app/hub/lost-found/page.tsx']) {
    assert.match(read(client), /getOrCreateIdempotencyKey/);
}

assert.match(read('.env.example'), /SUBMISSION_TOKEN_SECRET/);
assert.match(read('.env.example'), /TICKET_SOURCE/);
assert.match(read('.env.example'), /PROPOSAL_SOURCE/);

console.log('submission idempotency contract checks passed.');
