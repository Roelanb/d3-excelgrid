import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import jsPDF from 'jspdf';
import { useReportStore } from '../../hooks/useReportStore';
import { generateBarcodeDataUrlSync } from '../../utils/barcode';
import { substituteParameters } from '../../utils/parameterSubstitution';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose }) => {
    const { reportObjects, canvasSettings, parameters } = useReportStore();
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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
        } catch (e) {
            console.error('Failed to load image for PDF:', e);
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

    useEffect(() => {
        if (isOpen) {
            generatePdf();
        } else {
            // Cleanup URL object to avoid memory leaks
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
        }
    }, [isOpen]);

    const generatePdf = async () => {
        // Create PDF with same orientation/size as canvas if possible, 
        // or default to A4/Letter and scale content.
        // For simplicity, let's use the canvas dimensions converted to points or mm.
        // 1 px = 0.75 pt approx, but let's just stick to 'pt' unit and use canvas dimensions directly for 1:1 mapping if possible,
        // or standard A4. Let's try to match canvas size.

        const page = canvasSettings.page;
        const offsetX = page.margins.left;
        const offsetY = page.margins.top;

        const doc = new jsPDF({
            orientation: page.orientation,
            unit: 'px',
            format: [page.width, page.height]
        });

        // Sort objects by z-index (if we had one) or just order in array
        // reportObjects are usually in order of addition, which is z-order (painters algorithm)

        for (const obj of reportObjects) {
            const { x, y, width, height, type, properties } = obj;
            const px = x + offsetX;
            const py = y + offsetY;

            // Rotation context
            // jsPDF doesn't support rotation easily for all elements without context save/restore and transformation matrix
            // For MVP, we might skip rotation or try basic implementation if supported.
            // jsPDF advanced API supports transformation.

            // Let's handle basic types first without rotation for simplicity, or try to add it.

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

                // Check for data binding
                if (properties.dataBinding) {
                    // Find parent Data Region
                    const parentDataRegion = reportObjects.find(o =>
                        o.type === 'dataRegion' &&
                        o.id !== obj.id &&
                        // Check center point containment
                        (x + width / 2) >= o.x &&
                        (x + width / 2) <= (o.x + o.width) &&
                        (y + height / 2) >= o.y &&
                        (y + height / 2) <= (o.y + o.height)
                    );

                    if (parentDataRegion && parentDataRegion.data && parentDataRegion.data.length > 0) {
                        const record = parentDataRegion.data[0]; // Show first record for now
                        const value = record[properties.dataBinding.columnName];
                        if (value !== undefined) {
                            textToRender = String(value);
                        }
                    }
                } else {
                    // Apply parameter substitution (only when not data bound)
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

                // Underline / Strikethrough (only when not rotated)
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
                        const parentDataRegion = reportObjects.find(o =>
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
                        // Apply parameter substitution
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
                } catch (e) {
                    console.error('Error adding barcode to PDF', e);
                }
            } else if (type === 'image' && properties.src) {
                try {
                    const img = await loadImageDataForPdf(properties.src);
                    if (img) {
                        doc.addImage(img.dataUrl, img.format, px, py, width, height, undefined, 'FAST', properties.rotation || 0);
                    } else {
                        // Fallback: try as-is
                        doc.addImage(properties.src, 'JPEG', px, py, width, height, undefined, 'FAST', properties.rotation || 0);
                    }
                } catch (e) {
                    console.error('Error adding image to PDF', e);
                }
            } else if (type === 'table') {
                // Find parent Data Region to get data
                const parentDataRegion = reportObjects.find(o =>
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

                    // Render Header Row
                    doc.setFillColor(243, 244, 246); // #f3f4f6 - light gray
                    doc.setDrawColor(209, 213, 219); // #d1d5db
                    doc.setLineWidth(1);

                    columns.forEach((_col: string, i: number) => {
                        const cellX = px + i * colWidth;
                        doc.rect(cellX, py, colWidth, rowHeight, 'FD'); // Fill and Draw
                    });

                    // Header text
                    doc.setFontSize(12);
                    doc.setTextColor(55, 65, 81); // #374151
                    doc.setFont('helvetica', 'bold');
                    columns.forEach((col: string, i: number) => {
                        const cellX = px + i * colWidth;
                        doc.text(col, cellX + 5, py + rowHeight / 2, { baseline: 'middle' });
                    });

                    // Render Data Rows
                    const maxRows = Math.floor((height - rowHeight) / rowHeight);
                    const displayData = data.slice(0, maxRows);

                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(75, 85, 99); // #4b5563

                    displayData.forEach((row: Record<string, unknown>, rowIndex: number) => {
                        const rowY = py + (rowIndex + 1) * rowHeight;

                        columns.forEach((col: string, colIndex: number) => {
                            const cellX = px + colIndex * colWidth;

                            // Set colors for each cell to ensure they're applied
                            doc.setFillColor(255, 255, 255); // white
                            doc.setDrawColor(229, 231, 235); // #e5e7eb
                            doc.rect(cellX, rowY, colWidth, rowHeight, 'FD');

                            const value = row[col];
                            if (value !== undefined && value !== null) {
                                doc.setTextColor(75, 85, 99); // #4b5563
                                doc.text(String(value), cellX + 5, rowY + rowHeight / 2, { baseline: 'middle' });
                            }
                        });
                    });
                } else {
                    // No columns defined - draw placeholder
                    doc.setDrawColor('#d1d5db');
                    doc.setLineDashPattern([4, 2], 0);
                    doc.rect(px, py, width, height);
                    doc.setLineDashPattern([], 0);
                }
            } else if (type === 'dataRegion') {
                // Data regions are usually invisible containers in final report
                // Just render a light border for now to indicate the region
                doc.setDrawColor(200, 200, 200);
                doc.rect(px, py, width, height);
            } else {
                // Default rect for other types
                doc.setDrawColor(0);
                doc.rect(px, py, width, height);
            }
        }

        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Report Preview</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 p-4 bg-gray-100 overflow-hidden">
                    {pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full border rounded bg-white" title="PDF Preview" />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p>Generating PDF...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
