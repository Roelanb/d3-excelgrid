import type { ReportObjectType } from '../types';

export const DEFAULT_DIMENSIONS: Record<ReportObjectType, { width: number; height: number }> = {
    text: { width: 200, height: 50 },
    image: { width: 150, height: 150 },
    chart: { width: 300, height: 200 },
    table: { width: 300, height: 200 },
    barcode: { width: 200, height: 100 },
    dataRegion: { width: 400, height: 300 },
    line: { width: 200, height: 0 },
    rectangle: { width: 200, height: 100 },
    ellipse: { width: 150, height: 100 },
    polygon: { width: 150, height: 150 },
    polyline: { width: 200, height: 100 },
};
