import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Asterisk } from 'lucide-react';
import type { ReportParameter } from '../../types';
import { ParameterInput, getParameterTypeLabel } from './ParameterInput';

interface ParameterRowProps {
    parameter: ReportParameter;
    onUpdate: (updates: Partial<ReportParameter>) => void;
    onRemove: () => void;
    onValueChange: (value: ReportParameter['value']) => void;
}

export const ParameterRow: React.FC<ParameterRowProps> = ({
    parameter,
    onUpdate,
    onRemove,
    onValueChange,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg mb-2 bg-white dark:bg-gray-900">
            {/* Compact row */}
            <div className="flex items-center gap-2 p-2">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Name input */}
                <input
                    type="text"
                    value={parameter.name}
                    onChange={(e) => onUpdate({ name: e.target.value.replace(/\s/g, '_') })}
                    className="w-28 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="name"
                />

                {/* Type badge */}
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs font-medium whitespace-nowrap">
                    {getParameterTypeLabel(parameter.type)}
                </span>

                {/* Value input */}
                <div className="flex-1 min-w-0">
                    <ParameterInput parameter={parameter} onChange={onValueChange} />
                </div>

                {/* Required indicator */}
                {parameter.required && (
                    <span title="Required">
                        <Asterisk size={14} className="text-red-500" />
                    </span>
                )}

                {/* Delete button */}
                <button
                    onClick={onRemove}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 p-1"
                    title="Remove parameter"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
                <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Label */}
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Label</label>
                            <input
                                type="text"
                                value={parameter.label || ''}
                                onChange={(e) => onUpdate({ label: e.target.value })}
                                placeholder="Display label"
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* Placeholder */}
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Placeholder</label>
                            <input
                                type="text"
                                value={parameter.placeholder || ''}
                                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                                placeholder="Input placeholder"
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* Description */}
                        <div className="col-span-2">
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                            <input
                                type="text"
                                value={parameter.description || ''}
                                onChange={(e) => onUpdate({ description: e.target.value })}
                                placeholder="Help text for this parameter"
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* Default value - show as text for simplicity */}
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Default Value</label>
                            <input
                                type="text"
                                value={parameter.defaultValue !== undefined ? String(parameter.defaultValue) : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    let parsedValue: ReportParameter['defaultValue'] = val;
                                    if (parameter.type === 'integer') {
                                        parsedValue = val ? parseInt(val, 10) : undefined;
                                    } else if (parameter.type === 'float') {
                                        parsedValue = val ? parseFloat(val) : undefined;
                                    } else if (parameter.type === 'boolean') {
                                        parsedValue = val.toLowerCase() === 'true';
                                    }
                                    onUpdate({ defaultValue: parsedValue });
                                }}
                                placeholder="Default value"
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* Required checkbox */}
                        <div className="flex items-end">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={parameter.required}
                                    onChange={(e) => onUpdate({ required: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Required</span>
                            </label>
                        </div>

                        {/* List options (for list types) */}
                        {(parameter.type === 'list-string' || parameter.type === 'list-number') && (
                            <div className="col-span-2">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    Options (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={(parameter.listOptions || []).join(', ')}
                                    onChange={(e) => {
                                        const options = e.target.value
                                            .split(',')
                                            .map((o) => o.trim())
                                            .filter((o) => o.length > 0);
                                        onUpdate({ listOptions: options });
                                    }}
                                    placeholder="Option1, Option2, Option3"
                                    className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
