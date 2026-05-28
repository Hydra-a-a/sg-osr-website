import { Client, TravelMode } from '@googlemaps/google-maps-services-js';
import { Redis } from '@upstash/redis';
import { appendSheetData, batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { formatPhtStorageTimestamp } from '@/lib/date-time';
import type {
    CommuteResponse,
    CommuteCoordinate,
    CommuteRouteGeometry,
    CommuteStep,
    CommuteNotice,
    CommuteWaypoint,
    ContributorSubmission,
    ContributorDisplayMode,
    LeaderboardEntry,
    CommuteVoteType,
    CommuteHealthStatus,
    RouteIssue,
    RouteModerationAction,
    RouteModerationStatus,
} from '@/schemas/commute';
import { CommuteStepSchema } from '@/schemas/commute';

const redis = Redis.fromEnv();
const CACHE_TTL_SECONDS = 86400;

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CURATED_SHEETS_ID = process.env.COMMUTER_MAPS_SHEET_ID;
const ACTUAL_SHEETS_ID = CURATED_SHEETS_ID || process.env.GOOGLE_SHEETS_INFO_ID;
const COMMUTE_GEOCODER_ENDPOINT = String(process.env.COMMUTE_GEOCODER_ENDPOINT || 'https://nominatim.openstreetmap.org/search').trim();
const COMMUTE_GEOCODER_USER_AGENT = String(process.env.COMMUTE_GEOCODER_USER_AGENT || 'RTU-OSR-Commute-Map/1.0').trim();
const COMMUTE_GEOCODER_REGION_HINT = String(process.env.COMMUTE_GEOCODER_REGION_HINT || 'Metro Manila, Philippines').trim();

const COMMUTE_TAB = 'Commuter Routes';
const COMMUTE_RANGE = "'Commuter Routes'!A2:AA";
const COMMUTE_APPEND_RANGE = "'Commuter Routes'!A:AA";

const COL_VISIBLE = 9;
const COL_CONTRIBUTOR_NAME = 10;
const COL_CONTRIBUTOR_STUDENT_ID = 11;
const COL_UPVOTES = 12;
const COL_DOWNVOTES = 13;
const COL_DISPLAY_MODE = 14;
const COL_PUBLIC_LABEL = 15;
const COL_REVIEW_STATUS = 16;
const COL_REVIEWED_BY = 17;
const COL_REVIEWED_AT = 18;
const COL_REVIEW_NOTES = 19;
const COL_SUBMITTED_AT = 20;
const COL_ORIGIN_LAT = 21;
const COL_ORIGIN_LNG = 22;
const COL_DESTINATION_LAT = 23;
const COL_DESTINATION_LNG = 24;
const COL_STOP_POINTS_JSON = 25;
const COL_ROUTE_GEOMETRY_JSON = 26;

const MATCH_THRESHOLD = 45;
const COORDINATE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

const mapsClient = new Client({});

interface CuratedRouteRow {
    rowNumber: number;
    row: string[];
    visible: boolean;
    reviewStatus: string;
    contributorName: string;
    contributorStudentId: string;
    contributorDisplayMode?: ContributorDisplayMode;
    contributorDisplayLabel?: string;
    upvotes: number;
    downvotes: number;
    reviewNotes: string;
    submittedAt: string;
    reviewedAt: string;
    reviewedBy: string;
}

interface RouteHealthSummary {
    healthStatus: CommuteHealthStatus;
    healthReason?: string;
    reviewBadgeLabel?: string;
    lastReviewedAt?: string;
    needsReview: boolean;
}

interface SubmissionSimilarityMatch {
    rowNumber: number;
    similarityReason: string;
}

function getCommuteSpreadsheetId(): string {
    const spreadsheetId = String(ACTUAL_SHEETS_ID || '').trim();
    if (!spreadsheetId) {
        throw new Error('COMMUTER_MAPS_SHEET_ID or GOOGLE_SHEETS_INFO_ID must be configured.');
    }
    return spreadsheetId;
}

function normalizeSearchTerm(term: string): string {
    return term.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toSafeInt(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toSafeFloat(value: unknown): number | undefined {
    const parsed = Number.parseFloat(String(value ?? '').trim());
    return Number.isFinite(parsed) ? parsed : undefined;
}

function toBooleanFlag(value: unknown, fallback = false): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return fallback;
    return ['true', '1', 'yes', 'y'].includes(normalized);
}

function normalizeReviewStatus(value: unknown): string {
    const normalized = String(value ?? '').trim();
    return normalized || 'Pending';
}

function normalizeStatusForComparison(value: string): string {
    return value.trim().toLowerCase();
}

function parseTimestampToDate(value: string): Date | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const normalized = raw.replace(' PHT', '+08:00').replace(' ', 'T');
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function toContributorDisplayMode(value: unknown): ContributorDisplayMode | undefined {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'nickname' || normalized === 'real_name' || normalized === 'masked') {
        return normalized;
    }
    return undefined;
}

function buildContributorDisplayLabel(
    contributorName: string,
    contributorStudentId: string,
    mode: ContributorDisplayMode | undefined,
    rawPublicLabel: string,
): string | undefined {
    if (mode === 'real_name') {
        return contributorName || undefined;
    }

    if (mode === 'nickname') {
        return rawPublicLabel || contributorName || undefined;
    }

    if (mode === 'masked') {
        const compact = contributorStudentId.replace(/\s+/g, '');
        if (compact.length >= 4) {
            return `student-${compact.slice(-4)}`;
        }
        return rawPublicLabel || 'verified-student';
    }

    return rawPublicLabel || contributorName || undefined;
}

function buildGeocoderQuery(label: string): string {
    const normalized = String(label || '').trim();
    if (!normalized) {
        return '';
    }

    if (/philippines|metro manila|mandaluyong|pasig|manila|quezon city/i.test(normalized)) {
        return normalized;
    }

    return `${normalized}, ${COMMUTE_GEOCODER_REGION_HINT}`;
}

function buildCoordinate(label: string, latValue: unknown, lngValue: unknown): CommuteCoordinate | undefined {
    const lat = toSafeFloat(latValue);
    const lng = toSafeFloat(lngValue);

    if (lat === undefined || lng === undefined) {
        return undefined;
    }

    return {
        lat,
        lng,
        label: label || undefined,
    };
}

function parseWaypointArray(raw: string): CommuteWaypoint[] | undefined {
    const value = String(raw || '').trim();
    if (!value) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return undefined;
        }

        const waypoints = parsed.flatMap((item: unknown, index) => {
            if (!item || typeof item !== 'object') {
                return [];
            }

            const record = item as Record<string, unknown>;
            const lat = toSafeFloat(record.lat);
            const lng = toSafeFloat(record.lng);
            if (lat === undefined || lng === undefined) {
                return [];
            }

            return [{
                lat,
                lng,
                label: String(record.label || '').trim() || undefined,
                stepIndex: Number.isInteger(record.stepIndex) ? Number(record.stepIndex) : index,
            }];
        });

        return waypoints.length ? waypoints : undefined;
    } catch {
        return undefined;
    }
}

function parseRouteGeometry(raw: string): CommuteRouteGeometry | undefined {
    const value = String(raw || '').trim();
    if (!value) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(value);

        if (parsed?.type === 'LineString' && Array.isArray(parsed.coordinates)) {
            const coordinates = parsed.coordinates.flatMap((item: unknown) => {
                if (!Array.isArray(item) || item.length < 2) {
                    return [];
                }

                const lng = toSafeFloat(item[0]);
                const lat = toSafeFloat(item[1]);
                if (lng === undefined || lat === undefined) {
                    return [];
                }

                return [[lng, lat] as [number, number]];
            });

            if (coordinates.length >= 2) {
                return {
                    type: 'LineString',
                    coordinates,
                };
            }
        }

        if (Array.isArray(parsed)) {
            const coordinates = parsed.flatMap((item: unknown) => {
                if (!item || typeof item !== 'object') {
                    return [];
                }

                const record = item as Record<string, unknown>;
                const lat = toSafeFloat(record.lat);
                const lng = toSafeFloat(record.lng);
                if (lat === undefined || lng === undefined) {
                    return [];
                }

                return [[lng, lat] as [number, number]];
            });

            if (coordinates.length >= 2) {
                return {
                    type: 'LineString',
                    coordinates,
                };
            }
        }
    } catch {
    }

    return undefined;
}

function decodePolyline(encoded: string): CommuteRouteGeometry | undefined {
    const polyline = String(encoded || '').trim();
    if (!polyline) {
        return undefined;
    }

    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: Array<[number, number]> = [];

    while (index < polyline.length) {
        let shift = 0;
        let result = 0;
        let byte = 0;

        do {
            byte = polyline.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20 && index < polyline.length + 1);

        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        shift = 0;
        result = 0;

        do {
            byte = polyline.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20 && index < polyline.length + 1);

        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += deltaLng;

        coordinates.push([lng / 1e5, lat / 1e5]);
    }

    if (coordinates.length < 2) {
        return undefined;
    }

    return {
        type: 'LineString',
        coordinates,
    };
}

function buildFallbackGeometry(
    originCoordinate?: CommuteCoordinate,
    destinationCoordinate?: CommuteCoordinate,
    waypoints?: CommuteWaypoint[],
): CommuteRouteGeometry | undefined {
    const coordinates: Array<[number, number]> = [];

    if (originCoordinate) {
        coordinates.push([originCoordinate.lng, originCoordinate.lat]);
    }

    for (const waypoint of waypoints || []) {
        coordinates.push([waypoint.lng, waypoint.lat]);
    }

    if (destinationCoordinate) {
        coordinates.push([destinationCoordinate.lng, destinationCoordinate.lat]);
    }

    if (coordinates.length < 2) {
        return undefined;
    }

    return {
        type: 'LineString',
        coordinates,
    };
}

function extractStopLabels(steps: CommuteStep[]): string[] {
    const labels = new Set<string>();
    const patterns = [
        /\b(?:to|toward|towards)\s+([A-Z][A-Za-z0-9\s\-().,&]{2,})/i,
        /\b(?:at|from|drop off at|get off at|exit at)\s+([A-Z][A-Za-z0-9\s\-().,&]{2,})/i,
    ];

    for (const step of steps) {
        if (step.type === 'WALK') {
            continue;
        }

        const instruction = String(step.instruction || '').trim();
        if (!instruction) {
            continue;
        }

        for (const pattern of patterns) {
            const match = instruction.match(pattern);
            const label = String(match?.[1] || '')
                .split(/(?:via|then|and then|,)/i)[0]
                .trim();

            if (label.length >= 3) {
                labels.add(label);
                break;
            }
        }
    }

    return [...labels].slice(0, 3);
}

async function geocodeCoordinate(label: string): Promise<CommuteCoordinate | undefined> {
    const query = buildGeocoderQuery(label);
    if (!query || !COMMUTE_GEOCODER_ENDPOINT) {
        return undefined;
    }

    const cacheKey = `commute:geocode:${normalizeSearchTerm(query)}`;

    try {
        const cached = await redis.get<CommuteCoordinate>(cacheKey);
        if (cached?.lat !== undefined && cached?.lng !== undefined) {
            return {
                ...cached,
                label: cached.label || label,
            };
        }
    } catch (error) {
        console.warn('[Commute] Redis geocode cache read failed:', error);
    }

    try {
        const url = new URL(COMMUTE_GEOCODER_ENDPOINT);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        url.searchParams.set('countrycodes', 'ph');

        const response = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': COMMUTE_GEOCODER_USER_AGENT,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return undefined;
        }

        const data = await response.json() as Array<Record<string, string>>;
        const match = data[0];
        const coordinate = buildCoordinate(
            label,
            match?.lat,
            match?.lon,
        );

        if (!coordinate) {
            return undefined;
        }

        try {
            await redis.set(cacheKey, coordinate, { ex: COORDINATE_CACHE_TTL_SECONDS });
        } catch (error) {
            console.warn('[Commute] Redis geocode cache write failed:', error);
        }

        return coordinate;
    } catch (error) {
        console.warn('[Commute] External geocoder failed:', error);
        return undefined;
    }
}

async function resolveRouteMapData(route: CommuteResponse, origin: string, destination: string): Promise<CommuteResponse> {
    if (route.status === 'error') {
        return route;
    }

    const nextRoute: CommuteResponse = { ...route };
    nextRoute.originCoordinate = nextRoute.originCoordinate || await geocodeCoordinate(origin);
    nextRoute.destinationCoordinate = nextRoute.destinationCoordinate || await geocodeCoordinate(destination);

    if ((!nextRoute.waypoints || !nextRoute.waypoints.length) && nextRoute.provider === 'curated') {
        const waypointLabels = extractStopLabels(nextRoute.steps);
        const waypoints = await Promise.all(waypointLabels.map((label) => geocodeCoordinate(label)));
        nextRoute.waypoints = waypoints.flatMap((waypoint, index) =>
            waypoint ? [{ ...waypoint, stepIndex: index }] : []
        );
    }

    nextRoute.routeGeometry = nextRoute.routeGeometry || buildFallbackGeometry(
        nextRoute.originCoordinate,
        nextRoute.destinationCoordinate,
        nextRoute.waypoints,
    );

    return nextRoute;
}

function deriveRouteHealth(route: CuratedRouteRow): RouteHealthSummary {
    const reviewStatus = normalizeStatusForComparison(route.reviewStatus);
    const referenceDate = parseTimestampToDate(route.reviewedAt) || parseTimestampToDate(route.submittedAt);
    const ageDays = referenceDate
        ? Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    if (reviewStatus === 'flagged for review') {
        return {
            healthStatus: 'flagged',
            healthReason: route.reviewNotes || 'Community feedback suggests this route may need another officer review.',
            reviewBadgeLabel: 'Needs review',
            lastReviewedAt: route.reviewedAt || undefined,
            needsReview: true,
        };
    }

    if (reviewStatus === 'approved with warning') {
        return {
            healthStatus: 'flagged',
            healthReason: route.reviewNotes || 'Approved with caution while officers monitor this route.',
            reviewBadgeLabel: 'Approved with warning',
            lastReviewedAt: route.reviewedAt || undefined,
            needsReview: true,
        };
    }

    if (route.downvotes >= 4 && route.downvotes > route.upvotes) {
        return {
            healthStatus: 'flagged',
            healthReason: 'Multiple commuters reported that this route may need an update.',
            reviewBadgeLabel: 'Needs review',
            lastReviewedAt: route.reviewedAt || undefined,
            needsReview: true,
        };
    }

    if (ageDays >= 120) {
        return {
            healthStatus: 'aging',
            healthReason: 'This curated route has not been reviewed in a while.',
            reviewBadgeLabel: 'Aging guide',
            lastReviewedAt: route.reviewedAt || route.submittedAt || undefined,
            needsReview: false,
        };
    }

    return {
        healthStatus: 'healthy',
        reviewBadgeLabel: reviewStatus === 'approved' ? 'Community-curated' : undefined,
        lastReviewedAt: route.reviewedAt || undefined,
        needsReview: false,
    };
}

function isLateNight(): boolean {
    const manilaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const hours = manilaTime.getHours();
    return hours >= 21 || hours < 4;
}

function generateGoogleMapsUrl(origin: string, destination: string): string {
    const baseUrl = 'https://www.google.com/maps/dir/?api=1';
    return `${baseUrl}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
}

async function getGoogleDirections(origin: string, destination: string): Promise<CommuteResponse | null> {
    if (!MAPS_API_KEY) {
        console.log('[Commute] Missing GOOGLE_MAPS_API_KEY, skipping Google provider.');
        return null;
    }

    try {
        const response = await mapsClient.directions({
            params: {
                origin,
                destination,
                mode: TravelMode.transit,
                key: MAPS_API_KEY,
                region: 'ph',
            },
        });

        if (response.data.status !== 'OK' || !response.data.routes.length) {
            console.warn('[Commute] Google Maps returned no routes or error:', response.data.status);
            return null;
        }

        const route = response.data.routes[0];
        const leg = route.legs[0];

        const steps: CommuteStep[] = leg.steps.map((step) => {
            let type: CommuteStep['type'] = 'WALK';
            let colorCode: string | undefined;

            if (step.travel_mode === TravelMode.transit && step.transit_details) {
                const transitType = step.transit_details.line.vehicle.type;
                if (transitType === 'BUS' || transitType === 'INTERCITY_BUS') type = 'BUS';
                else if (transitType === 'HEAVY_RAIL' || transitType === 'COMMUTER_TRAIN' || transitType === 'SUBWAY') type = 'MRT';
                else if (transitType === 'SHARE_TAXI') type = 'UV';
                else type = 'JEEP';

                colorCode = step.transit_details.line.color;
            }

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
        const originCoordinate = buildCoordinate(
            leg.start_address || origin,
            leg.start_location?.lat,
            leg.start_location?.lng,
        );
        const destinationCoordinate = buildCoordinate(
            leg.end_address || destination,
            leg.end_location?.lat,
            leg.end_location?.lng,
        );
        const routeGeometry = decodePolyline(String(route.overview_polyline?.points || ''));

        return {
            status: 'success',
            provider: 'google',
            summary: {
                totalDurationMins: Math.ceil((leg.duration?.value || 0) / 60),
                totalDistanceKm: Number((leg.distance?.value || 0) / 1000),
                fareEstimateRange: fareEstimate,
            },
            steps,
            notices: [],
            originCoordinate,
            destinationCoordinate,
            routeGeometry,
            externalUrl: generateGoogleMapsUrl(origin, destination),
        };
    } catch (error) {
        console.error('[Commute] Google Directions API failed:', error);
        return null;
    }
}

function computeAliasScore(searchTerm: string, aliasesRaw: string): number {
    const normalizedSearch = normalizeSearchTerm(searchTerm);
    if (!normalizedSearch) return 0;

    const aliases = aliasesRaw.split(',').map((alias) => normalizeSearchTerm(alias.trim())).filter(Boolean);
    let bestScore = 0;

    for (const alias of aliases) {
        if (alias === normalizedSearch) return 100;

        if (alias.includes(normalizedSearch)) {
            const score = 70 + (normalizedSearch.length / alias.length) * 25;
            bestScore = Math.max(bestScore, score);
        }

        if (normalizedSearch.includes(alias)) {
            const score = 60 + (alias.length / normalizedSearch.length) * 25;
            bestScore = Math.max(bestScore, score);
        }

        const searchTokens = normalizedSearch.replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/);
        const aliasTokens = alias.replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/);
        const overlap = searchTokens.filter((token) => aliasTokens.some((aliasToken) => aliasToken.includes(token) || token.includes(aliasToken)));
        if (overlap.length > 0) {
            const tokenScore = 40 + (overlap.length / Math.max(searchTokens.length, aliasTokens.length)) * 30;
            bestScore = Math.max(bestScore, tokenScore);
        }
    }

    return bestScore;
}

function mapCuratedRouteRow(row: string[], rowNumber: number): CuratedRouteRow {
    const contributorName = String(row[COL_CONTRIBUTOR_NAME] || '').trim();
    const contributorStudentId = String(row[COL_CONTRIBUTOR_STUDENT_ID] || '').trim();
    const contributorDisplayMode = toContributorDisplayMode(row[COL_DISPLAY_MODE]);
    const contributorDisplayLabel = buildContributorDisplayLabel(
        contributorName,
        contributorStudentId,
        contributorDisplayMode,
        String(row[COL_PUBLIC_LABEL] || '').trim(),
    );

    return {
        rowNumber,
        row,
        visible: toBooleanFlag(row[COL_VISIBLE], true),
        reviewStatus: normalizeReviewStatus(row[COL_REVIEW_STATUS]),
        contributorName,
        contributorStudentId,
        contributorDisplayMode,
        contributorDisplayLabel,
        upvotes: toSafeInt(row[COL_UPVOTES]),
        downvotes: toSafeInt(row[COL_DOWNVOTES]),
        reviewNotes: String(row[COL_REVIEW_NOTES] || '').trim(),
        submittedAt: String(row[COL_SUBMITTED_AT] || '').trim(),
        reviewedAt: String(row[COL_REVIEWED_AT] || '').trim(),
        reviewedBy: String(row[COL_REVIEWED_BY] || '').trim(),
    };
}

function parseCuratedRoute(route: CuratedRouteRow): CommuteResponse | null {
    const health = deriveRouteHealth(route);
    const steps: CommuteStep[] = [];
    for (let i = 2; i <= 5; i += 1) {
        const stepText = String(route.row[i] || '').trim();
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

        const fareMatch = instruction.match(/[₱P](\d+(?:-\d+)?)/);
        const fare = fareMatch ? fareMatch[1] : undefined;
        steps.push({ type, instruction, fare });
    }

    if (!steps.length) {
        return null;
    }

    const fareRange = String(route.row[6] || '').trim();
    const durationRange = String(route.row[7] || '').trim();
    const notes = String(route.row[8] || '').trim();

    const notices: CommuteNotice[] = [
        { type: 'info', message: 'This route is from our community-curated guide, verified by RTU commuters.' },
    ];

    if (health.healthStatus === 'flagged' && health.healthReason) {
        notices.push({ type: 'warning', message: health.healthReason });
    } else if (health.healthStatus === 'aging' && health.healthReason) {
        notices.push({ type: 'warning', message: health.healthReason });
    }

    if (notes) {
        notices.push({ type: 'info', message: notes });
    }

    if (route.reviewNotes && route.reviewStatus === 'Approved') {
        notices.push({ type: 'info', message: route.reviewNotes });
    }

    const originLabel = String(route.row[0] || '').split(',')[0].trim();
    const destLabel = String(route.row[1] || '').split(',')[0].trim();
    const originCoordinate = buildCoordinate(originLabel, route.row[COL_ORIGIN_LAT], route.row[COL_ORIGIN_LNG]);
    const destinationCoordinate = buildCoordinate(destLabel, route.row[COL_DESTINATION_LAT], route.row[COL_DESTINATION_LNG]);
    const waypoints = parseWaypointArray(String(route.row[COL_STOP_POINTS_JSON] || ''));
    const routeGeometry = parseRouteGeometry(String(route.row[COL_ROUTE_GEOMETRY_JSON] || ''))
        || buildFallbackGeometry(originCoordinate, destinationCoordinate, waypoints);

    return {
        status: 'fallback',
        provider: 'curated',
        summary: {
            fareEstimateRange: fareRange || undefined,
            totalDurationMins: durationRange ? toSafeInt(durationRange) : undefined,
        },
        steps,
        notices,
        rowNumber: route.rowNumber,
        contributorDisplayLabel: route.contributorDisplayLabel,
        contributorDisplayMode: route.contributorDisplayMode,
        upvotes: route.upvotes,
        downvotes: route.downvotes,
        healthStatus: health.healthStatus,
        healthReason: health.healthReason,
        lastReviewedAt: health.lastReviewedAt,
        reviewBadgeLabel: health.reviewBadgeLabel,
        originCoordinate,
        destinationCoordinate,
        waypoints,
        routeGeometry,
        externalUrl: generateGoogleMapsUrl(originLabel, destLabel),
    };
}

async function listCuratedRouteRows(): Promise<CuratedRouteRow[]> {
    const spreadsheetId = getCommuteSpreadsheetId();
    const rows = await getSheetData(spreadsheetId, COMMUTE_RANGE);
    return rows.map((row, index) => mapCuratedRouteRow(row.map((cell) => String(cell ?? '')), index + 2));
}

async function getCuratedRoute(origin: string, destination: string): Promise<CommuteResponse | null> {
    try {
        const routes = await listCuratedRouteRows();
        const scored: Array<{ score: number; route: CuratedRouteRow }> = [];
        const weakScored: Array<{ score: number; route: CuratedRouteRow }> = [];

        for (const route of routes) {
            if (!route.visible) continue;
            if (normalizeStatusForComparison(route.reviewStatus) === 'rejected') continue;

            const originScore = computeAliasScore(origin, String(route.row[0] || ''));
            const destScore = computeAliasScore(destination, String(route.row[1] || ''));
            if (originScore >= MATCH_THRESHOLD && destScore >= MATCH_THRESHOLD) {
                scored.push({ score: originScore + destScore, route });
            } else if (originScore >= 25 && destScore >= 25) {
                weakScored.push({ score: originScore + destScore, route });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        if (scored.length) {
            return parseCuratedRoute(scored[0].route);
        }

        weakScored.sort((a, b) => b.score - a.score);
        if (weakScored.length) {
            const parsed = parseCuratedRoute(weakScored[0].route);
            if (parsed) {
                parsed.notices.unshift({
                    type: 'warning',
                    message: 'We found a nearby community route, but the match is weaker than usual. Double-check the route details before you travel.',
                });
            }
            return parsed;
        }

        return null;
    } catch (error) {
        console.error('[Commute] Curated Sheets provider failed:', error);
        return null;
    }
}

export async function resolveCommuteRoute(origin: string, destination: string): Promise<CommuteResponse> {
    const cacheKey = `commute:${normalizeSearchTerm(origin)}:${normalizeSearchTerm(destination)}`;

    try {
        const cachedRoute = await redis.get<CommuteResponse>(cacheKey);
        if (cachedRoute) {
            cachedRoute.notices = cachedRoute.notices.filter((notice) => !notice.message.includes('late!'));
            if (isLateNight()) {
                cachedRoute.notices.push({
                    type: 'warning',
                    message: "It's late! MRT/LRT services close around 10 PM. Some jeepney routes may be unavailable.",
                });
            }
            return cachedRoute;
        }
    } catch (error) {
        console.warn('[Commute] Redis cache read failed:', error);
    }

    let route = await getGoogleDirections(origin, destination);

    if (route) {
        route.notices = route.notices || [];
        route.notices.unshift({
            type: 'info',
            message: 'This result came from Google transit data instead of the community-curated route sheet.',
        });
    } else {
        route = await getCuratedRoute(origin, destination);
    }

    if (!route) {
        return {
            status: 'error',
            provider: 'curated',
            summary: {},
            steps: [],
            notices: [{ type: 'warning', message: 'No community-curated route matched your search. Try broader landmarks or fall back to Google Maps for live transit guidance.' }],
            externalUrl: generateGoogleMapsUrl(origin, destination),
        };
    }

    route = await resolveRouteMapData(route, origin, destination);

    if (isLateNight() && !route.notices.some((notice) => notice.message.includes('late!'))) {
        route.notices.push({
            type: 'warning',
            message: "It's late! MRT/LRT services close around 10 PM. Some jeepney routes may be unavailable.",
        });
    }

    try {
        await redis.set(cacheKey, route, { ex: CACHE_TTL_SECONDS });
    } catch (error) {
        console.warn('[Commute] Redis cache write failed:', error);
    }

    return route;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    const routes = await listCuratedRouteRows();
    const visibleRoutes = routes.filter((route) => route.visible && route.reviewStatus.toLowerCase() === 'approved');
    const grouped = new Map<string, Omit<LeaderboardEntry, 'rank'>>();

    for (const route of visibleRoutes) {
        const contributorKey = route.contributorStudentId || route.contributorName || `row-${route.rowNumber}`;
        const displayLabel = route.contributorDisplayLabel || route.contributorName || 'community-guide';
        const existing = grouped.get(contributorKey) || {
            contributorKey,
            displayLabel,
            approvedRoutes: 0,
            upvotes: 0,
            downvotes: 0,
            points: 0,
        };

        existing.approvedRoutes += 1;
        existing.upvotes += route.upvotes;
        existing.downvotes += route.downvotes;
        existing.points = (existing.approvedRoutes * 100) + (existing.upvotes * 10) - (existing.downvotes * 5);
        grouped.set(contributorKey, existing);
    }

    return [...grouped.values()]
        .sort((a, b) => b.points - a.points || b.upvotes - a.upvotes || a.displayLabel.localeCompare(b.displayLabel))
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildContributorPublicLabel(submission: ContributorSubmission): string {
    const custom = String(submission.contributorPublicLabel || '').trim();
    if (submission.contributorDisplayMode === 'real_name') {
        return submission.contributorName;
    }
    if (submission.contributorDisplayMode === 'nickname') {
        return custom || submission.contributorName;
    }

    const compact = submission.contributorStudentId.replace(/\s+/g, '');
    if (compact.length >= 4) {
        return `student-${compact.slice(-4)}`;
    }
    return custom || 'verified-student';
}

function stepsLookSimilar(existingSteps: string[], incomingSteps: string[]): boolean {
    const existing = existingSteps.map((step) => normalizeSearchTerm(step)).filter(Boolean);
    const incoming = incomingSteps.map((step) => normalizeSearchTerm(step)).filter(Boolean);
    if (!existing.length || !incoming.length) return false;

    const overlap = incoming.filter((step) => existing.includes(step)).length;
    return overlap >= Math.min(existing.length, incoming.length, 2);
}

function findSimilarSubmission(
    submission: ContributorSubmission,
    routes: CuratedRouteRow[],
): SubmissionSimilarityMatch | null {
    const incomingOrigin = normalizeSearchTerm(submission.origin);
    const incomingDestination = normalizeSearchTerm(submission.destination);
    const incomingSteps = submission.steps.map((step) => `${step.type}:${step.instruction}`);

    for (const route of routes) {
        if (normalizeSearchTerm(route.contributorStudentId) !== normalizeSearchTerm(submission.contributorStudentId)) {
            continue;
        }

        const sameOrigin = computeAliasScore(incomingOrigin, String(route.row[0] || '')) >= 85;
        const sameDestination = computeAliasScore(incomingDestination, String(route.row[1] || '')) >= 85;
        const similarSteps = stepsLookSimilar(
            [2, 3, 4, 5].map((index) => String(route.row[index] || '')).filter(Boolean),
            incomingSteps,
        );

        if (sameOrigin && sameDestination && similarSteps) {
            return {
                rowNumber: route.rowNumber,
                similarityReason: 'This looks very similar to a route you already submitted recently.',
            };
        }
    }

    return null;
}

export async function submitCommunityRoute(submission: ContributorSubmission): Promise<{
    kind: 'created' | 'duplicate';
    rowNumber: number | null;
    publicLabel: string;
    duplicateOfRowNumber?: number;
    similarityReason?: string;
}> {
    const spreadsheetId = getCommuteSpreadsheetId();
    const publicLabel = buildContributorPublicLabel(submission);
    const existingRoutes = await listCuratedRouteRows();
    const duplicate = findSimilarSubmission(submission, existingRoutes);

    if (duplicate) {
        return {
            kind: 'duplicate',
            rowNumber: null,
            publicLabel,
            duplicateOfRowNumber: duplicate.rowNumber,
            similarityReason: duplicate.similarityReason,
        };
    }

    const values = [[
        submission.origin,
        submission.destination,
        ...Array.from({ length: 4 }, (_, index) => {
            const step = submission.steps[index];
            return step ? `${step.type}: ${step.instruction}` : '';
        }),
        submission.fareEstimateRange || '',
        submission.durationMinutes ? String(submission.durationMinutes) : '',
        submission.notes || '',
        'FALSE',
        submission.contributorName,
        submission.contributorStudentId,
        '0',
        '0',
        submission.contributorDisplayMode,
        publicLabel,
        'Pending',
        '',
        '',
        '',
        formatPhtStorageTimestamp(new Date()),
        '',
        '',
        '',
        '',
        '',
        '',
    ]];

    const appendResult = await appendSheetData(spreadsheetId, COMMUTE_APPEND_RANGE, values);
    const updatedRange = (appendResult as { updates?: { updatedRange?: string } })?.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/!A(\d+):/i) || updatedRange.match(/!A(\d+)$/i);
    const rowNumber = rowMatch?.[1] ? Number.parseInt(rowMatch[1], 10) : null;

    return { kind: 'created', rowNumber, publicLabel };
}

async function getCuratedRouteRowByNumber(rowNumber: number): Promise<CuratedRouteRow | null> {
    const routes = await listCuratedRouteRows();
    return routes.find((route) => route.rowNumber === rowNumber) || null;
}

export async function castRouteVote(rowNumber: number, voteType: CommuteVoteType): Promise<{ upvotes: number; downvotes: number; healthStatus: CommuteHealthStatus }> {
    const spreadsheetId = getCommuteSpreadsheetId();
    const route = await getCuratedRouteRowByNumber(rowNumber);
    if (!route) {
        throw new Error('INVALID_VOTE_TARGET');
    }

    const status = normalizeStatusForComparison(route.reviewStatus);
    if (!route.visible || status === 'pending' || status === 'rejected') {
        throw new Error('INVALID_VOTE_TARGET');
    }

    const upvotes = route.upvotes;
    const downvotes = route.downvotes;

    const nextUpvotes = voteType === 'UPVOTE' ? upvotes + 1 : upvotes;
    const nextDownvotes = voteType === 'DOWNVOTE' ? downvotes + 1 : downvotes;

    await batchUpdateSheetData(spreadsheetId, [
        { range: `'${COMMUTE_TAB}'!M${rowNumber}:M${rowNumber}`, values: [[String(nextUpvotes)]] },
        { range: `'${COMMUTE_TAB}'!N${rowNumber}:N${rowNumber}`, values: [[String(nextDownvotes)]] },
    ]);

    const nextHealth = deriveRouteHealth({
        ...route,
        upvotes: nextUpvotes,
        downvotes: nextDownvotes,
    });

    return { upvotes: nextUpvotes, downvotes: nextDownvotes, healthStatus: nextHealth.healthStatus };
}

export async function listModerationRoutes(): Promise<Array<
    CuratedRouteRow & {
        originAliases: string;
        destinationAliases: string;
        steps: string[];
        fareEstimateRange: string;
        durationMinutes?: number;
        notes: string;
        reviewedBy: string;
        reviewedAt: string;
        healthStatus: CommuteHealthStatus;
        healthReason?: string;
        reviewBadgeLabel?: string;
        reviewReasonSummary?: string;
    }
>> {
    const routes = await listCuratedRouteRows();
    return routes
        .map((route) => ({
            ...route,
            originAliases: String(route.row[0] || '').trim(),
            destinationAliases: String(route.row[1] || '').trim(),
            steps: [2, 3, 4, 5].map((index) => String(route.row[index] || '').trim()).filter(Boolean),
            fareEstimateRange: String(route.row[6] || '').trim(),
            durationMinutes: toSafeInt(route.row[7]) || undefined,
            notes: String(route.row[8] || '').trim(),
            reviewedBy: String(route.row[COL_REVIEWED_BY] || '').trim(),
            reviewedAt: String(route.row[COL_REVIEWED_AT] || '').trim(),
            ...deriveRouteHealth(route),
            reviewReasonSummary: deriveRouteHealth(route).healthReason || route.reviewNotes || '',
        }))
        .sort((a, b) => {
            const aPriority = a.healthStatus === 'flagged' ? 3 : normalizeStatusForComparison(a.reviewStatus) === 'pending' ? 2 : 1;
            const bPriority = b.healthStatus === 'flagged' ? 3 : normalizeStatusForComparison(b.reviewStatus) === 'pending' ? 2 : 1;
            if (aPriority !== bPriority) return bPriority - aPriority;
            if (a.downvotes !== b.downvotes) return b.downvotes - a.downvotes;
            return b.rowNumber - a.rowNumber;
        });
}

export async function updateModerationRoute(
    rowNumber: number,
    action: RouteModerationAction,
    actor: string,
    reviewNotes: string,
): Promise<void> {
    const spreadsheetId = getCommuteSpreadsheetId();
    const now = formatPhtStorageTimestamp(new Date());
    let nextStatus: RouteModerationStatus = 'Pending';
    let nextVisible = 'FALSE';

    if (action === 'Approve' || action === 'Restore Confidence') {
        nextStatus = 'Approved';
        nextVisible = 'TRUE';
    } else if (action === 'Reject') {
        nextStatus = 'Rejected';
        nextVisible = 'FALSE';
    } else if (action === 'Mark for Review') {
        nextStatus = 'Flagged for Review';
        nextVisible = 'TRUE';
    } else if (action === 'Approve with Warning') {
        nextStatus = 'Approved with Warning';
        nextVisible = 'TRUE';
    }

    await batchUpdateSheetData(spreadsheetId, [
        { range: `'${COMMUTE_TAB}'!J${rowNumber}:J${rowNumber}`, values: [[nextVisible]] },
        { range: `'${COMMUTE_TAB}'!Q${rowNumber}:Q${rowNumber}`, values: [[nextStatus]] },
        { range: `'${COMMUTE_TAB}'!R${rowNumber}:R${rowNumber}`, values: [[actor]] },
        { range: `'${COMMUTE_TAB}'!S${rowNumber}:S${rowNumber}`, values: [[now]] },
        { range: `'${COMMUTE_TAB}'!T${rowNumber}:T${rowNumber}`, values: [[reviewNotes]] },
    ]);
}

export async function submitRouteIssue(routeIssue: RouteIssue, reporter: string): Promise<void> {
    const spreadsheetId = getCommuteSpreadsheetId();
    const route = await getCuratedRouteRowByNumber(routeIssue.rowNumber);
    if (!route) {
        throw new Error('ROUTE_NOT_FOUND');
    }

    if (!route.visible || normalizeStatusForComparison(route.reviewStatus) === 'rejected') {
        throw new Error('INVALID_ISSUE_TARGET');
    }

    const now = formatPhtStorageTimestamp(new Date());
    const existingNotes = route.reviewNotes ? `${route.reviewNotes}\n` : '';
    const reportLabel = routeIssue.reportType === 'UPDATE' ? 'Update request' : 'Issue report';
    const nextReviewNotes = `${existingNotes}[${now}] ${reportLabel} from ${reporter}: ${routeIssue.message}`.slice(-1800);

    await batchUpdateSheetData(spreadsheetId, [
        { range: `'${COMMUTE_TAB}'!Q${routeIssue.rowNumber}:Q${routeIssue.rowNumber}`, values: [['Flagged for Review']] },
        { range: `'${COMMUTE_TAB}'!R${routeIssue.rowNumber}:R${routeIssue.rowNumber}`, values: [['Community feedback']] },
        { range: `'${COMMUTE_TAB}'!S${routeIssue.rowNumber}:S${routeIssue.rowNumber}`, values: [[now]] },
        { range: `'${COMMUTE_TAB}'!T${routeIssue.rowNumber}:T${routeIssue.rowNumber}`, values: [[nextReviewNotes]] },
    ]);
}
