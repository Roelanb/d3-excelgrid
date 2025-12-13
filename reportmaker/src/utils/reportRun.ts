import jsPDF from 'jspdf';
import { api } from '../services/api';
import { substituteParameters } from './parameterSubstitution';
import { generateBarcodeDataUrlSync } from './barcode';
import type { ReportObject, ReportParameter } from '../types';

const getSqlRestSourceName = (dataSource: any): string => {
    return dataSource?.name || dataSource?.tableName || '';
};

const splitFullName = (fullName: string): { schema: string; name: string } => {
    if (!fullName) return { schema: 'dbo', name: '' };
    if (fullName.includes('.')) {
        const [schema, name] = fullName.split('.');
        return { schema: schema || 'dbo', name: name || '' };
    }
    return { schema: 'dbo', name: fullName };
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
};

const inferImageFormat = (mime: string | undefined): 'PNG' | 'JPEG' | 'WEBP' => {
    const m = (mime || '').toLowerCase();
    if (m.includes('png')) return 'PNG';
    if (m.includes('webp')) return 'WEBP';
    return 'JPEG';
};

const loadImageDataForPdf = async (src: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null> => {
    if (!src) return null;

    if (src.startsWith('data:')) {
        const mimeMatch = src.match(/^data:([^;]+);/i);
        const mime = mimeMatch?.[1];
        return { dataUrl: src, format: inferImageFormat(mime) };
    }

    try {
        const res = await fetch(src);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        return { dataUrl, format: inferImageFormat(blob.type) };
    } catch {
        return null;
    }
};

const parseColor = (color: string | undefined, fallback: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 }) => {
    if (!color) return fallback;
    const c = color.trim().toLowerCase();
    if (c === 'transparent') return fallback;
    if (c.startsWith('#')) {
        const hex = c.slice(1);
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return { r, g, b };
        }
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return { r, g, b };
        }
    }
    return fallback;
};

const mapFontFamily = (fontFamily: string | undefined) => {
    const ff = (fontFamily || '').toLowerCase();
    if (ff.includes('courier')) return 'courier';
    if (ff.includes('times')) return 'times';
    return 'helvetica';
};

export const runDataConnections = async (objects: ReportObject[], parameters: ReportParameter[]) => {
    const dataRegions = objects.filter(o => o.type === 'dataRegion');
    const updates: { id: string; data: any[] }[] = [];

    for (const region of dataRegions) {
        const ds = region.properties?.dataSource;
        if (!ds || ds.type !== 'sqlrest') continue;

        const sourceName = getSqlRestSourceName(ds);
        if (!sourceName) continue;

        const sourceType = ds.sourceType || 'table';

        if (sourceType === 'storedProcedure') {
            const { schema, name } = splitFullName(sourceName);
            const rawParams = ds.procedureParams || {};
            const resolvedParams = Object.fromEntries(
                Object.entries(rawParams).map(([k, v]) => [k, substituteParameters(String(v ?? ''), parameters)])
            ) as Record<string, string>;

            const response = await api.executeStoredProcedure(schema, name, resolvedParams);
            const resultSets = response?.resultSets || response?.ResultSets;
            const data = Array.isArray(resultSets) && Array.isArray(resultSets[0]) ? resultSets[0] : [];
            updates.push({ id: region.id, data: Array.isArray(data) ? data : [] });
        } else {
            const response = await api.getData(sourceName);
            const data = response && response.data ? response.data : [];
            updates.push({ id: region.id, data: Array.isArray(data) ? data : [] });
        }
    }

    return updates;
};

export const applyDataUpdatesToObjects = (objects: ReportObject[], updates: { id: string; data: any[] }[]): ReportObject[] => {
    if (!updates.length) return objects;
    const map = new Map(updates.map(u => [u.id, u.data]));
    return objects.map(o => {
        const data = map.get(o.id);
        return data !== undefined ? { ...o, data } : o;
    });
};

export const generatePdfBlobUrl = async (objects: ReportObject[], canvasSettings: any, parameters: ReportParameter[]): Promise<string> => {
    const page = canvasSettings.page;
    const offsetX = page.margins.left;
    const offsetY = page.margins.top;

    const header = objects.find(o => o.type === 'header') || null;
    const footer = objects.find(o => o.type === 'footer') || null;
    const isInsideHeader = (obj: ReportObject): boolean => {
        if (!header) return false;
        if (obj.id === header.id) return false;
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        return cx >= header.x &&
            cx <= header.x + header.width &&
            cy >= header.y &&
            cy <= header.y + header.height;
    };

    const isInsideFooter = (obj: ReportObject): boolean => {
        if (!footer) return false;
        if (obj.id === footer.id) return false;
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        return cx >= footer.x &&
            cx <= footer.x + footer.width &&
            cy >= footer.y &&
            cy <= footer.y + footer.height;
    };

    const headerChildren = header
        ? objects.filter(o => o.type !== 'header' && isInsideHeader(o))
        : [];
    const headerChildIds = new Set(headerChildren.map(o => o.id));

    const footerChildren = footer
        ? objects.filter(o => o.type !== 'footer' && isInsideFooter(o))
        : [];
    const footerChildIds = new Set(footerChildren.map(o => o.id));

    const bodyObjects = objects.filter(o =>
        o.type !== 'header' &&
        o.type !== 'footer' &&
        !headerChildIds.has(o.id) &&
        !footerChildIds.has(o.id)
    );

    const getPageIndexForObject = (obj: ReportObject): number => {
        return Math.max(0, Math.floor(obj.y / page.height));
    };

    const maxPageIndex = bodyObjects.reduce((max, obj) => Math.max(max, getPageIndexForObject(obj)), 0);

    const doc = new jsPDF({
        orientation: page.orientation,
        unit: 'px',
        format: [page.width, page.height]
    });

    const renderObject = async (obj: ReportObject, pageIndex: number) => {
        const { x, y, width, height, type, properties } = obj;
        const pageShiftY = pageIndex * page.height;
        const yOnPage = y - pageShiftY;
        const px = x + offsetX;
        const py = yOnPage + offsetY;

        if (type === 'header' || type === 'footer') {
            return;
        }

        if (type === 'text') {
            const docAny = doc as any;
            if (docAny.saveGraphicsState) docAny.saveGraphicsState();

            const opacity = properties.opacity;
            if (opacity !== undefined && opacity !== null && docAny.setGState && docAny.GState) {
                docAny.setGState(new docAny.GState({ opacity, fillOpacity: opacity, strokeOpacity: opacity }));
            }

            const fontSize = properties.fontSize || 16;
            const isBold = !!properties.bold;
            const isItalic = !!properties.italic;
            const fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' =
                isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';

            doc.setFont(mapFontFamily(properties.fontFamily), fontStyle);
            doc.setFontSize(fontSize);

            const textRgb = parseColor(properties.color, { r: 0, g: 0, b: 0 });
            doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);

            const padding = properties.padding || 0;

            const bg = (properties.backgroundColor || 'transparent').toLowerCase();
            const hasBg = bg !== 'transparent';
            const hasBorder = !!(properties.borderWidth && properties.borderWidth > 0);

            if (hasBg) {
                const bgRgb = parseColor(properties.backgroundColor, { r: 255, g: 255, b: 255 });
                doc.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
            }

            if (hasBorder) {
                const borderRgb = parseColor(properties.borderColor, { r: 0, g: 0, b: 0 });
                doc.setDrawColor(borderRgb.r, borderRgb.g, borderRgb.b);
                doc.setLineWidth(properties.borderWidth || 1);
            }

            if (hasBg && hasBorder) {
                doc.rect(px, py, width, height, 'FD');
            } else if (hasBg) {
                doc.rect(px, py, width, height, 'F');
            } else if (hasBorder) {
                doc.rect(px, py, width, height, 'S');
            }

            let textToRender = properties.text || '';

            if (properties.dataBinding) {
                const parentDataRegion = objects.find(o =>
                    o.type === 'dataRegion' &&
                    o.id !== obj.id &&
                    (x + width / 2) >= o.x &&
                    (x + width / 2) <= (o.x + o.width) &&
                    (y + height / 2) >= o.y &&
                    (y + height / 2) <= (o.y + o.height)
                );

                if (parentDataRegion && parentDataRegion.data && parentDataRegion.data.length > 0) {
                    const record = parentDataRegion.data[0];
                    const value = record[properties.dataBinding.columnName];
                    if (value !== undefined) {
                        textToRender = String(value);
                    }
                }
            } else {
                textToRender = substituteParameters(textToRender, parameters);
            }

            const align = (properties.textAlign || 'center') as 'left' | 'center' | 'right';
            const maxTextWidth = Math.max(1, width - padding * 2);
            const textLines = doc.splitTextToSize(textToRender, maxTextWidth);

            let textX = px + width / 2;
            if (align === 'left') textX = px + padding;
            if (align === 'right') textX = px + width - padding;
            if (align === 'center') textX = px + width / 2;

            const textY = py + height / 2;

            doc.text(textLines, textX, textY, {
                align,
                baseline: 'middle',
                angle: properties.rotation || 0
            });

            const rotation = properties.rotation || 0;
            const hasUnderline = !!properties.underline;
            const hasStrike = !!properties.strikeThrough;
            if ((hasUnderline || hasStrike) && rotation === 0) {
                const lineHeight = fontSize * 1.2;
                const firstLineY = textY - ((textLines.length - 1) * lineHeight) / 2;

                doc.setDrawColor(textRgb.r, textRgb.g, textRgb.b);
                doc.setLineWidth(Math.max(1, fontSize / 15));

                textLines.forEach((line: string, i: number) => {
                    const lineY = firstLineY + i * lineHeight;
                    const lineWidth = doc.getTextWidth(line);

                    let x1 = textX;
                    let x2 = textX;
                    if (align === 'left') {
                        x1 = textX;
                        x2 = textX + lineWidth;
                    } else if (align === 'center') {
                        x1 = textX - lineWidth / 2;
                        x2 = textX + lineWidth / 2;
                    } else {
                        x1 = textX - lineWidth;
                        x2 = textX;
                    }

                    if (hasUnderline) {
                        const underlineY = lineY + fontSize * 0.35;
                        doc.line(x1, underlineY, x2, underlineY);
                    }
                    if (hasStrike) {
                        const strikeY = lineY;
                        doc.line(x1, strikeY, x2, strikeY);
                    }
                });
            }

            if (docAny.restoreGraphicsState) docAny.restoreGraphicsState();
        } else if (type === 'barcode') {
            try {
                let barcodeText = properties.text || '';

                if (properties.dataBinding) {
                    const parentDataRegion = objects.find(o =>
                        o.type === 'dataRegion' &&
                        o.id !== obj.id &&
                        (x + width / 2) >= o.x &&
                        (x + width / 2) <= (o.x + o.width) &&
                        (y + height / 2) >= o.y &&
                        (y + height / 2) <= (o.y + o.height)
                    );

                    if (parentDataRegion && parentDataRegion.data && parentDataRegion.data.length > 0) {
                        const record = parentDataRegion.data[0];
                        const value = record[properties.dataBinding.columnName];
                        if (value !== undefined) barcodeText = String(value);
                    }
                } else {
                    barcodeText = substituteParameters(barcodeText, parameters);
                }

                const dataUrl = generateBarcodeDataUrlSync({
                    bcid: (properties.barcodeType || 'qrcode') as any,
                    text: barcodeText,
                    widthPx: width,
                    heightPx: height,
                    includetext: !!properties.barcodeIncludeText,
                });

                const img = await loadImageDataForPdf(dataUrl);
                if (img) {
                    doc.addImage(img.dataUrl, img.format, px, py, width, height, undefined, 'FAST', properties.rotation || 0);
                }
            } catch {
                // ignore
            }
        } else if (type === 'image' && properties.src) {
            try {
                const img = await loadImageDataForPdf(properties.src);
                if (img) {
                    doc.addImage(img.dataUrl, img.format, px, py, width, height, undefined, 'FAST', properties.rotation || 0);
                } else {
                    doc.addImage(properties.src, 'JPEG', px, py, width, height, undefined, 'FAST', properties.rotation || 0);
                }
            } catch {
                // ignore
            }
        } else if (type === 'table') {
            const parentDataRegion = objects.find(o =>
                o.type === 'dataRegion' &&
                o.id !== obj.id &&
                (x + width / 2) >= o.x &&
                (x + width / 2) <= (o.x + o.width) &&
                (y + height / 2) >= o.y &&
                (y + height / 2) <= (o.y + o.height)
            );

            const columns = properties.columns || [];
            const data = parentDataRegion?.data || [];

            if (columns.length > 0) {
                const rowHeight = 30;
                const colWidth = width / columns.length;

                doc.setFillColor(243, 244, 246);
                doc.setDrawColor(209, 213, 219);
                doc.setLineWidth(1);

                columns.forEach((_col: string, i: number) => {
                    const cellX = px + i * colWidth;
                    doc.rect(cellX, py, colWidth, rowHeight, 'FD');
                });

                doc.setFontSize(12);
                doc.setTextColor(55, 65, 81);
                doc.setFont('helvetica', 'bold');
                columns.forEach((col: string, i: number) => {
                    const cellX = px + i * colWidth;
                    doc.text(col, cellX + 5, py + rowHeight / 2, { baseline: 'middle' });
                });

                const maxRows = Math.floor((height - rowHeight) / rowHeight);
                const displayData = data.slice(0, maxRows);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(75, 85, 99);

                displayData.forEach((row: Record<string, unknown>, rowIndex: number) => {
                    const rowY = py + (rowIndex + 1) * rowHeight;

                    columns.forEach((col: string, colIndex: number) => {
                        const cellX = px + colIndex * colWidth;

                        doc.setFillColor(255, 255, 255);
                        doc.setDrawColor(229, 231, 235);
                        doc.rect(cellX, rowY, colWidth, rowHeight, 'FD');

                        const value = row[col];
                        if (value !== undefined && value !== null) {
                            doc.setTextColor(75, 85, 99);
                            doc.text(String(value), cellX + 5, rowY + rowHeight / 2, { baseline: 'middle' });
                        }
                    });
                });
            } else {
                doc.setDrawColor('#d1d5db');
                doc.setLineDashPattern([4, 2], 0);
                doc.rect(px, py, width, height);
                doc.setLineDashPattern([], 0);
            }
        } else if (type === 'dataRegion') {
            doc.setDrawColor(200, 200, 200);
            doc.rect(px, py, width, height);
        } else {
            doc.setDrawColor(0);
            doc.rect(px, py, width, height);
        }

    };

    for (let pageIndex = 0; pageIndex <= maxPageIndex; pageIndex++) {
        if (pageIndex > 0) {
            (doc as any).addPage([page.width, page.height], page.orientation);
        }

        for (const hObj of headerChildren) {
            await renderObject(hObj, 0);
        }

        for (const fObj of footerChildren) {
            await renderObject(fObj, 0);
        }

        for (const obj of bodyObjects) {
            if (getPageIndexForObject(obj) !== pageIndex) continue;
            await renderObject(obj, pageIndex);
        }
    }

    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
};

export const runReportAndGeneratePdfUrl = async (objects: ReportObject[], canvasSettings: any, parameters: ReportParameter[]) => {
    const updates = await runDataConnections(objects, parameters);
    const objectsForPdf = applyDataUpdatesToObjects(objects, updates);
    const pdfUrl = await generatePdfBlobUrl(objectsForPdf, canvasSettings, parameters);
    return { updates, pdfUrl };
};
