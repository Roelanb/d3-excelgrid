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
        updateObject,
        updateObjects,
        updateObjectProperties,
        updateCanvasSettings,
        selectedIds,
        parameters
    } = useReportStore();

    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState<string>('');
    const [editingTextBox, setEditingTextBox] = useState<{ x: number; y: number; width: number; height: number; rotation: number } | null>(null);

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

        const zoom = canvasSettings.zoom ?? 1;

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
            .style('pointer-events', 'none');

        // Selection overlay rect (shows dashed border when selected)
        enterGroups.append('rect')
            .attr('class', 'selection-overlay')
            .style('pointer-events', 'none');

        // UPDATE (Merge enter and update)
        const allGroups = enterGroups.merge(groups);

        allGroups
            .on('click', function (event, d) {
                event.stopPropagation();
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

        // Update Table
        const tableGroups = allGroups.select<SVGGElement>('.object-table')
            .style('display', d => d.type === 'table' ? 'block' : 'none');

        tableGroups.each(function (d) {
            const g = d3.select(this);
            g.selectAll('*').remove(); // Clear previous content

            if (d.type !== 'table') return;

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
            const data = parentDataRegion?.data || [];

            if (parentDataRegion && columns.length > 0) {
                const rowHeight = 30;
                const colWidth = d.width / columns.length;

                // Render Header
                const headerGroup = g.append('g').attr('class', 'table-header');
                columns.forEach((col, i) => {
                    const cellGroup = headerGroup.append('g')
                        .attr('transform', `translate(${i * colWidth}, 0)`);

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
                        .text(col)
                        .attr('font-size', 12)
                        .attr('font-weight', 'bold')
                        .attr('fill', '#374151');
                });

                // Render Data Rows (limit to what fits in height)
                const maxRows = Math.floor((d.height - rowHeight) / rowHeight);
                const displayData = data.slice(0, maxRows);

                displayData.forEach((row, rowIndex) => {
                    const rowGroup = g.append('g')
                        .attr('transform', `translate(0, ${(rowIndex + 1) * rowHeight})`);

                    columns.forEach((col, colIndex) => {
                        const cellGroup = rowGroup.append('g')
                            .attr('transform', `translate(${colIndex * colWidth}, 0)`);

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
                            .text(String(row[col] || ''))
                            .attr('font-size', 12)
                            .attr('fill', '#4b5563')
                            .style('clip-path', `inset(0 0 0 0)`);
                    });
                });
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
                    .text('Table (Drag into Data Region)')
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

    }, [reportObjects, canvasSettings, selectedIds, updateObject, selectObject, updateObjects, editingTextId, parameters]);

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

        const zoom = canvasSettings.zoom ?? 1;

        const target = e.target as SVGElement;
        const isBackground = target === svgRef.current ||
            target.classList.contains('grid-layer') ||
            target.tagName === 'line';

        if (!isBackground) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        setSelectionRect({ startX: x, startY: y, endX: x, endY: y, active: true });
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
            onClick={() => selectObject(null)}
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
