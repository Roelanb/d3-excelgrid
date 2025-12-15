import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Settings2 } from 'lucide-react';
import { useReportStore } from '../../hooks/useReportStore';
import { ParameterRow } from './ParameterRow';
import { ParameterTypeSelector } from './ParameterTypeSelector';
import type { ReportParameterType } from '../../types';

export const ParametersPanel: React.FC = () => {
    const { parameters, addParameter, updateParameter, removeParameter, setParameterValue } = useReportStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [showTypeSelector, setShowTypeSelector] = useState(false);

    const handleAddParameter = (type: ReportParameterType) => {
        addParameter(type);
    };

    return (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Settings2 size={18} className="text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-200">Report Parameters</span>
                    {parameters.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded-full text-xs font-medium">
                            {parameters.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowTypeSelector(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"
                        title="Add parameter"
                    >
                        <Plus size={16} />
                        <span>Add</span>
                    </button>
                    {isExpanded ? (
                        <ChevronUp size={18} className="text-gray-400 dark:text-gray-500" />
                    ) : (
                        <ChevronDown size={18} className="text-gray-400 dark:text-gray-500" />
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="px-4 pb-3">
                    {parameters.length === 0 ? (
                        <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
                            No parameters defined. Click "Add" to create a parameter.
                        </div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto">
                            {parameters.map((param) => (
                                <ParameterRow
                                    key={param.id}
                                    parameter={param}
                                    onUpdate={(updates) => updateParameter(param.id, updates)}
                                    onRemove={() => removeParameter(param.id)}
                                    onValueChange={(value) => setParameterValue(param.id, value)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Type selector modal */}
            <ParameterTypeSelector
                isOpen={showTypeSelector}
                onClose={() => setShowTypeSelector(false)}
                onSelect={handleAddParameter}
            />
        </div>
    );
};
