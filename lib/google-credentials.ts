import { createPrivateKey } from 'node:crypto';

const CLIENT_EMAIL_KEYS = ['GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'GOOGLE_CLIENT_EMAIL'] as const;
const PRIVATE_KEY_KEYS = ['GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'GOOGLE_PRIVATE_KEY'] as const;

type GoogleCredentials = {
    client_email: string;
    private_key: string;
};

function getFirstEnvValue(keys: readonly string[]): string | undefined {
    for (const key of keys) {
        const value = process.env[key];
        if (value && value.trim()) {
            return value;
        }
    }
    return undefined;
}

function stripWrappingQuotes(value: string): string {
    let normalized = value.trim();

    // Some env providers/local .env files end up with nested or escaped wrapping
    // quotes around PEM blocks (for example: \"-----BEGIN...-----\").
    // Strip outer wrappers repeatedly to recover the raw key body safely.
    for (let i = 0; i < 3; i++) {
        const hasDirectDoubleQuotes = normalized.length >= 2
            && normalized.startsWith('"')
            && normalized.endsWith('"');
        const hasDirectSingleQuotes = normalized.length >= 2
            && normalized.startsWith("'")
            && normalized.endsWith("'");

        const hasEscapedDoubleQuotes = normalized.length >= 4
            && normalized.startsWith('\\"')
            && normalized.endsWith('\\"');
        const hasEscapedSingleQuotes = normalized.length >= 4
            && normalized.startsWith("\\'")
            && normalized.endsWith("\\'");

        if (hasEscapedDoubleQuotes || hasEscapedSingleQuotes) {
            normalized = normalized.slice(2, -2).trim();
            continue;
        }

        if (hasDirectDoubleQuotes || hasDirectSingleQuotes) {
            normalized = normalized.slice(1, -1).trim();
            continue;
        }

        break;
    }

    return normalized;
}

function normalizePrivateKey(rawKey: string): string {
    const withoutQuotes = stripWrappingQuotes(rawKey);

    const normalized = withoutQuotes
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

    return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function validatePrivateKey(privateKey: string): void {
    try {
        createPrivateKey(privateKey);
    } catch {
        throw new Error(
            '[Google Auth] Invalid private key format. Ensure the key is PEM encoded and environment newlines are preserved (use literal \\n in Vercel env var values).'
        );
    }
}

export function getGoogleServiceAccountCredentials(): GoogleCredentials {
    const clientEmail = getFirstEnvValue(CLIENT_EMAIL_KEYS)?.trim();
    const rawPrivateKey = getFirstEnvValue(PRIVATE_KEY_KEYS);

    if (!clientEmail) {
        throw new Error('[Google Auth] Missing service account client email env var. Expected GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.');
    }

    if (!rawPrivateKey) {
        throw new Error('[Google Auth] Missing service account private key env var. Expected GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
    }

    const privateKey = normalizePrivateKey(rawPrivateKey);

    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
        throw new Error('[Google Auth] Private key is not a valid PEM block. Check env var formatting in deployment settings.');
    }

    validatePrivateKey(privateKey);

    return {
        client_email: clientEmail,
        private_key: privateKey,
    };
}