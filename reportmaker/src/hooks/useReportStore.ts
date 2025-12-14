import { create } from 'zustand';
import type { ReportObject, CanvasSettings, ReportMetadata, ReportObjectType, ReportObjectProperties, PageSettings, ReportParameter, ReportParameterType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_DIMENSIONS, PAGE_PRESETS_PX } from '../utils/constants';

export type AlignmentType = 'left' | 'right' | 'top' | 'bottom' | 'center-horizontal' | 'center-vertical' | 'distribute-horizontal' | 'distribute-vertical' | 'same-width' | 'same-height';

const DEFAULT_PAGE: PageSettings = {
    preset: 'A4',
    orientation: 'portrait',
    width: PAGE_PRESETS_PX.A4.width,
    height: PAGE_PRESETS_PX.A4.height,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
};

const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
    showGrid: true,
    snapToGrid: true,
    gridSize: 20,
    zoom: 1,
    width: DEFAULT_PAGE.width,
    height: DEFAULT_PAGE.height,
    page: DEFAULT_PAGE,
};

const DEFAULT_REPORT_METADATA: ReportMetadata = {
    name: '',
    description: '',
    author: '',
};

interface ReportState {
    reportObjects: ReportObject[];
    selectedIds: string[];
    selectedTableHeader: { tableId: string; column: string | null } | null;
    canvasSettings: CanvasSettings;
    reportMetadata: ReportMetadata;
    reportFileHandle: FileSystemFileHandle | null;
    reportFileName: string | null;
    isDirty: boolean;
    parameters: ReportParameter[];

    addObject: (type: ReportObjectType, x: number, y: number) => void;
    updateObject: (id: string, updates: Partial<ReportObject>) => void;
    updateObjects: (updates: { id: string; changes: Partial<ReportObject> }[]) => void;
    updateObjectsData: (updates: { id: string; data: ReportObject['data'] }[]) => void;
    updateObjectProperties: (id: string, props: Partial<ReportObjectProperties>) => void;
    removeObject: (id: string) => void;
    selectObject: (id: string | null, multi?: boolean) => void;
    toggleSelection: (id: string) => void;
    setSelectedTableHeader: (selection: { tableId: string; column: string | null } | null) => void;
    clearSelectedTableHeader: () => void;
    updateCanvasSettings: (settings: Partial<CanvasSettings>) => void;
    setObjects: (objects: ReportObject[]) => void;
    clipboard: ReportObject | null;
    copyObject: () => void;
    pasteObject: () => void;
    alignObjects: (type: AlignmentType) => void;
    newReport: () => void;
    saveReport: () => Promise<boolean>;
    saveReportAs: () => Promise<boolean>;
    loadReport: (data: { reportObjects: ReportObject[]; canvasSettings: CanvasSettings; parameters?: ReportParameter[]; metadata?: ReportMetadata }) => void;
    loadReportFromFileSystem: () => Promise<void>;
    setReportFileHandle: (handle: FileSystemFileHandle | null) => void;
    setReportFileName: (name: string | null) => void;

    // Report metadata
    setReportMetadata: (updates: Partial<ReportMetadata>) => void;

    // Parameter actions
    addParameter: (type: ReportParameterType) => void;
    updateParameter: (id: string, updates: Partial<ReportParameter>) => void;
    removeParameter: (id: string) => void;
    setParameterValue: (id: string, value: ReportParameter['value']) => void;
}

export const useReportStore = create<ReportState>((set) => ({
    reportObjects: [],
    selectedIds: [],
    selectedTableHeader: null,
    canvasSettings: DEFAULT_CANVAS_SETTINGS,
    reportMetadata: DEFAULT_REPORT_METADATA,
    reportFileHandle: null,
    reportFileName: null,
    isDirty: false,
    parameters: [],

    addObject: (type, x, y) => set((state) => {
        const { width, height } = DEFAULT_DIMENSIONS[type] || { width: 100, height: 100 };
        const isShape = ['line', 'rectangle', 'ellipse', 'polygon', 'polyline'].includes(type);

        if (type === 'header') {
            const existing = state.reportObjects.find(o => o.type === 'header');
            if (existing) {
                return { selectedIds: [existing.id] };
            }
        }

        if (type === 'footer') {
            const existing = state.reportObjects.find(o => o.type === 'footer');
            if (existing) {
                return { selectedIds: [existing.id] };
            }
        }

        const newObject: ReportObject = {
            id: uuidv4(),
            type,
            x: type === 'header' || type === 'footer' ? 0 : x,
            y: type === 'header'
                ? 0
                : type === 'footer'
                    ? Math.max(0, state.canvasSettings.height - height)
                    : y,
            width: type === 'header' || type === 'footer' ? state.canvasSettings.width : width,
            height,
            properties: {
                text: type === 'text' ? 'Double click to edit' : '',
                fontSize: 16,
                fontFamily: 'Arial',
                bold: false,
                italic: false,
                underline: false,
                strikeThrough: false,
                color: '#000000',
                opacity: 1,
                rotation: 0,
                backgroundColor: type === 'text' ? 'transparent' : (type === 'header' ? '#fef9c3' : (type === 'footer' ? '#d1fae5' : '#eeeeee')),
                ...((type === 'table' || type === 'datatable') && {
                    columns: [],
                    columnWidths: {},
                    tableHeaderStyle: {},
                    tableHeaderCellStyles: {},
                }),
                ...(type === 'datatable' && {
                    dataTableRowHeight: 30,
                    dataTableHeaderHeight: 30,
                    dataTableTotalsRow: { enabled: false, aggregations: {} },
                    dataTableGroupBy: [],
                }),
                ...(type === 'header' && {
                    borderColor: '#facc15',
                    borderWidth: 2,
                }),
                ...(type === 'footer' && {
                    borderColor: '#34d399',
                    borderWidth: 2,
                }),
                ...(type === 'barcode' && {
                    text: '0123456789',
                    barcodeType: 'qrcode',
                    barcodeIncludeText: false,
                    src: '',
                }),
                ...(isShape && {
                    strokeWidth: 2,
                    strokeColor: '#000000',
                    fillColor: type === 'line' || type === 'polyline' ? 'none' : 'transparent',
                }),
            },
        };

        const nextObjects = (() => {
            if (type === 'header') {
                const existingFooter = state.reportObjects.find(o => o.type === 'footer');
                const rest = state.reportObjects.filter(o => o.type !== 'footer');
                return existingFooter ? [newObject, existingFooter, ...rest] : [newObject, ...state.reportObjects];
            }
            if (type === 'footer') {
                const existingHeader = state.reportObjects.find(o => o.type === 'header');
                const rest = state.reportObjects.filter(o => o.type !== 'header');
                return existingHeader ? [existingHeader, newObject, ...rest] : [newObject, ...state.reportObjects];
            }
            return [...state.reportObjects, newObject];
        })();

        return { reportObjects: nextObjects, selectedIds: [newObject.id], isDirty: true };
    }),

    updateObject: (id, updates) => set((state) => ({
        reportObjects: state.reportObjects.map((obj) => {
            if (obj.id !== id) return obj;
            const next = { ...obj, ...updates };
            if (obj.type === 'header') {
                return { ...next, x: 0, y: 0, width: state.canvasSettings.width };
            }
            if (obj.type === 'footer') {
                const y = Math.max(0, state.canvasSettings.height - next.height);
                return { ...next, x: 0, y, width: state.canvasSettings.width };
            }
            return next;
        }),
        isDirty: true,
    })),

    updateObjectProperties: (id, props) => set((state) => ({
        reportObjects: state.reportObjects.map((obj) =>
            obj.id === id ? { ...obj, properties: { ...obj.properties, ...props } } : obj
        ),
        isDirty: true,
    })),

    removeObject: (id) => set((state) => ({
        reportObjects: state.reportObjects.filter((obj) => obj.id !== id),
        selectedIds: state.selectedIds.filter(selectedId => selectedId !== id),
        selectedTableHeader: state.selectedTableHeader?.tableId === id ? null : state.selectedTableHeader,
        isDirty: true,
    })),

    selectObject: (id, multi = false) => set((state) => {
        if (id === null) return { selectedIds: [], selectedTableHeader: null };
        if (multi) {
            return { selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id] };
        }
        return { selectedIds: [id] };
    }),

    toggleSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter(selectedId => selectedId !== id)
            : [...state.selectedIds, id]
    })),

    setSelectedTableHeader: (selection) => set(() => ({ selectedTableHeader: selection })),

    clearSelectedTableHeader: () => set(() => ({ selectedTableHeader: null })),

    updateCanvasSettings: (settings) => set((state) => {
        const canvasSettingsRaw = { ...state.canvasSettings, ...settings };
        const zoomRaw = (canvasSettingsRaw as any).zoom;
        const zoom = (typeof zoomRaw === 'number' && Number.isFinite(zoomRaw))
            ? Math.max(0.1, zoomRaw)
            : state.canvasSettings.zoom;
        const canvasSettings = { ...canvasSettingsRaw, zoom };
        const width = canvasSettings.width;
        const height = canvasSettings.height;
        return {
            canvasSettings,
            reportObjects: state.reportObjects.map((obj) =>
                obj.type === 'header'
                    ? { ...obj, x: 0, y: 0, width }
                    : obj.type === 'footer'
                        ? { ...obj, x: 0, y: Math.max(0, height - obj.height), width }
                        : obj
            ),
            isDirty: true,
        };
    }),

    updateObjects: (updates) => set((state) => {
        const updateMap = new Map(updates.map(u => [u.id, u.changes]));
        return {
            reportObjects: state.reportObjects.map((obj) => {
                const changes = updateMap.get(obj.id);
                if (!changes) return obj;
                const next = { ...obj, ...changes };
                if (obj.type === 'header') {
                    return { ...next, x: 0, y: 0, width: state.canvasSettings.width };
                }
                if (obj.type === 'footer') {
                    const y = Math.max(0, state.canvasSettings.height - next.height);
                    return { ...next, x: 0, y, width: state.canvasSettings.width };
                }
                return next;
            }),
            isDirty: true,
        };
    }),

    updateObjectsData: (updates) => set((state) => {
        const updateMap = new Map(updates.map(u => [u.id, u.data]));
        return {
            reportObjects: state.reportObjects.map((obj) => {
                const data = updateMap.get(obj.id);
                return data !== undefined ? { ...obj, data } : obj;
            }),
        };
    }),

    setObjects: (objects) => set(() => ({ reportObjects: objects, isDirty: true })),

    clipboard: null,

    copyObject: () => set((state) => {
        const objectToCopy = state.reportObjects.find(obj => obj.id === state.selectedIds[0]);
        return { clipboard: objectToCopy || null };
    }),

    pasteObject: () => set((state) => {
        if (!state.clipboard) return {};

        if (state.clipboard.type === 'header') {
            const existing = state.reportObjects.find(o => o.type === 'header');
            if (existing) return { selectedIds: [existing.id] };
        }

        if (state.clipboard.type === 'footer') {
            const existing = state.reportObjects.find(o => o.type === 'footer');
            if (existing) return { selectedIds: [existing.id] };
        }

        const newObject: ReportObject = {
            ...state.clipboard,
            id: uuidv4(),
            x: state.clipboard.x + 20,
            y: state.clipboard.y + 20,
        };

        return {
            reportObjects: [...state.reportObjects, newObject],
            selectedIds: [newObject.id]
        };
    }),

    alignObjects: (type) => set((state) => {
        if (state.selectedIds.length < 2) return {};

        const selectedObjects = state.reportObjects.filter(obj => state.selectedIds.includes(obj.id));

        let updates: { id: string; changes: Partial<ReportObject> }[] = [];

        switch (type) {
            case 'left': {
                const minX = Math.min(...selectedObjects.map(obj => obj.x));
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { x: minX } }));
                break;
            }
            case 'right': {
                const maxRight = Math.max(...selectedObjects.map(obj => obj.x + obj.width));
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { x: maxRight - obj.width } }));
                break;
            }
            case 'top': {
                const minY = Math.min(...selectedObjects.map(obj => obj.y));
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { y: minY } }));
                break;
            }
            case 'bottom': {
                const maxBottom = Math.max(...selectedObjects.map(obj => obj.y + obj.height));
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { y: maxBottom - obj.height } }));
                break;
            }
            case 'center-horizontal': {
                const minX = Math.min(...selectedObjects.map(obj => obj.x));
                const maxRight = Math.max(...selectedObjects.map(obj => obj.x + obj.width));
                const centerX = (minX + maxRight) / 2;
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { x: centerX - obj.width / 2 } }));
                break;
            }
            case 'center-vertical': {
                const minY = Math.min(...selectedObjects.map(obj => obj.y));
                const maxBottom = Math.max(...selectedObjects.map(obj => obj.y + obj.height));
                const centerY = (minY + maxBottom) / 2;
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { y: centerY - obj.height / 2 } }));
                break;
            }
            case 'distribute-horizontal': {
                const sorted = [...selectedObjects].sort((a, b) => a.x - b.x);
                const minX = sorted[0].x;
                const maxRight = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
                const totalWidth = sorted.reduce((sum, obj) => sum + obj.width, 0);
                const spacing = (maxRight - minX - totalWidth) / (sorted.length - 1);

                let currentX = minX;
                updates = sorted.map(obj => {
                    const change = { id: obj.id, changes: { x: currentX } };
                    currentX += obj.width + spacing;
                    return change;
                });
                break;
            }
            case 'distribute-vertical': {
                const sorted = [...selectedObjects].sort((a, b) => a.y - b.y);
                const minY = sorted[0].y;
                const maxBottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
                const totalHeight = sorted.reduce((sum, obj) => sum + obj.height, 0);
                const spacing = (maxBottom - minY - totalHeight) / (sorted.length - 1);

                let currentY = minY;
                updates = sorted.map(obj => {
                    const change = { id: obj.id, changes: { y: currentY } };
                    currentY += obj.height + spacing;
                    return change;
                });
                break;
            }
            case 'same-width': {
                const maxWidth = Math.max(...selectedObjects.map(obj => obj.width));
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { width: maxWidth } }));
                break;
            }
            case 'same-height': {
                const maxHeight = Math.max(...selectedObjects.map(obj => obj.height));
                updates = selectedObjects.map(obj => ({ id: obj.id, changes: { height: maxHeight } }));
                break;
            }
        }

        const updateMap = new Map(updates.map(u => [u.id, u.changes]));
        return {
            reportObjects: state.reportObjects.map((obj) => {
                const changes = updateMap.get(obj.id);
                return changes ? { ...obj, ...changes } : obj;
            }),
        };
    }),

    setReportFileHandle: (handle) => set(() => ({ reportFileHandle: handle })),

    setReportFileName: (name) => set(() => ({ reportFileName: name })),

    setReportMetadata: (updates) => set((state) => ({
        reportMetadata: { ...state.reportMetadata, ...updates },
        isDirty: true,
    })),

    newReport: () => set(() => ({
        reportObjects: [],
        selectedIds: [],
        selectedTableHeader: null,
        canvasSettings: DEFAULT_CANVAS_SETTINGS,
        reportMetadata: DEFAULT_REPORT_METADATA,
        reportFileHandle: null,
        reportFileName: null,
        clipboard: null,
        parameters: [],
        isDirty: false,
    })),

    saveReport: async () => {
        const state = useReportStore.getState();

        const blobToDataUrl = (blob: Blob): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        };

        const objectsForSave: ReportObject[] = await Promise.all(state.reportObjects.map(async (obj) => {
            if (obj.type !== 'image' && obj.type !== 'barcode') return obj;
            const props = obj.properties || {};

            const existingDataUrl = props.imageDataUrl || (props.src && props.src.startsWith('data:') ? props.src : undefined);
            if (existingDataUrl) {
                return {
                    ...obj,
                    properties: {
                        ...props,
                        src: existingDataUrl,
                        imageDataUrl: undefined,
                    }
                };
            }

            if (!props.src) return obj;

            try {
                const res = await fetch(props.src);
                const blob = await res.blob();
                const dataUrl = await blobToDataUrl(blob);
                return {
                    ...obj,
                    properties: {
                        ...props,
                        src: dataUrl,
                        imageDataUrl: undefined,
                    }
                };
            } catch {
                // If we cannot fetch/convert (e.g. CORS), keep as-is
                return obj;
            }
        }));

        const reportData = {
            reportObjects: objectsForSave,
            canvasSettings: state.canvasSettings,
            parameters: state.parameters,
            metadata: state.reportMetadata,
        };

        const json = JSON.stringify(reportData, null, 2);
        const fileName = `report-${new Date().toISOString().slice(0, 10)}.json`;

        const hasSavePicker = typeof (window as any).showSaveFilePicker === 'function';
        if (hasSavePicker) {
            try {
                const fileHandle: FileSystemFileHandle = state.reportFileHandle
                    ? state.reportFileHandle
                    : await (window as any).showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'Report JSON', accept: { 'application/json': ['.json'] } }]
                    });

                if (!state.reportFileHandle) {
                    set(() => ({ reportFileHandle: fileHandle }));
                }

                const writable = await fileHandle.createWritable();
                await writable.write(new Blob([json], { type: 'application/json' }));
                await writable.close();
                set(() => ({ isDirty: false, reportFileName: fileHandle.name }));
                return true;
            } catch {
                return false;
            }
        }

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        set(() => ({ isDirty: false, reportFileHandle: null, reportFileName: fileName }));
        return true;
    },

    saveReportAs: async () => {
        const state = useReportStore.getState();

        if (!state.reportFileHandle || !state.isDirty) {
            return false;
        }

        const blobToDataUrl = (blob: Blob): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        };

        const objectsForSave: ReportObject[] = await Promise.all(state.reportObjects.map(async (obj) => {
            if (obj.type !== 'image' && obj.type !== 'barcode') return obj;
            const props = obj.properties || {};

            const existingDataUrl = props.imageDataUrl || (props.src && props.src.startsWith('data:') ? props.src : undefined);
            if (existingDataUrl) {
                return {
                    ...obj,
                    properties: {
                        ...props,
                        src: existingDataUrl,
                        imageDataUrl: undefined,
                    }
                };
            }

            if (!props.src) return obj;

            try {
                const res = await fetch(props.src);
                const blob = await res.blob();
                const dataUrl = await blobToDataUrl(blob);
                return {
                    ...obj,
                    properties: {
                        ...props,
                        src: dataUrl,
                        imageDataUrl: undefined,
                    }
                };
            } catch {
                return obj;
            }
        }));

        const reportData = {
            reportObjects: objectsForSave,
            canvasSettings: state.canvasSettings,
            parameters: state.parameters,
            metadata: state.reportMetadata,
        };

        const json = JSON.stringify(reportData, null, 2);
        const fileName = `report-${new Date().toISOString().slice(0, 10)}.json`;

        const hasSavePicker = typeof (window as any).showSaveFilePicker === 'function';
        if (hasSavePicker) {
            try {
                const fileHandle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{ description: 'Report JSON', accept: { 'application/json': ['.json'] } }]
                });
                set(() => ({ reportFileHandle: fileHandle }));

                const writable = await fileHandle.createWritable();
                await writable.write(new Blob([json], { type: 'application/json' }));
                await writable.close();
                set(() => ({ isDirty: false, reportFileName: fileHandle.name }));
                return true;
            } catch {
                return false;
            }
        }

        // Fallback: just download (cannot keep location)
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        set(() => ({ reportFileHandle: null, reportFileName: fileName }));
        return true;
    },

    loadReportFromFileSystem: async () => {
        const hasFileSystemAccessApi = typeof (window as any).showOpenFilePicker === 'function';
        if (!hasFileSystemAccessApi) {
            alert('Your browser does not support file system loading. Use the Load button file picker instead.');
            return;
        }

        const [fileHandle]: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
            multiple: false,
            types: [{ description: 'Report JSON', accept: { 'application/json': ['.json'] } }]
        });

        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        set(() => ({ reportFileHandle: fileHandle, reportFileName: file.name, isDirty: false }));

        useReportStore.getState().loadReport(data);
    },

    loadReport: (data) => set((state) => {
        const incoming: Partial<CanvasSettings> = (data as any)?.canvasSettings || {};
        const incomingPage: any = (incoming as any).page;

        const incomingMetadata: ReportMetadata | undefined = (data as any)?.metadata || (data as any)?.reportMetadata;
        const reportMetadata: ReportMetadata = incomingMetadata
            ? {
                name: String((incomingMetadata as any).name ?? ''),
                description: String((incomingMetadata as any).description ?? ''),
                author: String((incomingMetadata as any).author ?? ''),
            }
            : ((data as any)?.metadata === undefined && (data as any)?.reportMetadata === undefined && (data as any)?.reportObjects && (data as any)?.canvasSettings)
                ? (state.reportMetadata || DEFAULT_REPORT_METADATA)
                : DEFAULT_REPORT_METADATA;

        const zoom = (typeof (incoming as any).zoom === 'number' && Number.isFinite((incoming as any).zoom))
            ? Math.max(0.1, (incoming as any).zoom)
            : DEFAULT_CANVAS_SETTINGS.zoom;

        let page: PageSettings = DEFAULT_PAGE;

        if (incomingPage && typeof incomingPage === 'object') {
            const presetRaw: unknown = incomingPage.preset;
            const presetKey = presetRaw === 'A4' || presetRaw === 'Letter' ? presetRaw : null;
            const presetSize = presetKey ? PAGE_PRESETS_PX[presetKey] : undefined;

            const orientation = incomingPage.orientation === 'landscape' ? 'landscape' : 'portrait';
            const baseWidth = typeof incomingPage.width === 'number'
                ? incomingPage.width
                : (presetSize?.width ?? DEFAULT_PAGE.width);
            const baseHeight = typeof incomingPage.height === 'number'
                ? incomingPage.height
                : (presetSize?.height ?? DEFAULT_PAGE.height);

            const width = orientation === 'landscape' ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
            const height = orientation === 'landscape' ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);

            page = {
                preset: presetKey ? presetKey : 'Custom',
                orientation,
                width,
                height,
                margins: {
                    top: typeof incomingPage.margins?.top === 'number' ? incomingPage.margins.top : DEFAULT_PAGE.margins.top,
                    right: typeof incomingPage.margins?.right === 'number' ? incomingPage.margins.right : DEFAULT_PAGE.margins.right,
                    bottom: typeof incomingPage.margins?.bottom === 'number' ? incomingPage.margins.bottom : DEFAULT_PAGE.margins.bottom,
                    left: typeof incomingPage.margins?.left === 'number' ? incomingPage.margins.left : DEFAULT_PAGE.margins.left,
                }
            };
        } else {
            const w = typeof incoming.width === 'number' ? incoming.width : DEFAULT_CANVAS_SETTINGS.width;
            const h = typeof incoming.height === 'number' ? incoming.height : DEFAULT_CANVAS_SETTINGS.height;
            page = {
                ...DEFAULT_PAGE,
                preset: 'Custom',
                orientation: w >= h ? 'landscape' : 'portrait',
                width: w,
                height: h,
            };
        }

        return {
            reportObjects: (data.reportObjects || []).map((obj: ReportObject) => {
                if (obj.type === 'header') {
                    return { ...obj, x: 0, y: 0, width: page.width };
                }
                if (obj.type === 'footer') {
                    return { ...obj, x: 0, y: Math.max(0, page.height - obj.height), width: page.width };
                }
                return obj;
            }),
            canvasSettings: {
                ...DEFAULT_CANVAS_SETTINGS,
                ...incoming,
                zoom,
                width: page.width,
                height: page.height,
                page,
            },
            reportMetadata,
            parameters: data.parameters || [],
            selectedIds: [],
            isDirty: false,
        };
    }),

    // Parameter actions
    addParameter: (type) => set((state) => {
        const paramCount = state.parameters.length;
        const newParam: ReportParameter = {
            id: uuidv4(),
            name: `param${paramCount + 1}`,
            type,
            required: false,
            label: `Parameter ${paramCount + 1}`,
        };
        return {
            parameters: [...state.parameters, newParam],
            isDirty: true,
        };
    }),

    updateParameter: (id, updates) => set((state) => ({
        parameters: state.parameters.map((param) =>
            param.id === id ? { ...param, ...updates } : param
        ),
        isDirty: true,
    })),

    removeParameter: (id) => set((state) => ({
        parameters: state.parameters.filter((param) => param.id !== id),
        isDirty: true,
    })),

    setParameterValue: (id, value) => set((state) => ({
        parameters: state.parameters.map((param) =>
            param.id === id ? { ...param, value } : param
        ),
        isDirty: true,
    })),
}));
