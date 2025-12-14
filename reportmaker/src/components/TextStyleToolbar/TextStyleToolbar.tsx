import { useEffect, useRef, useState } from 'react';
import {
    Type,
    ChevronDown,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Square,
    Maximize2,
} from 'lucide-react';
import { useReportStore } from '../../hooks/useReportStore';

const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Helvetica', 'Georgia', 'Trebuchet MS'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

export const TextStyleToolbar = () => {
    const { selectedIds, selectedTableHeader, reportObjects, updateObjectProperties } = useReportStore();

    const [showFontDropdown, setShowFontDropdown] = useState(false);
    const [showSizeDropdown, setShowSizeDropdown] = useState(false);
    const [fontDropdownPos, setFontDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const [sizeDropdownPos, setSizeDropdownPos] = useState<{ top: number; left: number } | null>(null);

    const fontDropdownRef = useRef<HTMLDivElement>(null);
    const sizeDropdownRef = useRef<HTMLDivElement>(null);
    const fontButtonRef = useRef<HTMLButtonElement>(null);
    const sizeButtonRef = useRef<HTMLButtonElement>(null);

    const selectedTextObject = selectedIds.length === 1
        ? reportObjects.find(obj => obj.id === selectedIds[0] && obj.type === 'text')
        : null;

    const selectedTableObject = selectedIds.length === 1
        ? reportObjects.find(obj => obj.id === selectedIds[0] && obj.type === 'table')
        : null;

    const isTableHeaderStyleTarget = !!(
        selectedTableObject &&
        selectedTableHeader &&
        selectedTableHeader.tableId === selectedTableObject.id
    );

    const effectiveTextStyle = (() => {
        if (selectedTextObject) return selectedTextObject.properties;
        if (!isTableHeaderStyleTarget || !selectedTableObject || !selectedTableHeader) return null;
        const base = selectedTableObject.properties.tableHeaderStyle || {};
        if (selectedTableHeader.column === null) return base;
        const cell = (selectedTableObject.properties.tableHeaderCellStyles || {})[selectedTableHeader.column] || {};
        return { ...base, ...cell };
    })();

    const updateTextProperty = (key: string, value: any) => {
        if (selectedTextObject) {
            updateObjectProperties(selectedTextObject.id, { [key]: value });
            return;
        }
        if (!isTableHeaderStyleTarget || !selectedTableObject || !selectedTableHeader) return;

        if (selectedTableHeader.column === null) {
            const current = selectedTableObject.properties.tableHeaderStyle || {};
            const cellStyles = selectedTableObject.properties.tableHeaderCellStyles || {};
            let nextCellStyles = cellStyles;

            if (cellStyles && Object.keys(cellStyles).length > 0) {
                const updated: Record<string, any> = { ...cellStyles };
                Object.entries(cellStyles).forEach(([col, style]) => {
                    if (!style || typeof style !== 'object') return;
                    if (!(key in style)) return;

                    const { [key]: _removed, ...rest } = style as any;
                    if (Object.keys(rest).length === 0) {
                        delete updated[col];
                    } else {
                        updated[col] = rest;
                    }
                });
                nextCellStyles = updated;
            }

            updateObjectProperties(selectedTableObject.id, {
                tableHeaderStyle: {
                    ...current,
                    [key]: value,
                },
                tableHeaderCellStyles: nextCellStyles,
            });
            return;
        }

        const col = selectedTableHeader.column;
        const cellStyles = selectedTableObject.properties.tableHeaderCellStyles || {};
        const currentCell = cellStyles[col] || {};
        updateObjectProperties(selectedTableObject.id, {
            tableHeaderCellStyles: {
                ...cellStyles,
                [col]: {
                    ...currentCell,
                    [key]: value,
                }
            }
        });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (target) {
                if (showFontDropdown && fontDropdownRef.current?.contains(target)) return;
                if (showSizeDropdown && sizeDropdownRef.current?.contains(target)) return;
            }
            setShowFontDropdown(false);
            setShowSizeDropdown(false);
        };

        if (showFontDropdown || showSizeDropdown) {
            const timer = setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 0);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('click', handleClickOutside);
            };
        }
    }, [showFontDropdown, showSizeDropdown]);

    useEffect(() => {
        if (!effectiveTextStyle) {
            setShowFontDropdown(false);
            setShowSizeDropdown(false);
        }
    }, [effectiveTextStyle]);

    const disabled = !effectiveTextStyle;

    const computeDropdownPos = (buttonEl: HTMLElement, popupWidth: number) => {
        const rect = buttonEl.getBoundingClientRect();
        const approxHeight = 280;
        const margin = 8;

        let left = rect.right + margin;
        if (left + popupWidth + margin > window.innerWidth) {
            left = rect.left - popupWidth - margin;
        }
        left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

        let top = rect.top;
        top = Math.max(margin, Math.min(top, window.innerHeight - approxHeight - margin));

        return { top, left };
    };

    return (
        <div className="w-16 bg-white border-r border-gray-200 h-full flex flex-col items-center py-2 gap-2 overflow-y-auto">
            <div className="w-full flex flex-col items-center gap-1 px-2">
                <div className="text-[10px] text-gray-500 text-center leading-tight">
                    Text
                </div>
                <div className="text-[10px] text-gray-400 text-center leading-tight">
                    Style
                </div>
            </div>

            <div className="w-full h-px bg-gray-200" />

            <div className="relative w-full flex justify-center" ref={fontDropdownRef}>
                <button
                    type="button"
                    ref={fontButtonRef}
                    disabled={disabled}
                    onClick={() => {
                        if (disabled) return;
                        setShowFontDropdown(v => {
                            const next = !v;
                            if (next && fontButtonRef.current) {
                                setFontDropdownPos(computeDropdownPos(fontButtonRef.current, 160));
                            }
                            return next;
                        });
                        setShowSizeDropdown(false);
                    }}
                    className={`w-12 h-10 flex flex-col items-center justify-center gap-0.5 rounded border ${disabled ? 'opacity-30 cursor-not-allowed border-gray-200' : 'hover:bg-gray-50 border-gray-200'} ${showFontDropdown ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                    title="Font Family"
                >
                    <Type size={16} />
                    <ChevronDown size={12} />
                </button>
                {showFontDropdown && effectiveTextStyle && (
                    <div
                        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] max-h-64 overflow-y-auto"
                        style={{ top: fontDropdownPos?.top ?? 0, left: fontDropdownPos?.left ?? 0 }}
                    >
                        {FONT_FAMILIES.map(font => (
                            <button
                                key={font}
                                type="button"
                                onClick={() => {
                                    updateTextProperty('fontFamily', font);
                                    setShowFontDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 text-sm ${effectiveTextStyle.fontFamily === font ? 'bg-blue-100 text-blue-700' : ''}`}
                                style={{ fontFamily: font }}
                            >
                                {font}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative w-full flex justify-center" ref={sizeDropdownRef}>
                <button
                    type="button"
                    ref={sizeButtonRef}
                    disabled={disabled}
                    onClick={() => {
                        if (disabled) return;
                        setShowSizeDropdown(v => {
                            const next = !v;
                            if (next && sizeButtonRef.current) {
                                setSizeDropdownPos(computeDropdownPos(sizeButtonRef.current, 90));
                            }
                            return next;
                        });
                        setShowFontDropdown(false);
                    }}
                    className={`w-12 h-10 flex flex-col items-center justify-center gap-0.5 rounded border ${disabled ? 'opacity-30 cursor-not-allowed border-gray-200' : 'hover:bg-gray-50 border-gray-200'} ${showSizeDropdown ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                    title="Font Size"
                >
                    <div className="text-xs font-semibold">{(effectiveTextStyle?.fontSize || 16)}px</div>
                    <ChevronDown size={12} />
                </button>
                {showSizeDropdown && effectiveTextStyle && (
                    <div
                        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[90px] max-h-64 overflow-y-auto"
                        style={{ top: sizeDropdownPos?.top ?? 0, left: sizeDropdownPos?.left ?? 0 }}
                    >
                        {FONT_SIZES.map(size => (
                            <button
                                key={size}
                                type="button"
                                onClick={() => {
                                    updateTextProperty('fontSize', size);
                                    setShowSizeDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 text-sm ${effectiveTextStyle.fontSize === size ? 'bg-blue-100 text-blue-700' : ''}`}
                            >
                                {size}px
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-full h-px bg-gray-200" />

            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('bold', !(effectiveTextStyle?.bold ?? false))}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${(effectiveTextStyle?.bold ?? false) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Bold"
            >
                <Bold size={18} />
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('italic', !(effectiveTextStyle?.italic ?? false))}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${(effectiveTextStyle?.italic ?? false) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Italic"
            >
                <Italic size={18} />
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('underline', !(effectiveTextStyle?.underline ?? false))}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${(effectiveTextStyle?.underline ?? false) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Underline"
            >
                <Underline size={18} />
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('strikeThrough', !(effectiveTextStyle?.strikeThrough ?? false))}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${(effectiveTextStyle?.strikeThrough ?? false) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Strikethrough"
            >
                <Strikethrough size={18} />
            </button>

            <div className="w-full h-px bg-gray-200" />

            <div className="w-full flex flex-col items-center gap-2">
                <div className="flex flex-col items-center" title="Text Color">
                    <input
                        disabled={disabled}
                        type="color"
                        value={effectiveTextStyle?.color || '#000000'}
                        onChange={(e) => updateTextProperty('color', e.target.value)}
                        className="w-10 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                    />
                    <div className="text-[10px] text-gray-500 mt-0.5">Text</div>
                </div>
                <div className="flex flex-col items-center" title="Background Color">
                    <input
                        disabled={disabled}
                        type="color"
                        value={effectiveTextStyle?.backgroundColor || '#ffffff'}
                        onChange={(e) => updateTextProperty('backgroundColor', e.target.value)}
                        className="w-10 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                    />
                    <div className="text-[10px] text-gray-500 mt-0.5">Bg</div>
                </div>
            </div>

            <div className="w-full h-px bg-gray-200" />

            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('textAlign', 'left')}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${effectiveTextStyle?.textAlign === 'left' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Align Left"
            >
                <AlignLeft size={18} />
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('textAlign', 'center')}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${effectiveTextStyle?.textAlign === 'center' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Align Center"
            >
                <AlignCenter size={18} />
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => updateTextProperty('textAlign', 'right')}
                className={`w-12 h-10 flex items-center justify-center rounded ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'} ${effectiveTextStyle?.textAlign === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                title="Align Right"
            >
                <AlignRight size={18} />
            </button>

            <div className="w-full h-px bg-gray-200" />

            <div className="w-full flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center gap-1" title="Border Width">
                    <Square size={16} className="text-gray-500" />
                    <input
                        type="number"
                        value={effectiveTextStyle?.borderWidth || 0}
                        onChange={(e) => updateTextProperty('borderWidth', parseInt(e.target.value) || 0)}
                        className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center"
                        min="0"
                        max="20"
                        disabled={disabled}
                    />
                </div>

                <div className="flex flex-col items-center" title="Border Color">
                    <input
                        disabled={disabled}
                        type="color"
                        value={effectiveTextStyle?.borderColor || '#000000'}
                        onChange={(e) => updateTextProperty('borderColor', e.target.value)}
                        className="w-10 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                    />
                    <div className="text-[10px] text-gray-500 mt-0.5">Border</div>
                </div>

                <div className="w-full flex flex-col items-center gap-1" title="Padding">
                    <Maximize2 size={16} className="text-gray-500" />
                    <input
                        type="number"
                        value={effectiveTextStyle?.padding || 0}
                        onChange={(e) => updateTextProperty('padding', parseInt(e.target.value) || 0)}
                        className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center"
                        min="0"
                        max="50"
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};
