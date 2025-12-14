import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useReportStore } from '../../hooks/useReportStore';
import { api } from '../../services/api';
import type { PageSettings } from '../../types';
import { generateBarcodeDataUrl } from '../../utils/barcode';
import { substituteParameters } from '../../utils/parameterSubstitution';
import { PAGE_PRESETS_PX } from '../../utils/constants';

const PropertyGroup = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const storageKey = `reportmaker.properties.group.${title}`;
    const [open, setOpen] = useState<boolean>(() => {
        try {
            const raw = sessionStorage.getItem(storageKey);
            if (raw === null) return true;
            return raw === '1';
        } catch {
            return true;
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(storageKey, open ? '1' : '0');
        } catch {
            // ignore
        }
    }, [open, storageKey]);

    return (
        <div className="mb-4 border-b border-gray-200 pb-4 last:border-0">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between text-left mb-3"
                aria-expanded={open}
            >
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
                <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                />
            </button>

            {open && (
                <div className="space-y-3">
                    {children}
                </div>
            )}
        </div>
    );
};

const getSqlRestSourceName = (dataSource: any): string => {
    return dataSource?.name || dataSource?.tableName || '';
};

const getSqlRestDisplayName = (dataSource: any): string => {
    if (!dataSource) return '';
    const sourceType = dataSource?.sourceType;
    if (sourceType === 'query') return 'Query';
    return getSqlRestSourceName(dataSource);
};

const splitFullName = (fullName: string): { schema: string; name: string } => {
    if (!fullName) return { schema: 'dbo', name: '' };
    if (fullName.includes('.')) {
        const [schema, name] = fullName.split('.');
        return { schema: schema || 'dbo', name: name || '' };
    }
    return { schema: 'dbo', name: fullName };
};

const NumberInput = ({ label, value, onChange, min = 0, max, step = 1 }: any) => (
    <div className="flex items-center justify-between">
        <label className="text-sm text-gray-600">{label}</label>
        <input
            type="number"
            value={value || 0}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
            min={min}
            max={max}
            step={step}
        />
    </div>
);

const ColorInput = ({ label, value, onChange }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">{label}</label>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();

                        // Try to keep the picker within the viewport by placing the input near the swatch,
                        // but nudging left if we're close to the right edge.
                        const approxPickerWidth = 300;
                        const left = Math.max(8, Math.min(rect.left, window.innerWidth - approxPickerWidth));
                        const top = Math.max(8, Math.min(rect.top, window.innerHeight - 40));

                        if (inputRef.current) {
                            inputRef.current.style.left = `${left}px`;
                            inputRef.current.style.top = `${top}px`;
                            inputRef.current.click();
                        }
                    }}
                    className="w-8 h-8 border border-gray-300 rounded"
                    style={{ backgroundColor: value || '#000000' }}
                />
                <input
                    ref={inputRef}
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                    className="fixed opacity-0 w-1 h-1 pointer-events-none"
                />
                <span className="text-xs text-gray-500 font-mono">{value}</span>
            </div>
        </div>
    );
};

const TextInput = ({ label, value, onChange }: any) => (
    <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-600">{label}</label>
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
    </div>
);

const SelectInput = ({ label, value, onChange, options }: any) => (
    <div className="flex items-center justify-between">
        <label className="text-sm text-gray-600">{label}</label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        >
            {options.map((opt: string) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </div>
);

const TableColumnManager = ({ selectedObject, updateObjectProperties }: any) => {
    const currentColumns: string[] = selectedObject?.properties?.columns || [];
    const currentWidths: Record<string, number | null> = selectedObject?.properties?.columnWidths || {};
    const currentHeaderCellStyles: Record<string, any> = selectedObject?.properties?.tableHeaderCellStyles || {};

    const [newColumnName, setNewColumnName] = useState('');
    const [draftNames, setDraftNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const next: Record<string, string> = {};
        for (const c of currentColumns) next[c] = c;
        setDraftNames(next);
        setNewColumnName('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedObject?.id]);

    const commitColumns = (nextColumns: string[], nextWidths: Record<string, number | null>, nextHeaderCellStyles: Record<string, any>) => {
        updateObjectProperties(selectedObject.id, {
            columns: nextColumns,
            columnWidths: nextWidths,
            tableHeaderCellStyles: nextHeaderCellStyles,
        });
    };

    const addColumn = () => {
        const name = newColumnName.trim();
        if (!name) return;
        if (currentColumns.includes(name)) return;

        const nextColumns = [...currentColumns, name];
        const nextWidths = { ...currentWidths };
        const nextHeaderCellStyles = { ...currentHeaderCellStyles };

        commitColumns(nextColumns, nextWidths, nextHeaderCellStyles);
        setDraftNames(prev => ({ ...prev, [name]: name }));
        setNewColumnName('');
    };

    const removeColumn = (col: string) => {
        const nextColumns = currentColumns.filter(c => c !== col);
        const nextWidths = { ...currentWidths };
        const nextHeaderCellStyles = { ...currentHeaderCellStyles };
        delete nextWidths[col];
        delete nextHeaderCellStyles[col];
        commitColumns(nextColumns, nextWidths, nextHeaderCellStyles);
    };

    const renameColumn = (from: string, toRaw: string) => {
        const to = toRaw.trim();
        if (!to) return;
        if (to === from) return;
        if (currentColumns.includes(to)) return;

        const nextColumns = currentColumns.map(c => (c === from ? to : c));
        const nextWidths = { ...currentWidths };
        const nextHeaderCellStyles = { ...currentHeaderCellStyles };

        if (Object.prototype.hasOwnProperty.call(nextWidths, from)) {
            nextWidths[to] = nextWidths[from];
            delete nextWidths[from];
        }

        if (Object.prototype.hasOwnProperty.call(nextHeaderCellStyles, from)) {
            nextHeaderCellStyles[to] = nextHeaderCellStyles[from];
            delete nextHeaderCellStyles[from];
        }

        commitColumns(nextColumns, nextWidths, nextHeaderCellStyles);
    };

    const setWidthMode = (col: string, mode: 'auto' | 'fixed') => {
        const nextWidths = { ...currentWidths };
        if (mode === 'auto') {
            nextWidths[col] = null;
        } else {
            const current = nextWidths[col];
            nextWidths[col] = typeof current === 'number' && isFinite(current) && current > 0 ? current : 120;
        }
        commitColumns(currentColumns, nextWidths, currentHeaderCellStyles);
    };

    const setFixedWidth = (col: string, width: number) => {
        const nextWidths = { ...currentWidths };
        nextWidths[col] = Math.max(20, Math.floor(width));
        commitColumns(currentColumns, nextWidths, currentHeaderCellStyles);
    };

    return (
        <PropertyGroup title="Table Layout">
            <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-600">Columns</label>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="New column name"
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <button
                        type="button"
                        onClick={addColumn}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                        Add
                    </button>
                </div>

                {currentColumns.length === 0 ? (
                    <div className="text-xs text-gray-400">No columns yet.</div>
                ) : (
                    <div className="space-y-2">
                        {currentColumns.map((col) => {
                            const widthValue = currentWidths[col];
                            const widthMode: 'auto' | 'fixed' = typeof widthValue === 'number' ? 'fixed' : 'auto';

                            return (
                                <div key={col} className="border border-gray-200 rounded p-2 bg-white">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={draftNames[col] ?? col}
                                            onChange={(e) => setDraftNames(prev => ({ ...prev, [col]: e.target.value }))}
                                            onBlur={() => renameColumn(col, (draftNames[col] ?? col))}
                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeColumn(col)}
                                            className="px-2 py-1 rounded border border-red-300 text-red-700 text-xs hover:bg-red-50"
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2">
                                        <label className="text-xs text-gray-500">Width</label>
                                        <select
                                            value={widthMode}
                                            onChange={(e) => setWidthMode(col, e.target.value as any)}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                                        >
                                            <option value="auto">Auto</option>
                                            <option value="fixed">Fixed</option>
                                        </select>

                                        {widthMode === 'fixed' && (
                                            <input
                                                type="number"
                                                min={20}
                                                max={2000}
                                                value={typeof widthValue === 'number' ? widthValue : 120}
                                                onChange={(e) => setFixedWidth(col, parseFloat(e.target.value) || 0)}
                                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                                            />
                                        )}
                                        {widthMode === 'fixed' && (
                                            <span className="text-xs text-gray-500">px</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </PropertyGroup>
    );
};

const DataRegionProperties = ({ selectedObject, updateObject, parameters, effectiveDataSource }: any) => {
    const [tables, setTables] = useState<string[]>([]);
    const [views, setViews] = useState<string[]>([]);
    const [procedures, setProcedures] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const ds = effectiveDataSource || selectedObject.properties.dataSource;
    const [sourceType, setSourceType] = useState<'table' | 'view' | 'storedProcedure' | 'query'>(
        ds?.sourceType || 'table'
    );
    const [selectedName, setSelectedName] = useState<string>(getSqlRestSourceName(ds));
    const [querySql, setQuerySql] = useState<string>(String(ds?.sql || ''));
    const [procedureParameters, setProcedureParameters] = useState<any[]>([]);
    const [procedureParamValues, setProcedureParamValues] = useState<Record<string, string>>(
        ds?.procedureParams || {}
    );

    useEffect(() => {
        const nextDs = effectiveDataSource || selectedObject.properties.dataSource;
        setSourceType(nextDs?.sourceType || 'table');
        setSelectedName(getSqlRestSourceName(nextDs));
        setProcedureParamValues(nextDs?.procedureParams || {});
        setQuerySql(String(nextDs?.sql || ''));
    }, [selectedObject?.id, effectiveDataSource]);

    useEffect(() => {
        const fetchSources = async () => {
            if (sourceType === 'query') {
                setTables([]);
                setViews([]);
                setProcedures([]);
                return;
            }
            setLoading(true);
            try {
                if (sourceType === 'table') {
                    const tableList = await api.getTables();
                    setTables(tableList);
                } else if (sourceType === 'view') {
                    const viewList = await api.getViews();
                    setViews(viewList);
                } else {
                    const procList = await api.getStoredProcedures();
                    setProcedures(procList);
                }
            } catch (error) {
                console.error('Failed to fetch sources:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSources();
    }, [sourceType]);

    useEffect(() => {
        const fetchProcedureParameters = async () => {
            if (sourceType !== 'storedProcedure') {
                setProcedureParameters([]);
                return;
            }
            if (!selectedName) {
                setProcedureParameters([]);
                return;
            }

            try {
                const { schema, name } = splitFullName(selectedName);
                const parameters = await api.getStoredProcedureParameters(schema, name);
                setProcedureParameters(parameters);
            } catch (e) {
                console.error(e);
                setProcedureParameters([]);
            }
        };

        fetchProcedureParameters();
    }, [sourceType, selectedName]);

    return (
        <PropertyGroup title="Data Source">
            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600">Type</label>
                <select
                    className="w-full p-2 border border-gray-300 rounded"
                    value={sourceType}
                    onChange={(e) => {
                        const nextType = e.target.value as any;
                        setSourceType(nextType);
                        setSelectedName('');
                        setProcedureParameters([]);
                        setProcedureParamValues({});
                    }}
                >
                    <option value="table">Table</option>
                    <option value="view">View</option>
                    <option value="storedProcedure">Stored Procedure</option>
                    <option value="query">Query</option>
                </select>
            </div>

            {sourceType !== 'query' ? (
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">
                        {sourceType === 'storedProcedure' ? 'Stored Procedure' : sourceType === 'view' ? 'View' : 'Table'}
                    </label>
                    {loading ? (
                        <div className="text-xs text-gray-400">Loading...</div>
                    ) : (
                        <select
                            className="w-full p-2 border border-gray-300 rounded"
                            value={selectedName || ''}
                            onChange={(e) => {
                                setSelectedName(e.target.value);
                            }}
                        >
                            <option value="">Select...</option>
                            {(sourceType === 'table' ? tables : sourceType === 'view' ? views : procedures).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">SQL</label>
                    <textarea
                        className="w-full p-2 border border-gray-300 rounded font-mono text-xs min-h-[140px]"
                        value={querySql}
                        onChange={(e) => setQuerySql(e.target.value)}
                        placeholder="SELECT ...\nFROM ...\nWHERE ..."
                    />
                    <div className="text-xs text-gray-500">Only single-statement SELECT / WITH queries are allowed.</div>
                </div>
            )}

            {sourceType === 'storedProcedure' && selectedName && procedureParameters.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                    <div className="text-sm text-gray-600">Parameters</div>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                        {procedureParameters.map((p: any) => {
                            const rawName = p.name || '';
                            const key = rawName.startsWith('@') ? rawName.substring(1) : rawName;
                            return (
                                <div key={rawName} className="flex items-center justify-between gap-2 mb-2">
                                    <div className="text-xs text-gray-700 truncate" title={`${rawName} (${p.type})`}>
                                        {rawName}
                                    </div>
                                    <input
                                        className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
                                        value={procedureParamValues[key] || ''}
                                        onChange={(e) => {
                                            const next = { ...procedureParamValues, [key]: e.target.value };
                                            setProcedureParamValues(next);
                                        }}
                                        placeholder={p.type}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <button
                type="button"
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                disabled={sourceType === 'query' ? !querySql.trim() : !selectedName}
                onClick={async () => {
                    if (sourceType === 'query') {
                        const resolvedSql = substituteParameters(String(querySql ?? ''), parameters);
                        if (!resolvedSql.trim()) return;

                        const response = await api.executeQuery(resolvedSql);
                        const data = response && response.data ? response.data : [];

                        updateObject(selectedObject.id, {
                            properties: {
                                ...selectedObject.properties,
                                dataSource: {
                                    type: 'sqlrest',
                                    sourceType,
                                    name: 'query',
                                    tableName: 'query',
                                    sql: querySql,
                                }
                            },
                            data: Array.isArray(data) ? data : []
                        });
                        return;
                    }

                    if (!selectedName) return;

                    if (sourceType === 'storedProcedure') {
                        const { schema, name } = splitFullName(selectedName);
                        const resolvedParams = Object.fromEntries(
                            Object.entries(procedureParamValues).map(([k, v]) => [
                                k,
                                substituteParameters(String(v ?? ''), parameters)
                            ])
                        ) as Record<string, string>;

                        const response = await api.executeStoredProcedure(schema, name, resolvedParams);
                        const resultSets = response?.resultSets || response?.ResultSets;
                        const data = Array.isArray(resultSets) && Array.isArray(resultSets[0]) ? resultSets[0] : [];

                        updateObject(selectedObject.id, {
                            properties: {
                                ...selectedObject.properties,
                                dataSource: {
                                    type: 'sqlrest',
                                    sourceType,
                                    name: selectedName,
                                    tableName: selectedName,
                                    procedureParams: procedureParamValues,
                                }
                            },
                            data: Array.isArray(data) ? data : []
                        });
                        return;
                    }

                    const response = await api.getData(selectedName);
                    const data = response && response.data ? response.data : [];

                    updateObject(selectedObject.id, {
                        properties: {
                            ...selectedObject.properties,
                            dataSource: {
                                type: 'sqlrest',
                                sourceType,
                                name: selectedName,
                                tableName: selectedName,
                            }
                        },
                        data: Array.isArray(data) ? data : []
                    });
                }}
            >
                Connect
            </button>

            {((sourceType === 'query' && querySql.trim()) || (sourceType !== 'query' && selectedName)) && (
                <div className="text-xs text-green-600 mt-2">
                    ✓ Selected: {sourceType === 'query' ? 'Query' : selectedName}
                </div>
            )}
        </PropertyGroup>
    );
};

export const PropertiesPanel = () => {
    const {
        selectedIds,
        reportObjects,
        updateObjectProperties,
        updateObject,
        canvasSettings,
        updateCanvasSettings,
        parameters,
        reportMetadata,
        setReportMetadata,
    } = useReportStore();

    const applyPageSettings = (partial: Partial<PageSettings>) => {
        const current = canvasSettings.page;
        const nextRaw: PageSettings = { ...current, ...partial };

        const presetKey: 'A4' | 'Letter' | null = nextRaw.preset === 'A4' || nextRaw.preset === 'Letter' ? nextRaw.preset : null;
        const presetSize = presetKey ? PAGE_PRESETS_PX[presetKey] : undefined;

        const baseWidth = presetSize ? presetSize.width : nextRaw.width;
        const baseHeight = presetSize ? presetSize.height : nextRaw.height;

        const w = typeof baseWidth === 'number' ? baseWidth : current.width;
        const h = typeof baseHeight === 'number' ? baseHeight : current.height;

        const orientation: PageSettings['orientation'] = nextRaw.orientation === 'landscape' ? 'landscape' : 'portrait';
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

    const selectedObject = selectedIds.length === 1 ? reportObjects.find(obj => obj.id === selectedIds[0]) : null;
    const imageFileInputRef = useRef<HTMLInputElement>(null);

    // Check if object is inside a Data Region
    const parentDataRegion = selectedObject ? reportObjects.find(obj => {
        if (obj.type !== 'dataRegion' || obj.id === selectedObject.id) return false;
        // Check if object's center point is within the DataRegion
        const objCenterX = selectedObject.x + selectedObject.width / 2;
        const objCenterY = selectedObject.y + selectedObject.height / 2;
        return objCenterX >= obj.x &&
            objCenterX <= obj.x + obj.width &&
            objCenterY >= obj.y &&
            objCenterY <= obj.y + obj.height;
    }) : undefined;

    const effectiveTableDataSource = (selectedObject?.type === 'table' || selectedObject?.type === 'datatable')
        ? (selectedObject.properties.dataSource || parentDataRegion?.properties.dataSource)
        : undefined;

    const [columns, setColumns] = useState<string[]>([]);
    const [loadingColumns, setLoadingColumns] = useState(false);

    useEffect(() => {
        const ds = (selectedObject?.type === 'table' || selectedObject?.type === 'datatable')
            ? effectiveTableDataSource
            : parentDataRegion?.properties.dataSource;
        const sourceName = getSqlRestSourceName(ds);

        if (ds && (sourceName || ds.sourceType === 'query')) {
            const fetchColumns = async () => {
                setLoadingColumns(true);
                try {
                    if (ds.sourceType === 'query') {
                        const rawSql = String(ds.sql || '');
                        const resolvedSql = substituteParameters(rawSql, parameters);
                        if (!resolvedSql.trim()) {
                            setColumns([]);
                            return;
                        }

                        const resultSets = await api.getQueryResultSchema(resolvedSql);
                        const cols = (resultSets[0] || []).map((c: any) => c.name);
                        setColumns(cols);
                    } else if (ds.sourceType === 'storedProcedure') {
                        const { schema, name } = splitFullName(sourceName);
                        const rawParams = ds.procedureParams || {};
                        const resolvedParams = Object.fromEntries(
                            Object.entries(rawParams).map(([k, v]) => [
                                k,
                                substituteParameters(String(v ?? ''), parameters)
                            ])
                        ) as Record<string, string>;
                        const resultSets = await api.getStoredProcedureResultSchema(schema, name, resolvedParams);
                        const cols = (resultSets[0] || []).map((c: any) => c.name);
                        setColumns(cols);
                    } else {
                        const cols = await api.getColumns(sourceName);
                        setColumns(cols);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingColumns(false);
                }
            };
            fetchColumns();
        } else {
            setColumns([]);
        }
    }, [
        selectedObject?.type,
        effectiveTableDataSource?.sourceType,
        effectiveTableDataSource?.name,
        effectiveTableDataSource?.tableName,
        effectiveTableDataSource?.sql,
        JSON.stringify(effectiveTableDataSource?.procedureParams || {}),
        parentDataRegion?.properties.dataSource?.sourceType,
        parentDataRegion?.properties.dataSource?.name,
        parentDataRegion?.properties.dataSource?.tableName,
        parentDataRegion?.properties.dataSource?.sql,
        JSON.stringify(parentDataRegion?.properties.dataSource?.procedureParams || {}),
        parameters,
    ]);

    if (selectedIds.length === 0) {
        return (
            <div className="w-full bg-white border-l border-gray-200 flex flex-col h-full">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Properties</h2>
                    <div className="text-xs text-blue-600 font-medium mt-1 uppercase">page</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <PropertyGroup title="Report">
                        <TextInput
                            label="Name"
                            value={reportMetadata.name}
                            onChange={(val: string) => setReportMetadata({ name: val })}
                        />
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-600">Description</label>
                            <textarea
                                value={reportMetadata.description}
                                onChange={(e) => setReportMetadata({ description: e.target.value })}
                                className="border border-gray-300 rounded px-2 py-1 text-sm min-h-[90px]"
                            />
                        </div>
                        <TextInput
                            label="Author"
                            value={reportMetadata.author}
                            onChange={(val: string) => setReportMetadata({ author: val })}
                        />
                    </PropertyGroup>

                    <PropertyGroup title="Page setup">
                        <SelectInput
                            label="Preset"
                            value={canvasSettings.page.preset}
                            onChange={(val: string) => applyPageSettings({ preset: val as PageSettings['preset'] })}
                            options={['A4', 'Letter', 'Custom']}
                        />
                        <SelectInput
                            label="Orientation"
                            value={canvasSettings.page.orientation}
                            onChange={(val: string) => applyPageSettings({ orientation: val as PageSettings['orientation'] })}
                            options={['portrait', 'landscape']}
                        />
                        <NumberInput
                            label="Width (px)"
                            value={canvasSettings.page.width}
                            onChange={(val: number) => applyPageSettings({ preset: 'Custom', width: Number.isFinite(val) ? Math.max(100, val) : canvasSettings.page.width })}
                            min={100}
                        />
                        <NumberInput
                            label="Height (px)"
                            value={canvasSettings.page.height}
                            onChange={(val: number) => applyPageSettings({ preset: 'Custom', height: Number.isFinite(val) ? Math.max(100, val) : canvasSettings.page.height })}
                            min={100}
                        />
                    </PropertyGroup>

                    <PropertyGroup title="Margins (px)">
                        <NumberInput
                            label="Top"
                            value={canvasSettings.page.margins.top}
                            onChange={(val: number) => applyPageSettings({ margins: { ...canvasSettings.page.margins, top: Number.isFinite(val) ? Math.max(0, val) : 0 } })}
                            min={0}
                        />
                        <NumberInput
                            label="Right"
                            value={canvasSettings.page.margins.right}
                            onChange={(val: number) => applyPageSettings({ margins: { ...canvasSettings.page.margins, right: Number.isFinite(val) ? Math.max(0, val) : 0 } })}
                            min={0}
                        />
                        <NumberInput
                            label="Bottom"
                            value={canvasSettings.page.margins.bottom}
                            onChange={(val: number) => applyPageSettings({ margins: { ...canvasSettings.page.margins, bottom: Number.isFinite(val) ? Math.max(0, val) : 0 } })}
                            min={0}
                        />
                        <NumberInput
                            label="Left"
                            value={canvasSettings.page.margins.left}
                            onChange={(val: number) => applyPageSettings({ margins: { ...canvasSettings.page.margins, left: Number.isFinite(val) ? Math.max(0, val) : 0 } })}
                            min={0}
                        />
                    </PropertyGroup>
                </div>
            </div>
        );
    }

    if (selectedIds.length > 1) {
        return (
            <div className="w-full bg-white border-l border-gray-200 flex flex-col h-full">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Properties</h2>
                    <div className="text-xs text-blue-600 font-medium mt-1">{selectedIds.length} objects selected</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <PropertyGroup title="Report">
                        <TextInput
                            label="Name"
                            value={reportMetadata.name}
                            onChange={(val: string) => setReportMetadata({ name: val })}
                        />
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-600">Description</label>
                            <textarea
                                value={reportMetadata.description}
                                onChange={(e) => setReportMetadata({ description: e.target.value })}
                                className="border border-gray-300 rounded px-2 py-1 text-sm min-h-[90px]"
                            />
                        </div>
                        <TextInput
                            label="Author"
                            value={reportMetadata.author}
                            onChange={(val: string) => setReportMetadata({ author: val })}
                        />
                    </PropertyGroup>

                    <div className="text-sm text-gray-500">
                        Multiple objects selected. Use alignment tools in the toolbar.
                    </div>
                </div>
            </div>
        );
    }

    if (!selectedObject) {
        return (
            <div className="w-full bg-gray-50 border-l border-gray-200 p-4 flex items-center justify-center text-gray-400 text-sm">
                Select an item to edit properties
            </div>
        );
    }

    const { properties } = selectedObject;

    return (
        <div className="w-full bg-white border-l border-gray-200 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-700">Properties</h2>
                <div className="text-xs text-gray-500 mt-1">ID: {selectedObject.id.slice(0, 8)}...</div>
                <div className="text-xs text-blue-600 font-medium mt-1 uppercase">{selectedObject.type}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <PropertyGroup title="Report">
                    <TextInput
                        label="Name"
                        value={reportMetadata.name}
                        onChange={(val: string) => setReportMetadata({ name: val })}
                    />
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-600">Description</label>
                        <textarea
                            value={reportMetadata.description}
                            onChange={(e) => setReportMetadata({ description: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm min-h-[90px]"
                        />
                    </div>
                    <TextInput
                        label="Author"
                        value={reportMetadata.author}
                        onChange={(val: string) => setReportMetadata({ author: val })}
                    />
                </PropertyGroup>

                {parentDataRegion && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                        Inside Data Region: <strong>{getSqlRestDisplayName(parentDataRegion.properties.dataSource) || 'Unconfigured'}</strong>
                    </div>
                )}

                <PropertyGroup title="Layout">
                    <NumberInput
                        label="X Position"
                        value={selectedObject.x}
                        onChange={(val: number) => updateObject(selectedObject.id, { x: val })}
                    />
                    <NumberInput
                        label="Y Position"
                        value={selectedObject.y}
                        onChange={(val: number) => updateObject(selectedObject.id, { y: val })}
                    />
                    <NumberInput
                        label="Width"
                        value={selectedObject.width}
                        onChange={(val: number) => updateObject(selectedObject.id, { width: val })}
                    />
                    <NumberInput
                        label="Height"
                        value={selectedObject.height}
                        onChange={(val: number) => updateObject(selectedObject.id, { height: val })}
                    />
                    <NumberInput
                        label="Rotation"
                        value={properties.rotation}
                        onChange={(val: number) => updateObjectProperties(selectedObject.id, { rotation: val })}
                        min={0}
                        max={360}
                    />
                </PropertyGroup>

                {selectedObject.type === 'text' && parentDataRegion && getSqlRestDisplayName(parentDataRegion.properties.dataSource) && (
                    <PropertyGroup title="Data Binding">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-600">Bind to Column</label>
                            {loadingColumns ? (
                                <div className="text-xs text-gray-400">Loading columns...</div>
                            ) : (
                                <select
                                    value={properties.dataBinding?.columnName || ''}
                                    onChange={(e) => {
                                        const col = e.target.value;
                                        if (col) {
                                            updateObjectProperties(selectedObject.id, {
                                                text: `[${col}]`,
                                                dataBinding: {
                                                    tableName: getSqlRestDisplayName(parentDataRegion.properties.dataSource),
                                                    columnName: col
                                                }
                                            });
                                        } else {
                                            updateObjectProperties(selectedObject.id, {
                                                text: 'Text',
                                                dataBinding: undefined
                                            });
                                        }
                                    }}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                                >
                                    <option value="">None</option>
                                    {columns.map((col) => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </PropertyGroup>
                )}

                {(selectedObject.type === 'table' || selectedObject.type === 'datatable') && (
                    <TableColumnManager
                        selectedObject={selectedObject}
                        updateObjectProperties={updateObjectProperties}
                    />
                )}

                {selectedObject.type === 'datatable' && (
                    <PropertyGroup title="DataTable">
                        <NumberInput
                            label="Header Height"
                            value={properties.dataTableHeaderHeight ?? 30}
                            onChange={(val: number) => updateObjectProperties(selectedObject.id, { dataTableHeaderHeight: Math.max(10, Math.floor(val)) })}
                            min={10}
                            max={300}
                        />
                        <NumberInput
                            label="Row Height"
                            value={properties.dataTableRowHeight ?? 30}
                            onChange={(val: number) => updateObjectProperties(selectedObject.id, { dataTableRowHeight: Math.max(10, Math.floor(val)) })}
                            min={10}
                            max={300}
                        />

                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-600">Totals Row</label>
                            <input
                                type="checkbox"
                                checked={!!properties.dataTableTotalsRow?.enabled}
                                onChange={(e) => updateObjectProperties(selectedObject.id, {
                                    dataTableTotalsRow: {
                                        enabled: e.target.checked,
                                        aggregations: properties.dataTableTotalsRow?.aggregations || {},
                                    }
                                })}
                            />
                        </div>

                        {!!properties.dataTableTotalsRow?.enabled && (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-600">Aggregations</label>
                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
                                    {(properties.columns || []).length === 0 ? (
                                        <div className="text-xs text-gray-400">Select columns first.</div>
                                    ) : (
                                        (properties.columns || []).map((col) => {
                                            const currentAgg = properties.dataTableTotalsRow?.aggregations?.[col] || '';
                                            return (
                                                <div key={col} className="flex items-center justify-between gap-2">
                                                    <div className="text-xs text-gray-700 truncate" title={col}>{col}</div>
                                                    <select
                                                        value={currentAgg}
                                                        onChange={(e) => {
                                                            const nextAgg = e.target.value;
                                                            const prev = properties.dataTableTotalsRow?.aggregations || {};
                                                            const next = { ...prev } as any;
                                                            if (!nextAgg) {
                                                                delete next[col];
                                                            } else {
                                                                next[col] = nextAgg;
                                                            }
                                                            updateObjectProperties(selectedObject.id, {
                                                                dataTableTotalsRow: {
                                                                    enabled: true,
                                                                    aggregations: next,
                                                                }
                                                            });
                                                        }}
                                                        className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                                                    >
                                                        <option value="">(none)</option>
                                                        <option value="sum">sum</option>
                                                        <option value="avg">avg</option>
                                                        <option value="count">count</option>
                                                        <option value="min">min</option>
                                                        <option value="max">max</option>
                                                    </select>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-600">Group By</label>
                            {loadingColumns ? (
                                <div className="text-xs text-gray-400">Loading columns...</div>
                            ) : (
                                <select
                                    multiple
                                    value={properties.dataTableGroupBy || []}
                                    onChange={(e) => {
                                        const next = Array.from(e.target.selectedOptions).map(o => o.value);
                                        updateObjectProperties(selectedObject.id, { dataTableGroupBy: next });
                                    }}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white min-h-[90px]"
                                >
                                    {columns.map((col) => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            )}
                            <div className="text-xs text-gray-500">Hold Ctrl/Cmd to select multiple columns.</div>
                        </div>
                    </PropertyGroup>
                )}

                {selectedObject.type === 'barcode' && parentDataRegion && getSqlRestDisplayName(parentDataRegion.properties.dataSource) && (
                    <PropertyGroup title="Data Binding">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-gray-600">Bind to Column</label>
                            {loadingColumns ? (
                                <div className="text-xs text-gray-400">Loading columns...</div>
                            ) : (
                                <select
                                    value={properties.dataBinding?.columnName || ''}
                                    onChange={async (e) => {
                                        const col = e.target.value;
                                        if (col) {
                                            const tableName = getSqlRestDisplayName(parentDataRegion.properties.dataSource);
                                            const record = parentDataRegion.data && parentDataRegion.data.length > 0 ? parentDataRegion.data[0] : null;
                                            const value = record ? record[col] : undefined;
                                            const text = value !== undefined ? String(value) : '';

                                            updateObjectProperties(selectedObject.id, {
                                                text: `[${col}]`,
                                                dataBinding: {
                                                    tableName,
                                                    columnName: col
                                                }
                                            });

                                            try {
                                                const dataUrl = await generateBarcodeDataUrl({
                                                    bcid: (selectedObject.properties.barcodeType || 'qrcode') as any,
                                                    text,
                                                    widthPx: selectedObject.width,
                                                    heightPx: selectedObject.height,
                                                    includetext: !!selectedObject.properties.barcodeIncludeText,
                                                });
                                                updateObjectProperties(selectedObject.id, { src: dataUrl });
                                            } catch {
                                            }
                                        } else {
                                            updateObjectProperties(selectedObject.id, {
                                                text: '0123456789',
                                                dataBinding: undefined
                                            });
                                        }
                                    }}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                                >
                                    <option value="">None</option>
                                    {columns.map((col) => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </PropertyGroup>
                )}

                {selectedObject.type === 'image' && (
                    <PropertyGroup title="Image Source">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => imageFileInputRef.current?.click()}
                                className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                                type="button"
                            >
                                Upload image...
                            </button>
                            <input
                                ref={imageFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    const prevSrc = selectedObject.properties.src;
                                    if (prevSrc && prevSrc.startsWith('blob:')) {
                                        try { URL.revokeObjectURL(prevSrc); } catch { /* ignore */ }
                                    }

                                    const objectUrl = URL.createObjectURL(file);
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                                        updateObjectProperties(selectedObject.id, {
                                            src: objectUrl,
                                            imageDataUrl: dataUrl || undefined,
                                            imageFileName: file.name,
                                            imageMimeType: file.type,
                                        });
                                    };
                                    reader.readAsDataURL(file);

                                    e.target.value = '';
                                }}
                            />
                        </div>
                        <TextInput
                            label="URL"
                            value={properties.src}
                            onChange={(val: string) => updateObjectProperties(selectedObject.id, { src: val })}
                        />
                    </PropertyGroup>
                )}

                {selectedObject.type === 'barcode' && (
                    <PropertyGroup title="Barcode">
                        <SelectInput
                            label="Type"
                            value={properties.barcodeType || 'qrcode'}
                            onChange={(val: any) => updateObjectProperties(selectedObject.id, { barcodeType: val })}
                            options={['qrcode', 'code128', 'pdf417', 'datamatrix']}
                        />
                        <TextInput
                            label="Value"
                            value={properties.text}
                            onChange={(val: string) => updateObjectProperties(selectedObject.id, { text: val })}
                        />
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-600">Include Text</label>
                            <input
                                type="checkbox"
                                checked={!!properties.barcodeIncludeText}
                                onChange={(e) => updateObjectProperties(selectedObject.id, { barcodeIncludeText: e.target.checked })}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    const dataUrl = await generateBarcodeDataUrl({
                                        bcid: (properties.barcodeType || 'qrcode') as any,
                                        text: properties.text || '',
                                        widthPx: selectedObject.width,
                                        heightPx: selectedObject.height,
                                        includetext: !!properties.barcodeIncludeText,
                                    });
                                    updateObjectProperties(selectedObject.id, { src: dataUrl });
                                } catch (e: any) {
                                    alert(e?.message || 'Failed to generate barcode');
                                }
                            }}
                            className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                            Generate
                        </button>
                    </PropertyGroup>
                )}

                {selectedObject.type === 'text' && (
                    <PropertyGroup title="Typography">
                        <TextInput
                            label="Content"
                            value={properties.text}
                            onChange={(val: string) => updateObjectProperties(selectedObject.id, { text: val })}
                        />
                        <NumberInput
                            label="Font Size"
                            value={properties.fontSize}
                            onChange={(val: number) => updateObjectProperties(selectedObject.id, { fontSize: val })}
                            min={8}
                            max={120}
                        />
                        <SelectInput
                            label="Font Family"
                            value={properties.fontFamily}
                            onChange={(val: string) => updateObjectProperties(selectedObject.id, { fontFamily: val })}
                            options={['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Helvetica']}
                        />
                        <SelectInput
                            label="Align"
                            value={properties.textAlign}
                            onChange={(val: any) => updateObjectProperties(selectedObject.id, { textAlign: val })}
                            options={['left', 'center', 'right']}
                        />
                    </PropertyGroup>
                )}

                {(selectedObject.type === 'table' || selectedObject.type === 'datatable') && getSqlRestDisplayName(effectiveTableDataSource) && (
                    <PropertyGroup title="Table Columns">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-600">Select Columns</label>
                            {loadingColumns ? (
                                <div className="text-xs text-gray-400">Loading columns...</div>
                            ) : (
                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                                    {columns.map((col) => (
                                        <div key={col} className="flex items-center gap-2 mb-1">
                                            <input
                                                type="checkbox"
                                                id={`col-${col}`}
                                                checked={(properties.columns || []).includes(col)}
                                                onChange={(e) => {
                                                    const currentCols = properties.columns || [];
                                                    const currentWidths: Record<string, number | null> = (properties as any).columnWidths || {};
                                                    const currentHeaderCellStyles: Record<string, any> = (properties as any).tableHeaderCellStyles || {};

                                                    let newCols: string[];
                                                    const nextWidths = { ...currentWidths };
                                                    const nextHeaderCellStyles = { ...currentHeaderCellStyles };

                                                    if (e.target.checked) {
                                                        newCols = [...currentCols, col];
                                                        if (!(col in nextWidths)) nextWidths[col] = null;
                                                    } else {
                                                        newCols = currentCols.filter(c => c !== col);
                                                        delete nextWidths[col];
                                                        delete nextHeaderCellStyles[col];
                                                    }

                                                    updateObjectProperties(selectedObject.id, {
                                                        columns: newCols,
                                                        columnWidths: nextWidths,
                                                        tableHeaderCellStyles: nextHeaderCellStyles,
                                                    });
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor={`col-${col}`} className="text-sm text-gray-700 cursor-pointer select-none">
                                                {col}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </PropertyGroup>
                )}

                {selectedObject.type === 'datatable' && getSqlRestDisplayName(effectiveTableDataSource) && (
                    <PropertyGroup title="Available Columns (Drag into DataTable)">
                        {loadingColumns ? (
                            <div className="text-xs text-gray-400">Loading columns...</div>
                        ) : (
                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                                {columns.map((col) => (
                                    <div
                                        key={col}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/reportmaker-column', col);
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        className="px-2 py-1 mb-1 bg-white border border-gray-200 rounded cursor-move hover:border-blue-400"
                                    >
                                        <div className="text-sm text-gray-700 select-none">{col}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </PropertyGroup>
                )}

                {selectedObject.type === 'dataRegion' && (
                    <DataRegionProperties
                        selectedObject={selectedObject}
                        updateObject={updateObject}
                        parameters={parameters}
                    />
                )}

                {(selectedObject.type === 'table' || selectedObject.type === 'datatable') && (
                    <DataRegionProperties
                        selectedObject={selectedObject}
                        updateObject={updateObject}
                        parameters={parameters}
                        effectiveDataSource={effectiveTableDataSource}
                    />
                )}

                <PropertyGroup title="Appearance">
                    <ColorInput
                        label="Color"
                        value={properties.color}
                        onChange={(val: string) => updateObjectProperties(selectedObject.id, { color: val })}
                    />
                    <ColorInput
                        label="Background"
                        value={properties.backgroundColor}
                        onChange={(val: string) => updateObjectProperties(selectedObject.id, { backgroundColor: val })}
                    />
                    <NumberInput
                        label="Opacity"
                        value={properties.opacity}
                        onChange={(val: number) => updateObjectProperties(selectedObject.id, { opacity: val })}
                        min={0}
                        max={1}
                        step={0.1}
                    />
                </PropertyGroup>

                <PropertyGroup title="Border & Spacing">
                    <NumberInput
                        label="Border Width"
                        value={properties.borderWidth}
                        onChange={(val: number) => updateObjectProperties(selectedObject.id, { borderWidth: val })}
                    />
                    <ColorInput
                        label="Border Color"
                        value={properties.borderColor}
                        onChange={(val: string) => updateObjectProperties(selectedObject.id, { borderColor: val })}
                    />
                    <NumberInput
                        label="Padding"
                        value={properties.padding}
                        onChange={(val: number) => updateObjectProperties(selectedObject.id, { padding: val })}
                    />
                </PropertyGroup>
            </div>
        </div>
    );
};
