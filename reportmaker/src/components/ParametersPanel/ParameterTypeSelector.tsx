import React from 'react';
import {
    Type,
    Hash,
    Calendar,
    Clock,
    CalendarDays,
    CalendarRange,
    ToggleLeft,
    List,
    ListOrdered,
    Mail
} from 'lucide-react';
import type { ReportParameterType } from '../../types';

interface ParameterTypeSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: ReportParameterType) => void;
}

interface TypeOption {
    type: ReportParameterType;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const typeOptions: TypeOption[] = [
    { type: 'string', label: 'Text', description: 'Free text input', icon: <Type size={18} /> },
    { type: 'integer', label: 'Integer', description: 'Whole numbers', icon: <Hash size={18} /> },
    { type: 'float', label: 'Decimal', description: 'Numbers with decimals', icon: <Hash size={18} /> },
    { type: 'date', label: 'Date', description: 'Date picker', icon: <Calendar size={18} /> },
    { type: 'time', label: 'Time', description: 'Time picker', icon: <Clock size={18} /> },
    { type: 'datetime', label: 'Date & Time', description: 'Date and time picker', icon: <CalendarDays size={18} /> },
    { type: 'daterange', label: 'Date Range', description: 'From/To date range', icon: <CalendarRange size={18} /> },
    { type: 'boolean', label: 'Yes/No', description: 'Boolean toggle', icon: <ToggleLeft size={18} /> },
    { type: 'list-string', label: 'Text List', description: 'Multiple text choices', icon: <List size={18} /> },
    { type: 'list-number', label: 'Number List', description: 'Multiple number choices', icon: <ListOrdered size={18} /> },
    { type: 'email', label: 'Email', description: 'Email address', icon: <Mail size={18} /> },
];

export const ParameterTypeSelector: React.FC<ParameterTypeSelectorProps> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    const handleSelect = (type: ReportParameterType) => {
        onSelect(type);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 w-96 max-h-[80vh] overflow-auto border border-gray-200 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Select Parameter Type</h3>
                <div className="grid grid-cols-2 gap-2">
                    {typeOptions.map((option) => (
                        <button
                            key={option.type}
                            onClick={() => handleSelect(option.type)}
                            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors text-left"
                        >
                            <div className="text-gray-600 dark:text-gray-300">{option.icon}</div>
                            <div>
                                <div className="font-medium text-sm text-gray-800 dark:text-gray-100">{option.label}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
