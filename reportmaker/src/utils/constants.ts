import type { ReportObjectType } from '../types';

/**
 * Screen DPI for pixel calculations
 * Standard screen resolution used by browsers
 */
export const SCREEN_DPI = 96;

/**
 * Page size presets in pixels at 96 DPI
 *
 * A4: 210mm × 297mm
 *   Width:  210mm ÷ 25.4 × 96 DPI = 794 px (8.27 inches)
 *   Height: 297mm ÷ 25.4 × 96 DPI = 1123 px (11.69 inches)
 *
 * Letter: 8.5" × 11"
 *   Width:  8.5 × 96 DPI = 816 px
 *   Height: 11 × 96 DPI = 1056 px
 */
export const PAGE_PRESETS_PX: Record<'A4' | 'Letter', { width: number; height: number }> = {
    A4: { width: 794, height: 1123 },
    Letter: { width: 816, height: 1056 },
};

export const DEFAULT_DIMENSIONS: Record<ReportObjectType, { width: number; height: number }> = {
    text: { width: 200, height: 50 },
    image: { width: 150, height: 150 },
    chart: { width: 300, height: 200 },
    table: { width: 300, height: 200 },
    datatable: { width: 400, height: 240 },
    barcode: { width: 200, height: 100 },
    dataRegion: { width: 400, height: 300 },
    header: { width: 400, height: 80 },
    footer: { width: 400, height: 80 },
    line: { width: 200, height: 0 },
    rectangle: { width: 200, height: 100 },
    ellipse: { width: 150, height: 100 },
    polygon: { width: 150, height: 150 },
    polyline: { width: 200, height: 100 },
};
