import {
    Grid, MousePointer2, AlignLeft, AlignRight, AlignCenterHorizontal, AlignCenterVertical,
    AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, RectangleHorizontal, RectangleVertical,
    Save, Upload,
    Maximize2, ChevronDown, Settings
} from 'lucide-react';
import { useReportStore } from '../../hooks/useReportStore';
import { useState, useRef, useEffect } from 'react';
import type { AlignmentType } from '../../hooks/useReportStore';
import type { PageSettings } from '../../types';
import { PAGE_PRESETS_PX } from '../../utils/constants';
const ZOOM_PRESETS: { label: string; value: number }[] = [
    { label: '50%', value: 0.5 },
    { label: '75%', value: 0.75 },
    { label: '100%', value: 1 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 },
];

export const Toolbar = () => {
    const { canvasSettings, updateCanvasSettings, selectedIds, alignObjects, newReport, saveReport, saveReportAs, loadReport, loadReportFromFileSystem, setReportFileHandle, setReportFileName, reportFileHandle, reportFileName, isDirty } = useReportStore();
    const [showPageSetup, setShowPageSetup] = useState(false);
    const [showSaveMenu, setShowSaveMenu] = useState(false);
    const [showZoomDropdown, setShowZoomDropdown] = useState(false);
    const [showSavedToast, setShowSavedToast] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pageSetupRef = useRef<HTMLDivElement>(null);
    const saveMenuRef = useRef<HTMLDivElement>(null);
    const zoomDropdownRef = useRef<HTMLDivElement>(null);

    const applyPageSettings = (partial: Partial<PageSettings>) => {
        const current = canvasSettings.page;
        const nextRaw: PageSettings = { ...current, ...partial };

        const presetKey = nextRaw.preset === 'A4' || nextRaw.preset === 'Letter' ? nextRaw.preset : null;
        const presetSize = presetKey ? PAGE_PRESETS_PX[presetKey] : undefined;

        const baseWidth = presetSize ? presetSize.width : nextRaw.width;
        const baseHeight = presetSize ? presetSize.height : nextRaw.height;

        const w = typeof baseWidth === 'number' ? baseWidth : current.width;
        const h = typeof baseHeight === 'number' ? baseHeight : current.height;

        const orientation = nextRaw.orientation === 'landscape' ? 'landscape' : 'portrait';
        const width = orientation === 'landscape' ? Math.max(w, h) : Math.min(w, h);
        const height = orientation === 'landscape' ? Math.min(w, h) : Math.max(w, h);

        const margins = {
            top: Math.max(0, Number(nextRaw.margins?.top ?? current.margins.top)),
            right: Math.max(0, Number(nextRaw.margins?.right ?? current.margins.right)),
            bottom: Math.max(0, Number(nextRaw.margins?.bottom ?? current.margins.bottom)),
            left: Math.max(0, Number(nextRaw.margins?.left ?? current.margins.left)),
        };

        const page: PageSettings = {
            preset: (presetKey ? presetKey : 'Custom'),
            orientation,
            width,
            height,
            margins,
        };

        updateCanvasSettings({ page, width: page.width, height: page.height });
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (target) {
                if (showPageSetup && pageSetupRef.current?.contains(target)) return;
                if (showSaveMenu && saveMenuRef.current?.contains(target)) return;
                if (showZoomDropdown && zoomDropdownRef.current?.contains(target)) return;
            }
            setShowPageSetup(false);
            setShowSaveMenu(false);
            setShowZoomDropdown(false);
        };

        if (showPageSetup || showSaveMenu || showZoomDropdown) {
            // Use setTimeout to avoid closing immediately on the same click
            const timer = setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 0);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('click', handleClickOutside);
            };
        }
    }, [showPageSetup, showSaveMenu, showZoomDropdown]);

    const handleAlign = (type: AlignmentType) => {
        alignObjects(type);
    };

    const showSavedConfirmation = () => {
        setShowSavedToast(true);
        window.setTimeout(() => setShowSavedToast(false), 1500);
    };

    useEffect(() => {
        const base = 'ReportMaker';
        const name = reportFileName ? reportFileName : 'Untitled';
        const dirty = isDirty ? ' *' : '';
        document.title = `${base} - ${name}${dirty}`;
    }, [reportFileName, isDirty]);

    const handleSave = async () => {
        const ok = await saveReport();
        if (ok) showSavedConfirmation();
    };

    const handleSaveAs = async () => {
        const ok = await saveReportAs();
        if (ok) showSavedConfirmation();
    };

    const canSaveAs = !!reportFileHandle && isDirty;

    const handleLoadClick = () => {
        const hasFileSystemAccessApi = typeof (window as any).showOpenFilePicker === 'function';
        if (hasFileSystemAccessApi) {
            loadReportFromFileSystem();
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Loading via plain file input cannot preserve a writable file handle
        setReportFileHandle(null);
        setReportFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                loadReport(data);
            } catch (error) {
                console.error('Failed to load report:', error);
                alert('Failed to load report. Please check the file format.');
            }
        };
        reader.readAsText(file);

        // Reset input so the same file can be loaded again
        e.target.value = '';
    };

    const isMultipleSelected = selectedIds.length >= 2;

    return (
        <div className="bg-white border-b border-gray-200 shadow-sm z-10 relative">
            {showSavedToast && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded shadow">
                    Saved
                </div>
            )}

            <div className="h-12 flex items-center px-4 gap-4">
                <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
                    <span className="font-bold text-lg text-blue-600">ReportMaker</span>
                    <span className="text-xs text-gray-500">{reportFileName || 'Untitled'}{isDirty ? ' *' : ''}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => updateCanvasSettings({ showGrid: !canvasSettings.showGrid })}
                        className={`p-2 rounded hover:bg-gray-100 ${canvasSettings.showGrid ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                        title="Toggle Grid"
                    >
                        <Grid size={18} />
                    </button>

                    <button
                        onClick={() => updateCanvasSettings({ snapToGrid: !canvasSettings.snapToGrid })}
                        className={`p-2 rounded hover:bg-gray-100 ${canvasSettings.snapToGrid ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                        title="Snap to Grid"
                    >
                        <MousePointer2 size={18} />
                    </button>

                    <div className="relative" ref={zoomDropdownRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setShowZoomDropdown(v => !v);
                                setShowPageSetup(false);
                                setShowSaveMenu(false);
                            }}
                            className={`flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm ${showZoomDropdown ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                            title="Zoom"
                        >
                            <Maximize2 size={14} />
                            <span>{Math.round((canvasSettings.zoom ?? 1) * 100)}%</span>
                            <ChevronDown size={14} />
                        </button>
                        {showZoomDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[110px] overflow-hidden">
                                {ZOOM_PRESETS.map(z => (
                                    <button
                                        key={z.value}
                                        type="button"
                                        onClick={() => {
                                            updateCanvasSettings({ zoom: z.value });
                                            setShowZoomDropdown(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 hover:bg-blue-50 text-sm ${Math.abs((canvasSettings.zoom ?? 1) - z.value) < 0.001 ? 'bg-blue-100 text-blue-700' : ''}`}
                                    >
                                        {z.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={pageSetupRef}>
                        <button
                            onClick={() => { setShowPageSetup(!showPageSetup); }}
                            className={`p-2 rounded hover:bg-gray-100 ${showPageSetup ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                            title="Page Setup"
                        >
                            <Settings size={18} />
                        </button>
                        {showPageSetup && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-[320px] p-3">
                                <div className="text-sm font-semibold text-gray-700 mb-2">Page setup</div>

                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Preset
                                        <select
                                            value={canvasSettings.page.preset}
                                            onChange={(e) => applyPageSettings({ preset: e.target.value as PageSettings['preset'] })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                        >
                                            <option value="A4">A4</option>
                                            <option value="Letter">Letter</option>
                                            <option value="Custom">Custom</option>
                                        </select>
                                    </label>

                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Orientation
                                        <select
                                            value={canvasSettings.page.orientation}
                                            onChange={(e) => applyPageSettings({ orientation: e.target.value as PageSettings['orientation'] })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                        >
                                            <option value="portrait">Portrait</option>
                                            <option value="landscape">Landscape</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Width (px)
                                        <input
                                            type="number"
                                            value={canvasSettings.page.width}
                                            onChange={(e) => applyPageSettings({ preset: 'Custom', width: parseInt(e.target.value) || canvasSettings.page.width })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            min={100}
                                            disabled={canvasSettings.page.preset !== 'Custom'}
                                        />
                                    </label>
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Height (px)
                                        <input
                                            type="number"
                                            value={canvasSettings.page.height}
                                            onChange={(e) => applyPageSettings({ preset: 'Custom', height: parseInt(e.target.value) || canvasSettings.page.height })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            min={100}
                                            disabled={canvasSettings.page.preset !== 'Custom'}
                                        />
                                    </label>
                                </div>

                                <div className="text-xs font-semibold text-gray-700 mt-3">Margins (px)</div>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Top
                                        <input
                                            type="number"
                                            value={canvasSettings.page.margins.top}
                                            onChange={(e) => applyPageSettings({ margins: { ...canvasSettings.page.margins, top: parseInt(e.target.value) || 0 } })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            min={0}
                                        />
                                    </label>
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Right
                                        <input
                                            type="number"
                                            value={canvasSettings.page.margins.right}
                                            onChange={(e) => applyPageSettings({ margins: { ...canvasSettings.page.margins, right: parseInt(e.target.value) || 0 } })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            min={0}
                                        />
                                    </label>
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Bottom
                                        <input
                                            type="number"
                                            value={canvasSettings.page.margins.bottom}
                                            onChange={(e) => applyPageSettings({ margins: { ...canvasSettings.page.margins, bottom: parseInt(e.target.value) || 0 } })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            min={0}
                                        />
                                    </label>
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        Left
                                        <input
                                            type="number"
                                            value={canvasSettings.page.margins.left}
                                            onChange={(e) => applyPageSettings({ margins: { ...canvasSettings.page.margins, left: parseInt(e.target.value) || 0 } })}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            min={0}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                    <button
                        onClick={() => handleAlign('left')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Align Left"
                    >
                        <AlignLeft size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('center-horizontal')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Center Horizontal"
                    >
                        <AlignCenterHorizontal size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('right')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Align Right"
                    >
                        <AlignRight size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('top')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Align Top"
                    >
                        <AlignCenterVertical size={18} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button
                        onClick={() => handleAlign('center-vertical')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Center Vertical"
                    >
                        <AlignCenterVertical size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('bottom')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Align Bottom"
                    >
                        <AlignCenterVertical size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                    <button
                        onClick={() => handleAlign('distribute-horizontal')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Distribute Horizontal"
                    >
                        <AlignHorizontalJustifyCenter size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('distribute-vertical')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Distribute Vertical"
                    >
                        <AlignVerticalJustifyCenter size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('same-width')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Same Width"
                    >
                        <RectangleHorizontal size={18} />
                    </button>
                    <button
                        onClick={() => handleAlign('same-height')}
                        disabled={!isMultipleSelected}
                        className={`p-2 rounded hover:bg-gray-100 ${!isMultipleSelected ? 'opacity-30 cursor-not-allowed' : 'text-gray-600'}`}
                        title="Same Height"
                    >
                        <RectangleVertical size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                    <div className="relative" ref={saveMenuRef}>
                        <div className="flex">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isDirty) {
                                        const ok = window.confirm('Start a new report? Unsaved changes will be lost.');
                                        if (!ok) return;
                                    }
                                    newReport();
                                    setShowSaveMenu(false);
                                    setShowPageSetup(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium mr-2"
                                title="New Report"
                            >
                                New
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-l hover:bg-green-700 transition-colors text-sm font-medium"
                                title="Save Report"
                            >
                                <Save size={16} />
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setShowSaveMenu(!showSaveMenu);
                                    setShowPageSetup(false);
                                }}
                                className="px-2 py-1.5 bg-green-600 text-white rounded-r hover:bg-green-700 transition-colors"
                                title="Save options"
                                type="button"
                            >
                                <ChevronDown size={16} />
                            </button>
                        </div>

                        {showSaveMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] overflow-hidden">
                                <button
                                    type="button"
                                    disabled={!canSaveAs}
                                    onClick={() => {
                                        if (!canSaveAs) return;
                                        handleSaveAs();
                                        setShowSaveMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm ${canSaveAs ? 'hover:bg-gray-50 text-gray-700' : 'text-gray-400 cursor-not-allowed'}`}
                                    title={canSaveAs ? 'Save report to a new file' : 'Save As is available only after the report has been saved/loaded and has unsaved changes'}
                                >
                                    Save As...
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLoadClick}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
                        title="Load Report"
                    >
                        <Upload size={16} />
                        Load
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>

                <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                    <span>Grid Size:</span>
                    <input
                        type="number"
                        value={canvasSettings.gridSize}
                        onChange={(e) => updateCanvasSettings({ gridSize: Math.max(5, parseInt(e.target.value) || 20) })}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <span>px</span>
                </div>
            </div>

        </div>
    );
};
