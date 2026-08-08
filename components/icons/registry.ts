import {
    faBuildingColumns,
    faLandmarkDome,
    faScaleBalanced,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Approved icon families for new work. Keep imports centralized so a component
 * does not make an arbitrary library choice for an otherwise common motif.
 */
export const institutionalFontAwesomeIcons = {
    university: faBuildingColumns,
    civicLandmark: faLandmarkDome,
    balance: faScaleBalanced,
} as const;

export const editorialPhosphorIconNames = ['building', 'scales', 'crown'] as const;

export type InstitutionalFontAwesomeIcon = keyof typeof institutionalFontAwesomeIcons;
export type EditorialPhosphorIcon = (typeof editorialPhosphorIconNames)[number];
