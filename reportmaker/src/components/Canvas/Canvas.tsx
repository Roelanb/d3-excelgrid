import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useReportStore } from '../../hooks/useReportStore';
import type { ReportObjectType, ReportObject } from '../../types';
import { DEFAULT_DIMENSIONS } from '../../utils/constants';
import { generateBarcodeDataUrlSync } from '../../utils/barcode';
import { substituteParameters } from '../../utils/parameterSubstitution';

export const Canvas = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const {
        reportObjects,
        canvasSettings,
        addObject,
        selectObject,
        setSelectedTableHeader,
        updateObject,
        updateObjects,
        updateObjectProperties,
        updateCanvasSettings,
        selectedIds,
        selectedTableHeader,
        parameters
    } = useReportStore();

    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState<string>('');
    const [editingTextBox, setEditingTextBox] = useState<{ x: number; y: number; width: number; height: number; rotation: number } | null>(null);

    const [datatableHeaderMenu, setDatatableHeaderMenu] = useState<{
        x: number;
        y: number;
        tableId: string;
        column: string;
    } | null>(null);

    const getTableHeaderLabel = (obj: ReportObject, col: string) => {
        const labels = (obj.properties as any).tableColumnLabels as Record<string, string> | undefined;
        const label = labels?.[col];
        return (typeof label === 'string' && label.trim()) ? label : col;
    };

    const removeDatatableColumn = (tableId: string, col: string) => {
        const table = reportObjects.find(o => o.id === tableId);
        if (!table || table.type !== 'datatable') return;

        const currentCols: string[] = table.properties.columns || [];
        if (!currentCols.includes(col)) return;

        const nextCols = currentCols.filter(c => c !== col);

        const currentWidths: Record<string, number | null> = (table.properties as any).columnWidths || {};
        const currentHeaderCellStyles: Record<string, any> = (table.properties as any).tableHeaderCellStyles || {};
        const currentLabels: Record<string, string> = (table.properties as any).tableColumnLabels || {};

        const nextWidths = { ...currentWidths };
        const nextHeaderCellStyles = { ...currentHeaderCellStyles };
        const nextLabels = { ...currentLabels };
        delete nextWidths[col];
        delete nextHeaderCellStyles[col];
        delete nextLabels[col];

        const totals = (table.properties as any).dataTableTotalsRow;
        const nextTotals = totals
            ? {
                ...totals,
                aggregations: (() => {
                    const a = { ...(totals.aggregations || {}) };
                    delete a[col];
                    return a;
                })(),
            }
            : undefined;

        const groupBy: string[] = ((table.properties as any).dataTableGroupBy || []).filter(Boolean);
        const nextGroupBy = groupBy.filter(c => c !== col);

        updateObjectProperties(tableId, {
            columns: nextCols,
            columnWidths: nextWidths,
            tableHeaderCellStyles: nextHeaderCellStyles,
            tableColumnLabels: nextLabels,
            ...(nextTotals ? { dataTableTotalsRow: nextTotals } : {}),
            dataTableGroupBy: nextGroupBy,
        });

        if (selectedTableHeader?.tableId === tableId && selectedTableHeader?.column === col) {
            setSelectedTableHeader({ tableId, column: null });
        }
    };

    const commitTextEdit = () => {
        if (!editingTextId) return;
        updateObjectProperties(editingTextId, { text: editingTextValue });
        setEditingTextId(null);
        setEditingTextBox(null);
    };

    const cancelTextEdit = () => {
        setEditingTextId(null);
        setEditingTextBox(null);
    };

    // Handle Drop

    // ...

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/react-dnd-type') as ReportObjectType;
        const droppedColumn = e.dataTransfer.getData('application/reportmaker-column');

        const zoom = canvasSettings.zoom ?? 1;

        if (droppedColumn && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;

            // Find datatable under pointer
            const target = reportObjects
                .filter(o => o.type === 'datatable')
                .slice()
                .reverse()
                .find(o => x >= o.x && x <= (o.x + o.width) && y >= o.y && y <= (o.y + o.height));

            if (target) {
                const currentCols = target.properties.columns || [];
                if (!currentCols.includes(droppedColumn)) {
                    const currentWidths: Record<string, number | null> = (target.properties as any).columnWidths || {};
                    const currentHeaderCellStyles: Record<string, any> = (target.properties as any).tableHeaderCellStyles || {};
                    const currentLabels: Record<string, string> = (target.properties as any).tableColumnLabels || {};
                    updateObjectProperties(target.id, {
                        columns: [...currentCols, droppedColumn],
                        columnWidths: { ...currentWidths, [droppedColumn]: null },
                        tableHeaderCellStyles: { ...currentHeaderCellStyles },
                        tableColumnLabels: { ...currentLabels },
                    });
                }
                selectObject(target.id);
                return;
            }
        }

        if (type && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;

            const { width, height } = DEFAULT_DIMENSIONS[type] || { width: 100, height: 100 };

            // Center the object
            const centeredX = x - width / 2;
            const centeredY = y - height / 2;

            // Snap to grid on drop
            const snappedX = canvasSettings.snapToGrid
                ? Math.round(centeredX / canvasSettings.gridSize) * canvasSettings.gridSize
                : centeredX;
            const snappedY = canvasSettings.snapToGrid
                ? Math.round(centeredY / canvasSettings.gridSize) * canvasSettings.gridSize
                : centeredY;

            addObject(type, snappedX, snappedY);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    // Drag Context Ref to persist across renders
    const dragContextRef = useRef<{
        startParentX: number;
        startParentY: number;
        children: { id: string; startX: number; startY: number }[];
    } | null>(null);

    // Selection Rectangle State
    const [selectionRect, setSelectionRect] = useState<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        active: boolean;
    } | null>(null);

    // D3 Rendering Logic
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const { gridSize, showGrid, snapToGrid, page } = canvasSettings;
        const margins = page?.margins || { top: 0, right: 0, bottom: 0, left: 0 };

        // 1. Render Grid
        svg.select('.grid-layer').remove();
        if (showGrid) {
            const gridLayer = svg.insert('g', ':first-child').attr('class', 'grid-layer');

            // Vertical lines
            for (let i = 0; i <= canvasSettings.width; i += gridSize) {
                gridLayer.append('line')
                    .attr('x1', i).attr('y1', 0)
                    .attr('x2', i).attr('y2', canvasSettings.height)
                    .attr('stroke', '#e5e7eb')
                    .attr('stroke-width', 1);
            }

            // Horizontal lines
            for (let i = 0; i <= canvasSettings.height; i += gridSize) {
                gridLayer.append('line')
                    .attr('x1', 0).attr('y1', i)
                    .attr('x2', canvasSettings.width).attr('y2', i)
                    .attr('stroke', '#e5e7eb')
                    .attr('stroke-width', 1);
            }
        }

        // 2. Render Margin Indicators
        svg.select('.margin-layer').remove();
        const marginLayer = svg.insert('g', '.objects-layer').attr('class', 'margin-layer');

        // Draw margin rectangle (printable area)
        const printableX = margins.left;
        const printableY = margins.top;
        const printableWidth = canvasSettings.width - margins.left - margins.right;
        const printableHeight = canvasSettings.height - margins.top - margins.bottom;

        if (printableWidth > 0 && printableHeight > 0) {
            // Printable area border (dashed blue line)
            marginLayer.append('rect')
                .attr('x', printableX)
                .attr('y', printableY)
                .attr('width', printableWidth)
                .attr('height', printableHeight)
                .attr('fill', 'none')
                .attr('stroke', '#93c5fd')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '4 2')
                .attr('pointer-events', 'none');
        }

        // Draw margin shading (light gray overlay on margin areas)
        const marginOpacity = 0.03;

        // Top margin
        if (margins.top > 0) {
            marginLayer.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', canvasSettings.width)
                .attr('height', margins.top)
                .attr('fill', '#6b7280')
                .attr('opacity', marginOpacity)
                .attr('pointer-events', 'none');
        }

        // Bottom margin
        if (margins.bottom > 0) {
            marginLayer.append('rect')
                .attr('x', 0)
                .attr('y', canvasSettings.height - margins.bottom)
                .attr('width', canvasSettings.width)
                .attr('height', margins.bottom)
                .attr('fill', '#6b7280')
                .attr('opacity', marginOpacity)
                .attr('pointer-events', 'none');
        }

        // Left margin (between top and bottom margins)
        if (margins.left > 0) {
            marginLayer.append('rect')
                .attr('x', 0)
                .attr('y', margins.top)
                .attr('width', margins.left)
                .attr('height', canvasSettings.height - margins.top - margins.bottom)
                .attr('fill', '#6b7280')
                .attr('opacity', marginOpacity)
                .attr('pointer-events', 'none');
        }

        // Right margin (between top and bottom margins)
        if (margins.right > 0) {
            marginLayer.append('rect')
                .attr('x', canvasSettings.width - margins.right)
                .attr('y', margins.top)
                .attr('width', margins.right)
                .attr('height', canvasSettings.height - margins.top - margins.bottom)
                .attr('fill', '#6b7280')
                .attr('opacity', marginOpacity)
                .attr('pointer-events', 'none');
        }

        // 3. Render Objects
        // We use a key function to track objects by ID
        const objectsLayer = svg.select<SVGGElement>('.objects-layer').empty()
            ? svg.append('g').attr('class', 'objects-layer')
            : svg.select<SVGGElement>('.objects-layer');

        const groups = objectsLayer.selectAll<SVGGElement, ReportObject>('g.report-object')
            .data(reportObjects, (d) => d.id);

        // EXIT
        groups.exit().remove();

        // ENTER
        const enterGroups = groups.enter()
            .append('g')
            .attr('class', 'report-object')
            .attr('cursor', d => (d.type === 'header' || d.type === 'footer') ? 'default' : 'move');

        // Append content based on type (simplified for now)
        // We append a rect for background/selection and a text/image
        enterGroups.append('rect')
            .attr('class', 'object-bg');

        enterGroups.append('text')
            .attr('class', 'object-text')
            .style('pointer-events', 'none'); // Let clicks pass to group

        enterGroups.append('image')
            .attr('class', 'object-image')
            .style('pointer-events', 'none')
            .attr('preserveAspectRatio', 'none');

        // Shape elements
        enterGroups.append('line')
            .attr('class', 'object-line')
            .style('pointer-events', 'stroke');

        enterGroups.append('rect')
            .attr('class', 'object-rect')
            .style('pointer-events', 'all');

        enterGroups.append('ellipse')
            .attr('class', 'object-ellipse')
            .style('pointer-events', 'all');

        enterGroups.append('polygon')
            .attr('class', 'object-polygon')
            .style('pointer-events', 'all');

        enterGroups.append('polyline')
            .attr('class', 'object-polyline')
            .style('pointer-events', 'stroke');

        enterGroups.append('g')
            .attr('class', 'object-table')
            .style('pointer-events', 'all');

        // Selection overlay rect (shows dashed border when selected)
        enterGroups.append('rect')
            .attr('class', 'selection-overlay')
            .style('pointer-events', 'none');

        // UPDATE (Merge enter and update)
        const allGroups = enterGroups.merge(groups);

        allGroups
            .on('click', function (event, d) {
                event.stopPropagation();
                const target = event.target as Element | null;
                if (target && (target as any).closest && (target as any).closest('.table-header')) {
                    return;
                }
                setSelectedTableHeader(null);
                selectObject(d.id, event.shiftKey);
            })
            .on('dblclick', function (event, d) {
                if (d.type !== 'text') return;
                event.stopPropagation();
                selectObject(d.id, event.shiftKey);
                setEditingTextId(d.id);
                setEditingTextValue(d.properties.text || '');
                setEditingTextBox({
                    x: d.x,
                    y: d.y,
                    width: d.width,
                    height: d.height,
                    rotation: d.properties.rotation || 0,
                });
            });

        // Update positions and styles
        allGroups
            .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.properties.rotation || 0}, ${d.width / 2}, ${d.height / 2})`);

        // Update Background Rect
        allGroups.select<SVGRectElement>('.object-bg')
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .attr('fill', d => {
                if (d.type === 'dataRegion') return '#dbeafe';
                if (d.type === 'header') return '#fef9c3';
                if (d.type === 'footer') return '#d1fae5';
                return d.properties.backgroundColor || 'transparent';
            })
            .attr('stroke', d => {
                if (d.type === 'dataRegion') return '#3b82f6';
                if (d.type === 'header') return '#facc15';
                if (d.type === 'footer') return '#34d399';
                return d.properties.borderColor || 'none';
            })
            .attr('stroke-width', d => {
                if (d.type === 'dataRegion') return 2;
                if (d.type === 'header') return 2;
                if (d.type === 'footer') return 2;
                return d.properties.borderWidth || 0;
            })
            .attr('stroke-dasharray', d => {
                // User borders are solid, only dataRegion has dashed border
                if (d.type === 'dataRegion') return '8 4';
                return 'none';
            })
            .attr('opacity', d => d.properties.opacity ?? 1);

        // Update Selection Overlay (shows dashed border when selected, offset outside the object)
        const selectionOffset = 4;
        allGroups.select<SVGRectElement>('.selection-overlay')
            .attr('x', -selectionOffset)
            .attr('y', -selectionOffset)
            .attr('width', d => d.width + selectionOffset * 2)
            .attr('height', d => d.height + selectionOffset * 2)
            .attr('fill', 'none')
            .attr('stroke', d => selectedIds.includes(d.id) ? '#2563eb' : 'none')
            .attr('stroke-width', d => selectedIds.includes(d.id) ? 2 : 0)
            .attr('stroke-dasharray', '4 2');

        // Update Image
        allGroups.select<SVGImageElement>('.object-image')
            .attr('href', (d) => {
                if (d.type === 'barcode') {
                    let barcodeText = d.properties.text || '';

                    if (d.properties.dataBinding) {
                        const parent = reportObjects.find(o =>
                            o.type === 'dataRegion' &&
                            o.id !== d.id &&
                            (d.x + d.width / 2) >= o.x &&
                            (d.x + d.width / 2) <= (o.x + o.width) &&
                            (d.y + d.height / 2) >= o.y &&
                            (d.y + d.height / 2) <= (o.y + o.height)
                        );

                        if (parent && parent.data && parent.data.length > 0) {
                            const record = parent.data[0];
                            const value = record[d.properties.dataBinding.columnName];
                            barcodeText = value !== undefined ? String(value) : '';
                        }
                    } else {
                        // Apply parameter substitution
                        barcodeText = substituteParameters(barcodeText, parameters);
                    }

                    try {
                        return generateBarcodeDataUrlSync({
                            bcid: (d.properties.barcodeType || 'qrcode') as any,
                            text: barcodeText,
                            widthPx: d.width,
                            heightPx: d.height,
                            includetext: !!d.properties.barcodeIncludeText,
                        });
                    } catch {
                        return d.properties.src || '';
                    }
                }

                return d.properties.src || 'https://via.placeholder.com/150';
            })
            .attr('width', (d) => d.width)
            .attr('height', (d) => d.height)
            .attr('opacity', (d) => d.properties.opacity || 1)
            .style('display', (d) => (d.type === 'image' || d.type === 'barcode') ? 'block' : 'none');

        // Update Text Content
        allGroups.select<SVGTextElement>('.object-text')
            .text(d => {
                if (d.type === 'text') {
                    // Check for data binding
                    if (d.properties.dataBinding) {
                        // Find parent Data Region
                        const parentDataRegion = reportObjects.find(obj =>
                            obj.type === 'dataRegion' &&
                            obj.id !== d.id &&
                            // Check center point containment
                            (d.x + d.width / 2) >= obj.x &&
                            (d.x + d.width / 2) <= (obj.x + obj.width) &&
                            (d.y + d.height / 2) >= obj.y &&
                            (d.y + d.height / 2) <= (obj.y + obj.height)
                        );

                        if (parentDataRegion && parentDataRegion.data && parentDataRegion.data.length > 0) {
                            const record = parentDataRegion.data[0]; // Show first record for now
                            const value = record[d.properties.dataBinding.columnName];
                            return value !== undefined ? String(value) : d.properties.text || 'Text';
                        }
                    }
                    // Apply parameter substitution
                    const rawText = d.properties.text || 'Text';
                    return substituteParameters(rawText, parameters);
                }
                if (d.type === 'dataRegion') {
                    const sourceName = d.properties.dataSource?.name || d.properties.dataSource?.tableName;
                    return sourceName
                        ? `Data: ${sourceName}`
                        : 'Data Region (No Table)';
                }
                if (d.type === 'header') {
                    return 'Header';
                }
                if (d.type === 'footer') {
                    return 'Footer';
                }
                return d.type;
            })
            .attr('x', d => d.width / 2)
            .attr('y', d => d.height / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle') // Center for now, can use textAlign property later
            .attr('font-size', d => {
                if (d.type === 'dataRegion') return 12;
                if (d.type === 'header') return 14;
                if (d.type === 'footer') return 14;
                return d.properties.fontSize || 16;
            })
            .attr('font-family', d => d.properties.fontFamily || 'Arial')
            .attr('fill', d => {
                if (d.type === 'dataRegion') return '#1e40af';
                if (d.type === 'header') return '#854d0e'; // Dark amber for header text
                if (d.type === 'footer') return '#065f46'; // Dark green for footer text
                if (d.properties.dataBinding) return '#059669'; // Green for bound data
                return d.properties.color || '#000000';
            })
            .attr('font-weight', d => {
                if (d.type === 'dataRegion' || d.type === 'header' || d.type === 'footer' || d.properties.dataBinding) return 'bold';
                if (d.type === 'text') return (d.properties.bold ? 'bold' : 'normal');
                return 'normal';
            })
            .attr('font-style', d => {
                if (d.type === 'text') return (d.properties.italic ? 'italic' : 'normal');
                return 'normal';
            })
            .style('text-decoration', d => {
                if (d.type !== 'text') return 'none';
                const parts: string[] = [];
                if (d.properties.underline) parts.push('underline');
                if (d.properties.strikeThrough) parts.push('line-through');
                return parts.length ? parts.join(' ') : 'none';
            })
            .style('display', d => {
                if (d.id === editingTextId) return 'none';
                if (d.type === 'image' || d.type === 'barcode') return 'none';
                return 'block';
            });

        // Update Line
        allGroups.select<SVGLineElement>('.object-line')
            .attr('x1', 0)
            .attr('y1', d => d.height / 2)
            .attr('x2', d => d.width)
            .attr('y2', d => d.height / 2)
            .attr('stroke', d => d.properties.strokeColor || '#000000')
            .attr('stroke-width', d => d.properties.strokeWidth || 2)
            .attr('opacity', d => d.properties.opacity || 1)
            .style('display', d => d.type === 'line' ? 'block' : 'none');

        // Update Rectangle
        allGroups.select<SVGRectElement>('.object-rect')
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .attr('fill', d => d.properties.fillColor || 'transparent')
            .attr('stroke', d => d.properties.strokeColor || '#000000')
            .attr('stroke-width', d => d.properties.strokeWidth || 2)
            .attr('opacity', d => d.properties.opacity || 1)
            .style('display', d => d.type === 'rectangle' ? 'block' : 'none');

        // Update Ellipse
        allGroups.select<SVGEllipseElement>('.object-ellipse')
            .attr('cx', d => d.width / 2)
            .attr('cy', d => d.height / 2)
            .attr('rx', d => d.width / 2)
            .attr('ry', d => d.height / 2)
            .attr('fill', d => d.properties.fillColor || 'transparent')
            .attr('stroke', d => d.properties.strokeColor || '#000000')
            .attr('stroke-width', d => d.properties.strokeWidth || 2)
            .attr('opacity', d => d.properties.opacity || 1)
            .style('display', d => d.type === 'ellipse' ? 'block' : 'none');

        // Update Polygon
        allGroups.select<SVGPolygonElement>('.object-polygon')
            .attr('points', d => d.properties.points || `${d.width / 2},0 ${d.width},${d.height} 0,${d.height}`)
            .attr('fill', d => d.properties.fillColor || 'transparent')
            .attr('stroke', d => d.properties.strokeColor || '#000000')
            .attr('stroke-width', d => d.properties.strokeWidth || 2)
            .attr('opacity', d => d.properties.opacity || 1)
            .style('display', d => d.type === 'polygon' ? 'block' : 'none');

        // Update Polyline
        allGroups.select<SVGPolylineElement>('.object-polyline')
            .attr('points', d => d.properties.points || `0,${d.height} ${d.width / 2},0 ${d.width},${d.height}`)
            .attr('fill', 'none')
            .attr('stroke', d => d.properties.strokeColor || '#000000')
            .attr('stroke-width', d => d.properties.strokeWidth || 2)
            .attr('opacity', d => d.properties.opacity || 1)
            .style('display', d => d.type === 'polyline' ? 'block' : 'none');

        // Update Table / DataTable
        const tableGroups = allGroups.select<SVGGElement>('.object-table')
            .style('display', d => (d.type === 'table' || d.type === 'datatable') ? 'block' : 'none');

        tableGroups.each(function (d) {
            const g = d3.select(this);
            g.selectAll('*').remove(); // Clear previous content

            if (d.type !== 'table' && d.type !== 'datatable') return;

            // Find parent Data Region
            const parentDataRegion = reportObjects.find(obj =>
                obj.type === 'dataRegion' &&
                obj.id !== d.id &&
                (d.x + d.width / 2) >= obj.x &&
                (d.x + d.width / 2) <= (obj.x + obj.width) &&
                (d.y + d.height / 2) >= obj.y &&
                (d.y + d.height / 2) <= (obj.y + obj.height)
            );

            const columns = d.properties.columns || [];
            const data = (Array.isArray(d.data) ? d.data : (parentDataRegion?.data || []));

            const headerHeight = d.type === 'datatable'
                ? (Number(d.properties.dataTableHeaderHeight) || 30)
                : 30;
            const rowHeight = d.type === 'datatable'
                ? (Number(d.properties.dataTableRowHeight) || 30)
                : 30;

            const groupBy = (d.type === 'datatable' ? (d.properties.dataTableGroupBy || []) : []).filter(Boolean);
            const totals = d.type === 'datatable' ? (d.properties.dataTableTotalsRow || {}) : {};
            const totalsEnabled = d.type === 'datatable' ? !!totals.enabled : false;
            const totalsAggregations = (d.type === 'datatable' ? (totals.aggregations || {}) : {}) as Record<string, any>;

            const buildDisplayRows = () => {
                if (d.type !== 'datatable' || groupBy.length === 0) {
                    return data.map((row) => ({ kind: 'data' as const, row }));
                }

                const keyOf = (row: any) => groupBy.map(k => String(row?.[k] ?? '')).join(' | ');
                const sorted = [...data].sort((a: any, b: any) => {
                    const ka = keyOf(a);
                    const kb = keyOf(b);
                    return ka.localeCompare(kb);
                });

                const out: Array<{ kind: 'group'; label: string } | { kind: 'data'; row: any }> = [];
                let currentKey: string | null = null;
                for (const row of sorted) {
                    const k = keyOf(row);
                    if (k !== currentKey) {
                        currentKey = k;
                        out.push({ kind: 'group', label: k });
                    }
                    out.push({ kind: 'data', row });
                }
                return out;
            };

            const computeTotalsRow = () => {
                if (d.type !== 'datatable' || !totalsEnabled) return null;
                const res: Record<string, string> = {};
                for (const col of columns) {
                    const agg = totalsAggregations[col];
                    if (!agg) continue;
                    const values = data.map((r: any) => r?.[col]).filter((v: any) => v !== null && v !== undefined);
                    const nums = values.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n));

                    if (agg === 'count') {
                        res[col] = String(values.length);
                    } else if (agg === 'sum') {
                        res[col] = String(nums.reduce((s: number, n: number) => s + n, 0));
                    } else if (agg === 'avg') {
                        res[col] = nums.length ? String(nums.reduce((s: number, n: number) => s + n, 0) / nums.length) : '';
                    } else if (agg === 'min') {
                        res[col] = nums.length ? String(Math.min(...nums)) : '';
                    } else if (agg === 'max') {
                        res[col] = nums.length ? String(Math.max(...nums)) : '';
                    }
                }
                return res;
            };

            if (columns.length > 0 && data.length > 0) {
                const columnWidths = (d.properties as any).columnWidths as Record<string, number | null> | undefined;

                const fixedWidths = columns.map(col => {
                    const v = columnWidths?.[col];
                    return typeof v === 'number' && isFinite(v) && v > 0 ? v : null;
                });
                const fixedTotal = fixedWidths.reduce<number>((sum, v) => sum + (v ?? 0), 0);
                const autoCount = fixedWidths.filter(v => v == null).length;
                const autoWidth = autoCount > 0 ? Math.max(20, (d.width - fixedTotal) / autoCount) : 0;
                const computedWidths = fixedWidths.map(v => v ?? autoWidth);
                const colX = (() => {
                    const xs: number[] = [];
                    let acc = 0;
                    for (const w of computedWidths) {
                        xs.push(acc);
                        acc += w;
                    }
                    return xs;
                })();

                // Render Header
                const headerGroup = g.append('g').attr('class', 'table-header');

                const headerBaseStyle = d.properties.tableHeaderStyle || {};
                const headerCellStyles = d.properties.tableHeaderCellStyles || {};

                const isHeaderRowSelected = selectedTableHeader?.tableId === d.id && selectedTableHeader?.column === null;

                headerGroup.append('rect')
                    .attr('width', d.width)
                    .attr('height', headerHeight)
                    .attr('fill', 'transparent')
                    .attr('stroke', 'none')
                    .attr('pointer-events', 'none');

                const headerCells = columns.map((col, i) => ({ col, i, x: colX[i], w: computedWidths[i] }));
                const cellSelection = headerGroup
                    .selectAll<SVGGElement, { col: string; i: number; x: number; w: number }>('g.table-header-cell')
                    .data(headerCells, (h: any) => h.col);

                const enterCell = cellSelection
                    .enter()
                    .append('g')
                    .attr('class', 'table-header-cell');

                enterCell.append('rect').attr('class', 'table-header-cell-rect');
                enterCell.append('text').attr('class', 'table-header-cell-text');

                const mergedCells = enterCell.merge(cellSelection as any);
                cellSelection.exit().remove();

                mergedCells
                    .attr('transform', (h) => `translate(${h.x}, 0)`)
                    .style('cursor', d.type === 'datatable' ? 'grab' : 'pointer');

                mergedCells.select<SVGRectElement>('rect.table-header-cell-rect')
                    .attr('width', (h) => h.w)
                    .attr('height', headerHeight)
                    .attr('fill', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return mergedHeaderStyle.backgroundColor ?? '#f3f4f6';
                    })
                    .attr('stroke', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        const isHeaderSelected = selectedTableHeader?.tableId === d.id && selectedTableHeader?.column === h.col;
                        return isHeaderSelected ? '#2563eb' : (mergedHeaderStyle.borderColor ?? '#d1d5db');
                    })
                    .attr('stroke-width', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        const isHeaderSelected = selectedTableHeader?.tableId === d.id && selectedTableHeader?.column === h.col;
                        return isHeaderSelected ? 2 : (mergedHeaderStyle.borderWidth ?? 1);
                    })
                    .attr('opacity', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return mergedHeaderStyle.opacity ?? 1;
                    })
                    .attr('pointer-events', 'all')
                    .style('cursor', d.type === 'datatable' ? 'grab' : 'pointer')
                    .on('mousedown', function (event) {
                        event.stopPropagation();
                    })
                    .on('contextmenu', function (event, h) {
                        if (d.type !== 'datatable') return;
                        event.preventDefault();
                        event.stopPropagation();
                        selectObject(d.id);
                        setSelectedTableHeader(null);
                        setDatatableHeaderMenu({ x: event.clientX, y: event.clientY, tableId: d.id, column: h.col });
                    })
                    .on('click', function (event, h) {
                        if ((event as any).defaultPrevented) return;
                        event.stopPropagation();
                        selectObject(d.id);
                        if (d.type === 'datatable') {
                            setSelectedTableHeader(null);
                            return;
                        }

                        if (selectedTableHeader?.tableId === d.id && selectedTableHeader?.column === h.col) {
                            setSelectedTableHeader({ tableId: d.id, column: null });
                        } else {
                            setSelectedTableHeader({ tableId: d.id, column: h.col });
                        }
                    });

                mergedCells.select<SVGTextElement>('text.table-header-cell-text')
                    .attr('x', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        const padding = (mergedHeaderStyle.padding ?? 5);
                        const align = (mergedHeaderStyle.textAlign ?? 'left');
                        return align === 'center' ? (h.w / 2) : align === 'right' ? (h.w - padding) : padding;
                    })
                    .attr('y', headerHeight / 2)
                    .attr('dy', '0.35em')
                    .text((h) => getTableHeaderLabel(d, h.col))
                    .attr('font-size', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return mergedHeaderStyle.fontSize ?? 12;
                    })
                    .attr('font-family', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return mergedHeaderStyle.fontFamily ?? 'Arial';
                    })
                    .attr('font-weight', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return (mergedHeaderStyle.bold ?? true) ? 'bold' : 'normal';
                    })
                    .attr('font-style', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return (mergedHeaderStyle.italic ?? false) ? 'italic' : 'normal';
                    })
                    .attr('text-decoration', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        const underline = (mergedHeaderStyle.underline ?? false) ? 'underline' : '';
                        const strike = (mergedHeaderStyle.strikeThrough ?? false) ? ' line-through' : '';
                        return `${underline}${strike}`.trim() || 'none';
                    })
                    .attr('fill', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        return mergedHeaderStyle.color ?? '#374151';
                    })
                    .attr('text-anchor', (h) => {
                        const mergedHeaderStyle = { ...headerBaseStyle, ...(headerCellStyles[h.col] || {}) };
                        const align = (mergedHeaderStyle.textAlign ?? 'left');
                        return align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
                    })
                    .attr('pointer-events', 'none');

                if (d.type === 'datatable' && columns.length >= 2) {
                    let reorderState: { sourceCol: string; targetIndex: number } | null = null;
                    let suppressHeaderClick = false;
                    let dragMoved = false;

                    const ensureIndicator = () => {
                        const existing = headerGroup.selectAll<SVGLineElement, any>('line.col-reorder-indicator').data([0]);
                        existing.enter()
                            .append('line')
                            .attr('class', 'col-reorder-indicator')
                            .attr('y1', 0)
                            .attr('y2', headerHeight)
                            .attr('stroke', '#2563eb')
                            .attr('stroke-width', 2)
                            .attr('opacity', 0);
                    };

                    const setIndicator = (x: number, visible: boolean) => {
                        ensureIndicator();
                        headerGroup.select<SVGLineElement>('line.col-reorder-indicator')
                            .attr('x1', x)
                            .attr('x2', x)
                            .attr('opacity', visible ? 1 : 0);
                    };

                    const computeTargetIndex = (px: number) => {
                        for (let i = 0; i < columns.length; i++) {
                            const mid = colX[i] + computedWidths[i] / 2;
                            if (px < mid) return i;
                        }
                        return columns.length;
                    };

                    const reorderDrag = d3.drag<SVGGElement, { col: string; i: number; x: number; w: number }>()
                        .on('start', function (event, h) {
                            event.sourceEvent.stopPropagation();
                            if (event.sourceEvent.cancelable) event.sourceEvent.preventDefault();
                            if ((event.sourceEvent as MouseEvent).button !== 0) return;
                            dragMoved = false;
                            reorderState = { sourceCol: h.col, targetIndex: h.i };
                            setIndicator(h.x, true);
                        })
                        .on('drag', function (event) {
                            if (!reorderState) return;
                            if (Math.abs(event.dx) + Math.abs(event.dy) > 0) dragMoved = true;
                            const [px] = d3.pointer(event.sourceEvent, headerGroup.node() as any);
                            reorderState.targetIndex = computeTargetIndex(px);

                            const x = reorderState.targetIndex >= columns.length
                                ? (colX[columns.length - 1] + computedWidths[columns.length - 1])
                                : colX[reorderState.targetIndex];
                            setIndicator(x, true);
                        })
                        .on('end', function () {
                            if (!reorderState) return;
                            const sourceCol = reorderState.sourceCol;
                            let targetIndex = reorderState.targetIndex;

                            setIndicator(0, false);

                            const current = d.properties.columns || [];
                            if (current.length < 2) {
                                reorderState = null;
                                return;
                            }

                            const currentSourceIndex = current.indexOf(sourceCol);
                            if (currentSourceIndex < 0) {
                                reorderState = null;
                                return;
                            }

                            const next = current.slice();
                            next.splice(currentSourceIndex, 1);

                            if (targetIndex > next.length) targetIndex = next.length;
                            if (targetIndex > currentSourceIndex) targetIndex = Math.max(0, targetIndex - 1);
                            next.splice(targetIndex, 0, sourceCol);

                            if (JSON.stringify(next) !== JSON.stringify(current)) {
                                updateObjectProperties(d.id, { columns: next });
                            }

                            if (dragMoved) {
                                suppressHeaderClick = true;
                                setTimeout(() => {
                                    suppressHeaderClick = false;
                                }, 0);
                            }

                            reorderState = null;
                        });

                    mergedCells.select<SVGRectElement>('rect.table-header-cell-rect')
                        .on('click.suppress-after-drag', function (event) {
                            if (!suppressHeaderClick) return;
                            if ((event as any).cancelable) event.preventDefault();
                        })
                        .call(reorderDrag as any);
                }

                // Header row selection outline (drawn on top so it's visible)
                headerGroup.append('rect')
                    .attr('width', d.width)
                    .attr('height', headerHeight)
                    .attr('fill', 'transparent')
                    .attr('stroke', isHeaderRowSelected ? '#2563eb' : 'none')
                    .attr('stroke-width', isHeaderRowSelected ? 2 : 0)
                    .attr('pointer-events', 'none');

                // Column resize handles (between columns)
                if (columns.length >= 2) {
                    let colResizeState: {
                        leftCol: string;
                        rightCol: string;
                        startLeftWidth: number;
                        startRightWidth: number;
                        dx: number;
                    } | null = null;

                    const handleWidth = 8;
                    const handlesData = columns.slice(0, -1).map((leftCol, i) => ({ leftCol, rightCol: columns[i + 1], index: i }));

                    const resizeBehavior = d3.drag<SVGRectElement, any>()
                        .on('start', function (event, h) {
                            event.sourceEvent.stopPropagation();
                            const i = h.index as number;
                            colResizeState = {
                                leftCol: h.leftCol,
                                rightCol: h.rightCol,
                                startLeftWidth: computedWidths[i],
                                startRightWidth: computedWidths[i + 1],
                                dx: 0,
                            };
                        })
                        .on('drag', function (event) {
                            if (!colResizeState) return;

                            colResizeState.dx += event.dx;
                            const minW = 20;

                            let nextLeft = colResizeState.startLeftWidth + colResizeState.dx;
                            let nextRight = colResizeState.startRightWidth - colResizeState.dx;

                            if (nextLeft < minW) {
                                const diff = minW - nextLeft;
                                nextLeft = minW;
                                nextRight -= diff;
                            }
                            if (nextRight < minW) {
                                const diff = minW - nextRight;
                                nextRight = minW;
                                nextLeft -= diff;
                            }

                            nextLeft = Math.max(minW, nextLeft);
                            nextRight = Math.max(minW, nextRight);

                            const currentWidths: Record<string, number | null> = (d.properties as any).columnWidths || {};
                            updateObjectProperties(d.id, {
                                columnWidths: {
                                    ...currentWidths,
                                    [colResizeState.leftCol]: Math.floor(nextLeft),
                                    [colResizeState.rightCol]: Math.floor(nextRight),
                                }
                            });
                        })
                        .on('end', function () {
                            colResizeState = null;
                        });

                    headerGroup.selectAll<SVGRectElement, any>('rect.col-resize-handle')
                        .data(handlesData)
                        .enter()
                        .append('rect')
                        .attr('class', 'col-resize-handle')
                        .attr('x', (h: any) => (colX[h.index] + computedWidths[h.index]) - handleWidth / 2)
                        .attr('y', 0)
                        .attr('width', handleWidth)
                        .attr('height', headerHeight)
                        .attr('fill', 'transparent')
                        .style('cursor', 'col-resize')
                        .on('mousedown', function (event) {
                            event.stopPropagation();
                        })
                        .call(resizeBehavior as any);
                }

                // DataTable header/row height resize handles
                if (d.type === 'datatable') {
                    const rowResizeHandleHeight = 8;

                    let headerResizeState: { dy: number; start: number } | null = null;
                    const headerResize = d3.drag<SVGRectElement, any>()
                        .on('start', function (event) {
                            event.sourceEvent.stopPropagation();
                            headerResizeState = { dy: 0, start: headerHeight };
                        })
                        .on('drag', function (event) {
                            if (!headerResizeState) return;
                            headerResizeState.dy += event.dy;
                            const next = Math.max(10, Math.floor(headerResizeState.start + headerResizeState.dy));
                            updateObjectProperties(d.id, { dataTableHeaderHeight: next });
                        })
                        .on('end', function () {
                            headerResizeState = null;
                        });

                    headerGroup.append('rect')
                        .attr('x', 0)
                        .attr('y', headerHeight - rowResizeHandleHeight / 2)
                        .attr('width', d.width)
                        .attr('height', rowResizeHandleHeight)
                        .attr('fill', 'transparent')
                        .style('cursor', 'row-resize')
                        .on('mousedown', function (event) { event.stopPropagation(); })
                        .call(headerResize as any);

                    let rowHeightResizeState: { dy: number; start: number } | null = null;
                    const rowHeightResize = d3.drag<SVGRectElement, any>()
                        .on('start', function (event) {
                            event.sourceEvent.stopPropagation();
                            rowHeightResizeState = { dy: 0, start: rowHeight };
                        })
                        .on('drag', function (event) {
                            if (!rowHeightResizeState) return;
                            rowHeightResizeState.dy += event.dy;
                            const next = Math.max(10, Math.floor(rowHeightResizeState.start + rowHeightResizeState.dy));
                            updateObjectProperties(d.id, { dataTableRowHeight: next });
                        })
                        .on('end', function () {
                            rowHeightResizeState = null;
                        });

                    // Place handle at the bottom of the first data row slot
                    g.append('rect')
                        .attr('x', 0)
                        .attr('y', headerHeight + rowHeight - rowResizeHandleHeight / 2)
                        .attr('width', d.width)
                        .attr('height', rowResizeHandleHeight)
                        .attr('fill', 'transparent')
                        .style('cursor', 'row-resize')
                        .on('mousedown', function (event) { event.stopPropagation(); })
                        .call(rowHeightResize as any);
                }

                const totalsHeight = totalsEnabled ? rowHeight : 0;
                const maxRows = Math.floor((d.height - headerHeight - totalsHeight) / rowHeight);
                const displayRows = buildDisplayRows().slice(0, Math.max(0, maxRows));

                displayRows.forEach((entry, rowIndex) => {
                    const rowGroup = g.append('g')
                        .attr('transform', `translate(0, ${headerHeight + rowIndex * rowHeight})`);

                    if (entry.kind === 'group') {
                        rowGroup.append('rect')
                            .attr('width', d.width)
                            .attr('height', rowHeight)
                            .attr('fill', '#f9fafb')
                            .attr('stroke', '#d1d5db')
                            .attr('stroke-width', 1);
                        rowGroup.append('text')
                            .attr('x', 6)
                            .attr('y', rowHeight / 2)
                            .attr('dy', '0.35em')
                            .text(entry.label)
                            .attr('font-size', 12)
                            .attr('font-weight', 'bold')
                            .attr('fill', '#374151');
                        return;
                    }

                    const row = entry.row;
                    columns.forEach((col, colIndex) => {
                        const colWidth = computedWidths[colIndex];
                        const cellGroup = rowGroup.append('g')
                            .attr('transform', `translate(${colX[colIndex]}, 0)`);

                        cellGroup.append('rect')
                            .attr('width', colWidth)
                            .attr('height', rowHeight)
                            .attr('fill', '#ffffff')
                            .attr('stroke', '#e5e7eb')
                            .attr('stroke-width', 1);

                        cellGroup.append('text')
                            .attr('x', 5)
                            .attr('y', rowHeight / 2)
                            .attr('dy', '0.35em')
                            .text(String(row?.[col] ?? ''))
                            .attr('font-size', 12)
                            .attr('fill', '#4b5563')
                            .style('clip-path', `inset(0 0 0 0)`);
                    });
                });

                const totalsRow = computeTotalsRow();
                if (totalsEnabled && totalsRow) {
                    const y = headerHeight + displayRows.length * rowHeight;
                    const totalsGroup = g.append('g')
                        .attr('transform', `translate(0, ${y})`);

                    columns.forEach((col, colIndex) => {
                        const colWidth = computedWidths[colIndex];
                        const cellGroup = totalsGroup.append('g')
                            .attr('transform', `translate(${colX[colIndex]}, 0)`);

                        cellGroup.append('rect')
                            .attr('width', colWidth)
                            .attr('height', rowHeight)
                            .attr('fill', '#f3f4f6')
                            .attr('stroke', '#d1d5db')
                            .attr('stroke-width', 1);

                        cellGroup.append('text')
                            .attr('x', 5)
                            .attr('y', rowHeight / 2)
                            .attr('dy', '0.35em')
                            .text(String(totalsRow[col] ?? ''))
                            .attr('font-size', 12)
                            .attr('font-weight', 'bold')
                            .attr('fill', '#374151');
                    });
                }
            } else {
                // Placeholder
                g.append('rect')
                    .attr('width', d.width)
                    .attr('height', d.height)
                    .attr('fill', '#f9fafb')
                    .attr('stroke', '#d1d5db')
                    .attr('stroke-dasharray', '4 2');

                g.append('text')
                    .attr('x', d.width / 2)
                    .attr('y', d.height / 2)
                    .attr('text-anchor', 'middle')
                    .text(columns.length === 0
                        ? (d.type === 'datatable' ? 'DataTable (Select columns)' : 'Table (Select columns)')
                        : (d.type === 'datatable' ? 'DataTable (Connect data source)' : 'Table (Connect data source)'))
                    .attr('fill', '#9ca3af')
                    .attr('font-size', 14);
            }
        });

        // Drag Behavior
        const dragBehavior = d3.drag<SVGGElement, ReportObject>()
            .on('start', function (event, d) {
                // If clicking on a non-selected object, select only it (unless shift is held)
                if (!selectedIds.includes(d.id)) {
                    selectObject(d.id, event.sourceEvent.shiftKey);
                }
                d3.select(this).raise(); // Bring to front

                if (d.type === 'dataRegion') {
                    const children = reportObjects
                        .filter(obj => {
                            if (obj.id === d.id) return false;
                            // Check if object's center point is within the DataRegion
                            const objCenterX = obj.x + obj.width / 2;
                            const objCenterY = obj.y + obj.height / 2;
                            return objCenterX >= d.x &&
                                objCenterX <= d.x + d.width &&
                                objCenterY >= d.y &&
                                objCenterY <= d.y + d.height;
                        })
                        .map(obj => ({ id: obj.id, startX: obj.x, startY: obj.y }));

                    // Raise children to be on top of the DataRegion
                    objectsLayer.selectAll<SVGGElement, ReportObject>('g.report-object')
                        .filter(o => children.some(c => c.id === o.id))
                        .raise();

                    dragContextRef.current = {
                        startParentX: d.x,
                        startParentY: d.y,
                        children
                    };
                } else {
                    dragContextRef.current = null;
                }
            })
            .on('drag', function (event, d) {
                if (editingTextId && d.id === editingTextId) return;
                if (d.type === 'header') return;
                if (d.type === 'footer') return;
                let newX = event.x;
                let newY = event.y;

                if (snapToGrid) {
                    newX = Math.round(newX / gridSize) * gridSize;
                    newY = Math.round(newY / gridSize) * gridSize;
                }

                d3.select(this)
                    .attr('transform', `translate(${newX}, ${newY}) rotate(${d.properties.rotation || 0}, ${d.width / 2}, ${d.height / 2})`);

                if (d.type === 'dataRegion' && dragContextRef.current) {
                    const dx = newX - dragContextRef.current.startParentX;
                    const dy = newY - dragContextRef.current.startParentY;

                    objectsLayer.selectAll<SVGGElement, ReportObject>('g.report-object')
                        .filter(o => dragContextRef.current!.children.some(c => c.id === o.id))
                        .attr('transform', (o) => {
                            const child = dragContextRef.current!.children.find(c => c.id === o.id)!;
                            return `translate(${child.startX + dx}, ${child.startY + dy}) rotate(${o.properties.rotation || 0}, ${o.width / 2}, ${o.height / 2})`;
                        });
                }
            })
            .on('end', function (event, d) {
                if (editingTextId && d.id === editingTextId) return;
                if (d.type === 'header') return;
                if (d.type === 'footer') return;
                let newX = event.x;
                let newY = event.y;

                if (snapToGrid) {
                    newX = Math.round(newX / gridSize) * gridSize;
                    newY = Math.round(newY / gridSize) * gridSize;
                }

                if (d.type === 'dataRegion' && dragContextRef.current) {
                    const dx = newX - dragContextRef.current.startParentX;
                    const dy = newY - dragContextRef.current.startParentY;

                    const updates = dragContextRef.current.children.map(child => ({
                        id: child.id,
                        changes: { x: child.startX + dx, y: child.startY + dy }
                    }));

                    updates.push({ id: d.id, changes: { x: newX, y: newY } });
                    updateObjects(updates);
                } else {
                    updateObject(d.id, { x: newX, y: newY });
                }

                dragContextRef.current = null;
            });

        allGroups.filter(d => d.type !== 'header' && d.type !== 'footer').call(dragBehavior);
        allGroups.filter(d => d.type === 'header' || d.type === 'footer').on('.drag', null);

        // Resize Handles
        const handles = [
            { x: 0, y: 0, cursor: 'nw-resize', type: 'nw' },
            { x: 1, y: 0, cursor: 'ne-resize', type: 'ne' },
            { x: 1, y: 1, cursor: 'se-resize', type: 'se' },
            { x: 0, y: 1, cursor: 'sw-resize', type: 'sw' },
            { x: 0.5, y: 0, cursor: 'n-resize', type: 'n' },
            { x: 1, y: 0.5, cursor: 'e-resize', type: 'e' },
            { x: 0.5, y: 1, cursor: 's-resize', type: 's' },
            { x: 0, y: 0.5, cursor: 'w-resize', type: 'w' },
        ];

        const headerHandles = [
            { x: 0.5, y: 1, cursor: 's-resize', type: 's' },
        ];

        const footerHandles = [
            { x: 0.5, y: 0, cursor: 'n-resize', type: 'n' },
        ];

        const handleSize = 8;

        // Remove resize handles from non-selected objects
        allGroups.filter(d => !selectedIds.includes(d.id))
            .selectAll('.resize-handle')
            .remove();

        // For each selected object, create/update resize handles
        allGroups.filter(d => selectedIds.includes(d.id)).each(function(d) {
            const group = d3.select(this);

            const handlesForObject = d.type === 'header'
                ? headerHandles
                : d.type === 'footer'
                    ? footerHandles
                    : handles;

            const handleSelection = group.selectAll<SVGRectElement, typeof handles[0]>('.resize-handle')
                .data(handlesForObject as any, (h: any) => h.type);

            handleSelection.exit().remove();

            const enterHandles = handleSelection.enter()
                .append('rect')
                .attr('class', 'resize-handle')
                .attr('width', handleSize)
                .attr('height', handleSize)
                .attr('fill', 'white')
                .attr('stroke', '#2563eb')
                .attr('stroke-width', 1);

            enterHandles.merge(handleSelection)
                .attr('x', h => d.width * h.x - handleSize / 2)
                .attr('y', h => d.height * h.y - handleSize / 2)
                .attr('cursor', h => h.cursor);
        });

        // Resize State
        let resizeState: {
            objectId: string;
            initialX: number;
            initialY: number;
            initialWidth: number;
            initialHeight: number;
            accumulatedDx: number;
            accumulatedDy: number;
        } | null = null;

        const resizeBehavior = d3.drag<SVGRectElement, any>()
            .on('start', function (event) {
                event.sourceEvent.stopPropagation();
                // @ts-ignore
                const parentNode = this.parentNode as SVGGElement;
                const parentData = d3.select(parentNode).datum() as ReportObject;

                resizeState = {
                    objectId: parentData.id,
                    initialX: parentData.x,
                    initialY: parentData.y,
                    initialWidth: parentData.width,
                    initialHeight: parentData.height,
                    accumulatedDx: 0,
                    accumulatedDy: 0
                };
            })
            .on('drag', function (event, h) {
                if (!resizeState) return;

                // @ts-ignore
                const parentNode = this.parentNode as SVGGElement;
                const parentData = d3.select(parentNode).datum() as ReportObject;

                resizeState.accumulatedDx += event.dx;
                resizeState.accumulatedDy += event.dy;

                let newX = resizeState.initialX;
                let newY = resizeState.initialY;
                let newWidth = resizeState.initialWidth;
                let newHeight = resizeState.initialHeight;

                if (h.type.includes('e')) {
                    let proposedWidth = resizeState.initialWidth + resizeState.accumulatedDx;
                    if (snapToGrid) {
                        let rightEdge = resizeState.initialX + proposedWidth;
                        rightEdge = Math.round(rightEdge / gridSize) * gridSize;
                        proposedWidth = rightEdge - resizeState.initialX;
                    }
                    newWidth = proposedWidth;
                }
                if (h.type.includes('w')) {
                    let proposedX = resizeState.initialX + resizeState.accumulatedDx;
                    if (snapToGrid) {
                        proposedX = Math.round(proposedX / gridSize) * gridSize;
                    }
                    newWidth = (resizeState.initialX + resizeState.initialWidth) - proposedX;
                    newX = proposedX;
                }
                if (h.type.includes('s')) {
                    let proposedHeight = resizeState.initialHeight + resizeState.accumulatedDy;
                    if (snapToGrid) {
                        let bottomEdge = resizeState.initialY + proposedHeight;
                        bottomEdge = Math.round(bottomEdge / gridSize) * gridSize;
                        proposedHeight = bottomEdge - resizeState.initialY;
                    }
                    newHeight = proposedHeight;
                }
                if (h.type.includes('n')) {
                    let proposedY = resizeState.initialY + resizeState.accumulatedDy;
                    if (snapToGrid) {
                        proposedY = Math.round(proposedY / gridSize) * gridSize;
                    }
                    newHeight = (resizeState.initialY + resizeState.initialHeight) - proposedY;
                    newY = proposedY;
                }

                // Minimum size constraint
                if (newWidth < gridSize) {
                    newWidth = gridSize;
                    if (h.type.includes('w')) newX = (resizeState.initialX + resizeState.initialWidth) - gridSize;
                }
                if (newHeight < gridSize) {
                    newHeight = gridSize;
                    if (h.type.includes('n')) newY = (resizeState.initialY + resizeState.initialHeight) - gridSize;
                }

                // If multiple objects selected, resize all to the same dimensions
                if (selectedIds.length > 1) {
                    const updates = selectedIds.map(id => {
                        if (id === parentData.id) {
                            return { id, changes: { x: newX, y: newY, width: newWidth, height: newHeight } };
                        }
                        return { id, changes: { width: newWidth, height: newHeight } };
                    });
                    updateObjects(updates);
                } else {
                    updateObject(parentData.id, { x: newX, y: newY, width: newWidth, height: newHeight });
                }
            })
            .on('end', function () {
                resizeState = null;
            });

        // Apply drag behavior to all resize handles on selected objects
        allGroups.filter(d => selectedIds.includes(d.id))
            .selectAll<SVGRectElement, typeof handles[0]>('.resize-handle')
            .call(resizeBehavior);

    }, [reportObjects, canvasSettings, selectedIds, updateObject, selectObject, setSelectedTableHeader, selectedTableHeader, updateObjects, editingTextId, parameters]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input field - if so, don't intercept keyboard shortcuts
            const activeElement = document.activeElement;
            const isInputField = activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement instanceof HTMLSelectElement ||
                (activeElement as HTMLElement)?.isContentEditable;

            // Delete - only when not in input field
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isInputField) return;
                const { selectedIds, removeObject } = useReportStore.getState();
                selectedIds.forEach(id => removeObject(id));
            }

            // Copy - only intercept when not in input field
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (isInputField) return;
                const { copyObject } = useReportStore.getState();
                copyObject();
            }

            // Paste - only intercept when not in input field
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (isInputField) return;
                const { pasteObject } = useReportStore.getState();
                pasteObject();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds]);

    // Mouse handlers for selection rectangle
    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        if (editingTextId) return;

        if ((e.target as any).closest('.report-object')) return;

        const zoom = canvasSettings.zoom ?? 1;

        const rect = svgRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        setSelectionRect({ startX: x, startY: y, endX: x, endY: y, active: true });
        setSelectedTableHeader(null);
        selectObject(null);
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        if (!selectionRect?.active) return;

        const zoom = canvasSettings.zoom ?? 1;

        const rect = svgRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        setSelectionRect({ ...selectionRect, endX: x, endY: y });
    };

    const handleMouseUp = () => {
        if (!selectionRect?.active) return;

        const minX = Math.min(selectionRect.startX, selectionRect.endX);
        const minY = Math.min(selectionRect.startY, selectionRect.endY);
        const maxX = Math.max(selectionRect.startX, selectionRect.endX);
        const maxY = Math.max(selectionRect.startY, selectionRect.endY);

        const selected = reportObjects.filter(obj =>
            obj.x >= minX &&
            obj.y >= minY &&
            (obj.x + obj.width) <= maxX &&
            (obj.y + obj.height) <= maxY
        );

        selectObject(null);
        selected.forEach(obj => selectObject(obj.id, true));
        setSelectionRect(null);
    };

    // Mouse wheel zoom handler
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();

        const currentZoom = canvasSettings.zoom ?? 1;
        const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.min(3, Math.max(0.1, currentZoom + zoomDelta));

        // Round to 1 decimal place for cleaner values
        const roundedZoom = Math.round(newZoom * 10) / 10;

        updateCanvasSettings({ zoom: roundedZoom });
    };

    // Calculate page info for display
    const pageInfo = canvasSettings.page;
    const printableWidth = pageInfo ? pageInfo.width - pageInfo.margins.left - pageInfo.margins.right : canvasSettings.width;
    const printableHeight = pageInfo ? pageInfo.height - pageInfo.margins.top - pageInfo.margins.bottom : canvasSettings.height;

    return (
        <div
            ref={containerRef}
            className={`flex-1 bg-gray-200 overflow-auto flex flex-col ${(canvasSettings.zoom ?? 1) >= 1 ? 'items-start' : 'items-center'} justify-start p-8`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => {
                setDatatableHeaderMenu(null);
                setSelectedTableHeader(null);
                selectObject(null);
            }}
            onWheel={handleWheel}
        >
            {/* Page info bar */}
            <div className="mb-2 text-xs text-gray-500 flex items-center gap-4 self-center">
                <span>
                    {pageInfo?.preset || 'Custom'} ({pageInfo?.orientation || 'portrait'})
                </span>
                <span>
                    Page: {canvasSettings.width} × {canvasSettings.height} px
                </span>
                <span>
                    Printable: {printableWidth} × {printableHeight} px
                </span>
                <span>
                    Margins: T{pageInfo?.margins.top || 0} R{pageInfo?.margins.right || 0} B{pageInfo?.margins.bottom || 0} L{pageInfo?.margins.left || 0}
                </span>
                <span title="Mouse Wheel to zoom">
                    Zoom: {Math.round((canvasSettings.zoom ?? 1) * 100)}%
                </span>
            </div>
            <div
                className="bg-white shadow-lg relative self-center"
                ref={canvasWrapperRef}
                style={{
                    width: canvasSettings.width * (canvasSettings.zoom ?? 1),
                    height: canvasSettings.height * (canvasSettings.zoom ?? 1)
                }}
            >
                {datatableHeaderMenu && (
                    <div
                        className="fixed z-50 bg-white border border-gray-200 rounded shadow-lg min-w-[180px]"
                        style={{ left: datatableHeaderMenu.x, top: datatableHeaderMenu.y }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            e.stopPropagation();
                            setDatatableHeaderMenu(null);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        {(() => {
                            const table = reportObjects.find(o => o.id === datatableHeaderMenu.tableId);
                            if (!table) return null;
                            const col = datatableHeaderMenu.column;

                            const baseStyle: Record<string, unknown> = (table.properties as any).tableHeaderStyle || {};
                            const cellStyles: Record<string, Record<string, unknown>> = (table.properties as any).tableHeaderCellStyles || {};
                            const currentCell: Record<string, unknown> = cellStyles[col] || {};
                            const effective: Record<string, unknown> = { ...baseStyle, ...currentCell };

                            const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Helvetica', 'Georgia', 'Trebuchet MS'];
                            const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

                            const asString = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
                            const asNumber = (v: unknown, fallback: number) => {
                                const n = typeof v === 'number' ? v : Number(v);
                                return Number.isFinite(n) ? n : fallback;
                            };

                            const updateCellStyle = (key: string, value: unknown) => {
                                updateObjectProperties(datatableHeaderMenu.tableId, {
                                    tableHeaderCellStyles: {
                                        ...cellStyles,
                                        [col]: {
                                            ...currentCell,
                                            [key]: value,
                                        }
                                    }
                                });
                            };

                            const resetCellStyle = () => {
                                const next = { ...cellStyles };
                                delete next[col];
                                updateObjectProperties(datatableHeaderMenu.tableId, {
                                    tableHeaderCellStyles: next,
                                });
                            };

                            const labels: Record<string, string> = (table.properties as any).tableColumnLabels || {};
                            const currentLabel = (labels[col] ?? col) as string;

                            return (
                                <div className="p-3 border-b border-gray-200">
                                    <div className="text-xs font-semibold text-gray-600 mb-2">
                                        Header cell: {col}
                                    </div>

                                    <label className="text-xs text-gray-500 flex flex-col gap-1 mb-2">
                                        Header text
                                        <input
                                            type="text"
                                            value={currentLabel}
                                            onChange={(e) => {
                                                updateObjectProperties(datatableHeaderMenu.tableId, {
                                                    tableColumnLabels: { ...labels, [col]: e.target.value },
                                                });
                                            }}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                        />
                                    </label>

                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Background
                                            <input
                                                type="color"
                                                value={asString(effective.backgroundColor, '#f3f4f6')}
                                                onChange={(e) => updateCellStyle('backgroundColor', e.target.value)}
                                                className="w-full h-8 border border-gray-200 rounded"
                                            />
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Text
                                            <input
                                                type="color"
                                                value={asString(effective.color, '#374151')}
                                                onChange={(e) => updateCellStyle('color', e.target.value)}
                                                className="w-full h-8 border border-gray-200 rounded"
                                            />
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Border
                                            <input
                                                type="color"
                                                value={asString(effective.borderColor, '#d1d5db')}
                                                onChange={(e) => updateCellStyle('borderColor', e.target.value)}
                                                className="w-full h-8 border border-gray-200 rounded"
                                            />
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Border width
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={asNumber(effective.borderWidth, 1)}
                                                onChange={(e) => updateCellStyle('borderWidth', Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                            />
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Font size
                                            <select
                                                value={String(asNumber(effective.fontSize, 12))}
                                                onChange={(e) => updateCellStyle('fontSize', Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                                            >
                                                {FONT_SIZES.map(s => (
                                                    <option key={s} value={s}>{s}px</option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Font
                                            <select
                                                value={asString(effective.fontFamily, 'Arial')}
                                                onChange={(e) => updateCellStyle('fontFamily', e.target.value)}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                                            >
                                                {FONT_FAMILIES.map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1">
                                            Padding
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={asNumber(effective.padding, 5)}
                                                onChange={(e) => updateCellStyle('padding', Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                            />
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1 col-span-2">
                                            Align
                                            <select
                                                value={asString(effective.textAlign, 'left')}
                                                onChange={(e) => updateCellStyle('textAlign', e.target.value)}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                                            >
                                                <option value="left">Left</option>
                                                <option value="center">Center</option>
                                                <option value="right">Right</option>
                                            </select>
                                        </label>

                                        <label className="text-xs text-gray-500 flex flex-col gap-1 col-span-2">
                                            Opacity
                                            <input
                                                type="number"
                                                min={0}
                                                max={1}
                                                step={0.1}
                                                value={asNumber(effective.opacity, 1)}
                                                onChange={(e) => updateCellStyle('opacity', Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                            />
                                        </label>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <label className="text-xs text-gray-600 flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={!!effective.bold}
                                                onChange={(e) => updateCellStyle('bold', e.target.checked)}
                                            />
                                            Bold
                                        </label>
                                        <label className="text-xs text-gray-600 flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={!!effective.italic}
                                                onChange={(e) => updateCellStyle('italic', e.target.checked)}
                                            />
                                            Italic
                                        </label>
                                        <label className="text-xs text-gray-600 flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={!!effective.underline}
                                                onChange={(e) => updateCellStyle('underline', e.target.checked)}
                                            />
                                            Underline
                                        </label>
                                        <label className="text-xs text-gray-600 flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={!!effective.strikeThrough}
                                                onChange={(e) => updateCellStyle('strikeThrough', e.target.checked)}
                                            />
                                            Strike
                                        </label>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <button
                                            type="button"
                                            className="text-xs text-gray-600 hover:text-gray-900"
                                            onClick={() => {
                                                resetCellStyle();
                                            }}
                                        >
                                            Reset style
                                        </button>
                                        <button
                                            type="button"
                                            className="text-xs text-gray-600 hover:text-gray-900"
                                            onClick={() => setDatatableHeaderMenu(null)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                        <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                            onClick={() => {
                                removeDatatableColumn(datatableHeaderMenu.tableId, datatableHeaderMenu.column);
                                setDatatableHeaderMenu(null);
                            }}
                        >
                            Remove column
                        </button>
                    </div>
                )}

                {editingTextId && editingTextBox && (
                    <textarea
                        value={editingTextValue}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingTextValue(e.target.value)}
                        onBlur={commitTextEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelTextEdit();
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                commitTextEdit();
                            }
                        }}
                        autoFocus
                        className="absolute resize-none outline-none bg-transparent"
                        style={{
                            left: editingTextBox.x * (canvasSettings.zoom ?? 1),
                            top: editingTextBox.y * (canvasSettings.zoom ?? 1),
                            width: editingTextBox.width * (canvasSettings.zoom ?? 1),
                            height: editingTextBox.height * (canvasSettings.zoom ?? 1),
                            transform: `rotate(${editingTextBox.rotation}deg)`,
                            transformOrigin: `${(editingTextBox.width * (canvasSettings.zoom ?? 1)) / 2}px ${(editingTextBox.height * (canvasSettings.zoom ?? 1)) / 2}px`,
                            fontSize: `${(reportObjects.find(o => o.id === editingTextId)?.properties.fontSize ?? 16) * (canvasSettings.zoom ?? 1)}px`,
                            fontFamily: reportObjects.find(o => o.id === editingTextId)?.properties.fontFamily || 'Arial',
                            fontWeight: (reportObjects.find(o => o.id === editingTextId)?.properties.bold ? 'bold' : 'normal'),
                            fontStyle: (reportObjects.find(o => o.id === editingTextId)?.properties.italic ? 'italic' : 'normal'),
                            textDecoration: (() => {
                                const p = reportObjects.find(o => o.id === editingTextId)?.properties;
                                const parts: string[] = [];
                                if (p?.underline) parts.push('underline');
                                if (p?.strikeThrough) parts.push('line-through');
                                return parts.length ? parts.join(' ') : 'none';
                            })(),
                            color: reportObjects.find(o => o.id === editingTextId)?.properties.color || '#000000',
                            lineHeight: '1.2',
                            padding: 0,
                            margin: 0,
                            border: 'none',
                            background: 'transparent',
                        }}
                    />
                )}

                <svg
                    ref={svgRef}
                    width={canvasSettings.width * (canvasSettings.zoom ?? 1)}
                    height={canvasSettings.height * (canvasSettings.zoom ?? 1)}
                    viewBox={`0 0 ${canvasSettings.width} ${canvasSettings.height}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {selectionRect?.active && (
                        <rect
                            x={Math.min(selectionRect.startX, selectionRect.endX)}
                            y={Math.min(selectionRect.startY, selectionRect.endY)}
                            width={Math.abs(selectionRect.endX - selectionRect.startX)}
                            height={Math.abs(selectionRect.endY - selectionRect.startY)}
                            fill="rgba(37, 99, 235, 0.1)"
                            stroke="#2563eb"
                            strokeWidth={1}
                            strokeDasharray="4 2"
                            pointerEvents="none"
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};
