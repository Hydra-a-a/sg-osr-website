'use client';

import { useEffect, useRef, useState } from 'react';
import { Compass, MapPinned, Route } from 'lucide-react';
import type { CommuteCoordinate, CommuteResponse, CommuteWaypoint } from '@/schemas/commute';
type MapLibreModule = typeof import('maplibre-gl');
type MapInstance = InstanceType<MapLibreModule['Map']>;
type MarkerInstance = InstanceType<MapLibreModule['Marker']>;

const DEFAULT_COMMUTE_MAP_STYLE_URL = process.env.NEXT_PUBLIC_COMMUTE_MAP_STYLE_URL || '';
const DEFAULT_COMMUTE_MAP_STYLE = DEFAULT_COMMUTE_MAP_STYLE_URL || {
    version: 8,
    sources: {
        'openstreetmap-raster': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
        },
    },
    layers: [
        {
            id: 'osm-raster-base',
            type: 'raster',
            source: 'openstreetmap-raster',
            minzoom: 0,
            maxzoom: 19,
        },
    ],
};
const ROUTE_SOURCE_ID = 'commute-route-geometry';
const ROUTE_LAYER_ID = 'commute-route-line';

interface CommuteMapPanelProps {
    result: CommuteResponse | null;
    origin: string;
    destination: string;
}

interface MapQualityBadge {
    label: 'Full geometry' | 'Line + endpoints' | 'Stops + endpoints' | 'Endpoints only' | 'No mapped data';
    toneClassName: string;
    detail: string;
}

function collectRenderablePoints(result: CommuteResponse | null): Array<CommuteCoordinate | CommuteWaypoint> {
    if (!result) {
        return [];
    }

    return [
        result.originCoordinate,
        ...(result.waypoints || []),
        result.destinationCoordinate,
    ].filter((point): point is CommuteCoordinate | CommuteWaypoint => Boolean(point));
}

function getMapStatusCopy(result: CommuteResponse | null): string {
    if (!result) {
        return 'Search for a route to preview markers and route overlays here.';
    }

    if (result.originCoordinate || result.destinationCoordinate || result.routeGeometry || (result.waypoints || []).length) {
        return result.provider === 'google'
            ? 'Live provider results can render the full route line when geometry is available.'
            : 'Community routes use saved coordinates first, then cached geocoding for missing map points.';
    }

    if (result.status === 'error') {
        return 'We found no route geometry for this search yet, but the textual fallback is still available below.';
    }

    return 'This route is still text-first. Add helper coordinates over time to make the map more exact.';
}

function getMapQualityBadge(result: CommuteResponse | null): MapQualityBadge {
    const hasOrigin = Boolean(result?.originCoordinate);
    const hasDestination = Boolean(result?.destinationCoordinate);
    const waypointCount = result?.waypoints?.length || 0;
    const geometryPoints = result?.routeGeometry?.coordinates?.length || 0;

    if (geometryPoints >= 3 && waypointCount > 0) {
        return {
            label: 'Full geometry',
            toneClassName: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100',
            detail: 'Mapped endpoints, intermediate stops, and a route line are available.',
        };
    }

    if (geometryPoints >= 2 && hasOrigin && hasDestination) {
        return {
            label: 'Line + endpoints',
            toneClassName: 'border-sky-400/25 bg-sky-500/12 text-sky-100',
            detail: 'This route has endpoint markers and a route line, but no mapped stop list yet.',
        };
    }

    if (waypointCount > 0 && (hasOrigin || hasDestination)) {
        return {
            label: 'Stops + endpoints',
            toneClassName: 'border-violet-400/25 bg-violet-500/12 text-violet-100',
            detail: 'Mapped stops are available, but the route line still falls back to point-to-point rendering.',
        };
    }

    if (hasOrigin || hasDestination) {
        return {
            label: 'Endpoints only',
            toneClassName: 'border-amber-400/25 bg-amber-500/12 text-amber-100',
            detail: 'This route currently has endpoint markers only.',
        };
    }

    return {
        label: 'No mapped data',
        toneClassName: 'border-white/12 bg-white/6 text-slate-200',
        detail: 'The route is still text-only until coordinates are added or geocoding succeeds.',
    };
}

export default function CommuteMapPanel({ result, origin, destination }: CommuteMapPanelProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapInstance | null>(null);
    const markerRefs = useRef<MarkerInstance[]>([]);
    const [mapError, setMapError] = useState('');
    const renderablePoints = collectRenderablePoints(result);
    const hasRenderableMap = renderablePoints.length > 0;
    const mapQuality = getMapQualityBadge(result);
    const mapSignature = JSON.stringify({
        originCoordinate: result?.originCoordinate || null,
        destinationCoordinate: result?.destinationCoordinate || null,
        waypoints: result?.waypoints || [],
        routeGeometry: result?.routeGeometry || null,
        provider: result?.provider || null,
    });

    useEffect(() => {
        return () => {
            for (const marker of markerRefs.current) {
                marker.remove();
            }
            markerRefs.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const container = mapContainerRef.current;
        if (!container || !hasRenderableMap || !result) {
            for (const marker of markerRefs.current) {
                marker.remove();
            }
            markerRefs.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
            setMapError('');
            return;
        }

        let cancelled = false;

        const syncMap = async () => {
            try {
                const maplibregl = await import('maplibre-gl');
                if (cancelled || !mapContainerRef.current) {
                    return;
                }

                const activePoints = collectRenderablePoints(result);
                if (!activePoints.length) {
                    return;
                }

                let map = mapRef.current;
                if (!map) {
                    map = new maplibregl.Map({
                        container: mapContainerRef.current,
                        style: DEFAULT_COMMUTE_MAP_STYLE as never,
                        center: [activePoints[0].lng, activePoints[0].lat],
                        zoom: 11,
                        attributionControl: false,
                    });
                    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
                    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
                    mapRef.current = map;
                }

                const activeMap = mapRef.current;
                if (!activeMap) {
                    return;
                }

                const renderScene = () => {
                    for (const marker of markerRefs.current) {
                        marker.remove();
                    }
                    markerRefs.current = [];

                    if (activeMap.getLayer(ROUTE_LAYER_ID)) {
                        activeMap.removeLayer(ROUTE_LAYER_ID);
                    }
                    if (activeMap.getSource(ROUTE_SOURCE_ID)) {
                        activeMap.removeSource(ROUTE_SOURCE_ID);
                    }

                    if (result.routeGeometry?.coordinates?.length) {
                        const lineCoordinates = result.routeGeometry.coordinates.map(
                            ([lng, lat]) => [lng, lat] as [number, number],
                        );

                        activeMap.addSource(ROUTE_SOURCE_ID, {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'LineString',
                                    coordinates: lineCoordinates,
                                },
                            },
                        });
                        activeMap.addLayer({
                            id: ROUTE_LAYER_ID,
                            type: 'line',
                            source: ROUTE_SOURCE_ID,
                            paint: {
                                'line-color': '#fbbf24',
                                'line-width': 5,
                                'line-opacity': 0.9,
                            },
                        });
                    }

                    activePoints.forEach((point, index) => {
                        const markerNode = document.createElement('div');
                        const isEndpoint = index === 0 || index === activePoints.length - 1;
                        markerNode.className = isEndpoint
                            ? 'commute-map-marker commute-map-marker-endpoint'
                            : 'commute-map-marker commute-map-marker-waypoint';
                        markerNode.setAttribute('aria-label', point.label || `Stop ${index + 1}`);

                        const popup = new maplibregl.Popup({ offset: 16 }).setHTML(
                            `<div class="commute-map-popup">${point.label || `Stop ${index + 1}`}</div>`,
                        );

                        const marker = new maplibregl.Marker({ element: markerNode, anchor: 'bottom' })
                            .setLngLat([point.lng, point.lat])
                            .setPopup(popup)
                            .addTo(activeMap);

                        markerRefs.current.push(marker);
                    });

                    const bounds = new maplibregl.LngLatBounds();
                    activePoints.forEach((point) => bounds.extend([point.lng, point.lat]));
                    activeMap.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
                    activeMap.resize();
                };

                if (activeMap.isStyleLoaded()) {
                    renderScene();
                } else {
                    activeMap.once('load', renderScene);
                }

                setMapError('');
            } catch (error) {
                console.error('[CommuteMapPanel] Failed to render map preview:', error);
                setMapError('Map preview unavailable right now, but the route details below still work.');
            }
        };

        void syncMap();

        return () => {
            cancelled = true;
        };
    }, [destination, hasRenderableMap, mapSignature, origin, result]);

    return (
        <section className="hub-panel p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/75">Map preview</p>
                    <h2 className="text-xl font-semibold text-white">Temporary live canvas for commuter routes</h2>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                        {getMapStatusCopy(result)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className={`hub-mini-chip border ${mapQuality.toneClassName} text-xs`}>
                        <MapPinned className="mr-1.5 h-3.5 w-3.5" />
                        {mapQuality.label}
                    </span>
                    <span className="hub-mini-chip text-xs">
                        <Compass className="mr-1.5 h-3.5 w-3.5" />
                        {result?.provider === 'google' ? 'Google-backed route' : 'Community route'}
                    </span>
                    <span className="hub-mini-chip text-xs">
                        <Route className="mr-1.5 h-3.5 w-3.5" />
                        {result?.routeGeometry ? 'Route overlay ready' : 'Marker-only fallback'}
                    </span>
                </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-400">
                {mapQuality.detail}
            </p>

            <div className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/45 shadow-[0_30px_70px_rgba(2,8,23,0.35)]">
                <div ref={mapContainerRef} className="h-[300px] w-full md:h-[360px]" />
                {(!hasRenderableMap || mapError) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 px-6 text-center text-sm text-slate-300 backdrop-blur-sm">
                        <div className="max-w-md space-y-3">
                            <MapPinned className="mx-auto h-10 w-10 text-amber-300/85" />
                            <p>{mapError || getMapStatusCopy(result)}</p>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                {origin && destination ? `${origin} to ${destination}` : 'Waiting for route search'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="hub-mini-chip">MapLibre shell</span>
                <span className="hub-mini-chip">{DEFAULT_COMMUTE_MAP_STYLE_URL ? 'Custom map style' : 'OpenStreetMap raster fallback'}</span>
                <span className="hub-mini-chip">{renderablePoints.length} mapped point{renderablePoints.length === 1 ? '' : 's'}</span>
            </div>
        </section>
    );
}
