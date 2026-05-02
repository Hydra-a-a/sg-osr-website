import { Client, TravelMode, TransitMode } from '@googlemaps/google-maps-services-js';
import { Redis } from '@upstash/redis';
import { getSheetData } from '@/lib/sheets';
import { CommuteResponse, CommuteStep, CommuteNotice, CommuteStepSchema } from '@/schemas/commute';

const redis = Redis.fromEnv();
const CACHE_TTL_SECONDS = 86400; // 24 hours

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CURATED_SHEETS_ID = process.env.COMMUTER_MAPS_SHEET_ID;

// Optional: Fallback to info sheet if no specific maps sheet is set
const ACTUAL_SHEETS_ID = CURATED_SHEETS_ID || process.env.GOOGLE_SHEETS_INFO_ID;

const mapsClient = new Client({});

function normalizeSearchTerm(term: string): string {
    return term.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if the current time in Manila is after 9 PM or before 4 AM
 */
function isLateNight(): boolean {
    const manilaTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const hours = manilaTime.getHours();
    return hours >= 21 || hours < 4;
}

/**
 * Generates a deep link to Google Maps Directions
 */
function generateGoogleMapsUrl(origin: string, destination: string): string {
    const baseUrl = 'https://www.google.com/maps/dir/?api=1';
    return `${baseUrl}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
}

/**
 * Strategy 1: Live Google Directions API
 */
async function getGoogleDirections(origin: string, destination: string): Promise<CommuteResponse | null> {
    if (!MAPS_API_KEY) {
        console.log('[Commute] Missing GOOGLE_MAPS_API_KEY, skipping Google provider.');
        return null; // Triggers fallback
    }

    try {
        const response = await mapsClient.directions({
            params: {
                origin,
                destination,
                mode: TravelMode.transit,
                key: MAPS_API_KEY,
                region: 'ph', // Bias towards Philippines
            },
        });

        if (response.data.status !== 'OK' || !response.data.routes.length) {
            console.warn('[Commute] Google Maps returned no routes or error:', response.data.status);
            return null; // Triggers fallback
        }

        const route = response.data.routes[0];
        const leg = route.legs[0];

        const steps: CommuteStep[] = leg.steps.map(step => {
            let type: CommuteStep['type'] = 'WALK';
            let colorCode: string | undefined = undefined;

            if (step.travel_mode === TravelMode.transit && step.transit_details) {
                const transitType = step.transit_details.line.vehicle.type;
                if (transitType === 'BUS' || transitType === 'INTERCITY_BUS') type = 'BUS';
                else if (transitType === 'HEAVY_RAIL' || transitType === 'COMMUTER_TRAIN' || transitType === 'SUBWAY') type = 'MRT';
                else if (transitType === 'SHARE_TAXI') type = 'UV'; // Often mapped as share taxi
                else type = 'JEEP'; // Default generic fallback for local transit in PH
                
                colorCode = step.transit_details.line.color;
            }

            // Strip HTML tags from instruction
            const instruction = step.html_instructions.replace(/<[^>]*>?/gm, '');
            const durationMins = Math.ceil((step.duration?.value || 0) / 60);

            return {
                type,
                instruction,
                durationMins: durationMins > 0 ? durationMins : undefined,
                colorCode,
            };
        });

        const fareEstimate = route.fare ? route.fare.text : undefined;

        return {
            status: 'success',
            provider: 'google',
            summary: {
                totalDurationMins: Math.ceil((leg.duration?.value || 0) / 60),
                totalDistanceKm: Number((leg.distance?.value || 0) / 1000),
                fareEstimateRange: fareEstimate,
            },
            steps,
            notices: [], // Will be populated by orchestrator
            externalUrl: generateGoogleMapsUrl(origin, destination),
        };

    } catch (error) {
        console.error('[Commute] Google Directions API failed:', error);
        return null; // Triggers fallback on quota exceeded or other errors
    }
}

/**
 * Computes a match score between a search term and a list of aliases.
 * Returns 0 (no match) to 100 (exact match).
 */
function computeAliasScore(searchTerm: string, aliasesRaw: string): number {
    const normalizedSearch = normalizeSearchTerm(searchTerm);
    if (!normalizedSearch) return 0;

    const aliases = aliasesRaw.split(',').map(a => normalizeSearchTerm(a.trim())).filter(Boolean);
    let bestScore = 0;

    for (const alias of aliases) {
        // Exact match
        if (alias === normalizedSearch) return 100;

        // Search is contained in alias (e.g., "boni" matches "rtuboni")
        if (alias.includes(normalizedSearch)) {
            const score = 70 + (normalizedSearch.length / alias.length) * 25;
            bestScore = Math.max(bestScore, score);
        }

        // Alias is contained in search (e.g., "rtuboni" matches "boni")
        if (normalizedSearch.includes(alias)) {
            const score = 60 + (alias.length / normalizedSearch.length) * 25;
            bestScore = Math.max(bestScore, score);
        }

        // Token overlap (e.g., "sm bicutan" → tokens ["sm", "bicutan"])
        const searchTokens = normalizedSearch.replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/);
        const aliasTokens = alias.replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/);
        const overlap = searchTokens.filter(t => aliasTokens.some(a => a.includes(t) || t.includes(a)));
        if (overlap.length > 0) {
            const tokenScore = 40 + (overlap.length / Math.max(searchTokens.length, aliasTokens.length)) * 30;
            bestScore = Math.max(bestScore, tokenScore);
        }
    }

    return bestScore;
}

const MATCH_THRESHOLD = 45; // Minimum score to consider a match

/**
 * Parses a single sheet row into a CommuteResponse
 */
function parseRouteRow(row: any[]): CommuteResponse | null {
    const steps: CommuteStep[] = [];
    for (let i = 2; i <= 5; i++) {
        const stepText = String(row[i] || '').trim();
        if (!stepText) continue;

        const match = stepText.match(/^([A-Z]+):\s*([\s\S]+)$/);
        let type: CommuteStep['type'] = 'WALK';
        let instruction = stepText;

        if (match) {
            const parsedType = match[1];
            instruction = match[2];
            const validation = CommuteStepSchema.shape.type.safeParse(parsedType);
            if (validation.success) {
                type = validation.data;
            }
        }

        // Extract fare from instruction text if present (e.g., "~₱30" or "(₱15-20)")
        const fareMatch = instruction.match(/[₱P](\d+(?:-\d+)?)/);
        const fare = fareMatch ? fareMatch[1] : undefined;

        steps.push({ type, instruction, fare });
    }

    if (steps.length === 0) return null;

    const fareRange = String(row[6] || '');
    const durationRange = String(row[7] || '');
    const notes = String(row[8] || '');

    const notices: CommuteNotice[] = [
        { type: 'info', message: 'This route is from our community-curated guide, verified by RTU commuters.' }
    ];

    if (notes) {
        notices.push({ type: 'info', message: notes });
    }

    const originLabel = String(row[0] || '').split(',')[0].trim();
    const destLabel = String(row[1] || '').split(',')[0].trim();

    return {
        status: 'fallback',
        provider: 'curated',
        summary: {
            fareEstimateRange: fareRange || undefined,
            totalDurationMins: durationRange ? parseInt(durationRange, 10) : undefined,
        },
        steps,
        notices,
        externalUrl: generateGoogleMapsUrl(originLabel, destLabel),
    };
}

/**
 * Strategy 2: Curated Google Sheets with fuzzy matching
 */
async function getCuratedRoute(origin: string, destination: string): Promise<CommuteResponse | null> {
    if (!ACTUAL_SHEETS_ID) {
        console.error('[Commute] No Commuter Sheets ID provided for fallback.');
        return null;
    }

    try {
        const rows = await getSheetData(ACTUAL_SHEETS_ID, "'Commuter Routes'!A2:J");
        
        if (!rows || rows.length === 0) {
            return null;
        }

        // Score every visible row and pick the best match
        type ScoredRoute = { score: number; row: any[] };
        const scored: ScoredRoute[] = [];

        for (const row of rows) {
            const isVisible = String(row[9] || 'true').toLowerCase() === 'true';
            if (!isVisible) continue;

            const originScore = computeAliasScore(origin, String(row[0] || ''));
            const destScore = computeAliasScore(destination, String(row[1] || ''));

            // Both origin AND destination must clear the threshold
            if (originScore >= MATCH_THRESHOLD && destScore >= MATCH_THRESHOLD) {
                scored.push({ score: originScore + destScore, row });
            }
        }

        // Sort by combined score descending
        scored.sort((a, b) => b.score - a.score);

        if (scored.length > 0) {
            const bestRow = scored[0].row;
            return parseRouteRow(bestRow);
        }

        return null;

    } catch (error) {
        console.error('[Commute] Curated Sheets provider failed:', error);
        return null;
    }
}

/**
 * Orchestrator: Tries Google (with caching), falls back to Curated Sheet
 */
export async function resolveCommuteRoute(origin: string, destination: string): Promise<CommuteResponse> {
    const cacheKey = `commute:${normalizeSearchTerm(origin)}:${normalizeSearchTerm(destination)}`;
    
    // 1. Check Cache (Google only)
    try {
        const cachedRoute = await redis.get<CommuteResponse>(cacheKey);
        if (cachedRoute) {
            // Re-inject time-sensitive notices dynamically
            cachedRoute.notices = cachedRoute.notices.filter(n => !n.message.includes("late!"));
            if (isLateNight()) {
                cachedRoute.notices.push({
                    type: 'warning',
                    message: "⚠️ It's late! MRT/LRT services close around 10 PM. Some jeepney routes may be unavailable."
                });
            }
            return cachedRoute;
        }
    } catch (error) {
        console.warn('[Commute] Redis cache read failed:', error);
    }

    // 2. Try Google Directions
    let route = await getGoogleDirections(origin, destination);

    if (route) {
        // Cache successful Google results
        try {
            await redis.set(cacheKey, route, { ex: CACHE_TTL_SECONDS });
        } catch (error) {
            console.warn('[Commute] Redis cache write failed:', error);
        }
    } else {
        // 3. Try Curated Fallback if Google fails or key is missing
        route = await getCuratedRoute(origin, destination);
    }

    // 4. Handle complete failure
    if (!route) {
        return {
            status: 'error',
            provider: 'curated',
            summary: {},
            steps: [],
            notices: [{ type: 'warning', message: 'No routes found. Try adjusting your search terms or using broader landmarks (e.g., "PITX" instead of a specific street).' }],
            externalUrl: generateGoogleMapsUrl(origin, destination),
        };
    }

    // 5. Inject time-sensitive notices
    if (isLateNight() && !route.notices.some(n => n.message.includes("late!"))) {
        route.notices.push({
            type: 'warning',
            message: "⚠️ It's late! MRT/LRT services close around 10 PM. Some jeepney routes may be unavailable."
        });
    }

    return route;
}
