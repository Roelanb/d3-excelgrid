import React from 'react';
import type { ReportParameter, ReportParameterType, DateRangeValue } from '../../types';

interface ParameterInputProps {
    parameter: ReportParameter;
    onChange: (value: ReportParameter['value']) => void;
}

export const ParameterInput: React.FC<ParameterInputProps> = ({ parameter, onChange }) => {
    const { type, value, defaultValue, placeholder, listOptions } = parameter;

    const currentValue = value ?? defaultValue;

    const handleChange = (newValue: ReportParameter['value']) => {
        onChange(newValue);
    };

    switch (type) {
        case 'string':
            return (
                <input
                    type="text"
                    value={(currentValue as string) || ''}
                    placeholder={placeholder}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'email':
            return (
                <input
                    type="email"
                    value={(currentValue as string) || ''}
                    placeholder={placeholder || 'email@example.com'}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'integer':
            return (
                <input
                    type="number"
                    step="1"
                    value={(currentValue as number) ?? ''}
                    placeholder={placeholder}
                    onChange={(e) => handleChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'float':
            return (
                <input
                    type="number"
                    step="any"
                    value={(currentValue as number) ?? ''}
                    placeholder={placeholder}
                    onChange={(e) => handleChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'date':
            return (
                <input
                    type="date"
                    value={(currentValue as string) || ''}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'time':
            return (
                <input
                    type="time"
                    value={(currentValue as string) || ''}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'datetime':
            return (
                <input
                    type="datetime-local"
                    value={(currentValue as string) || ''}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );

        case 'daterange': {
            const rangeValue = (currentValue as DateRangeValue) || { from: '', to: '' };
            return (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={rangeValue.from || ''}
                        onChange={(e) => handleChange({ ...rangeValue, from: e.target.value })}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                    <input
                        type="date"
                        value={rangeValue.to || ''}
                        onChange={(e) => handleChange({ ...rangeValue, to: e.target.value })}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            );
        }

        case 'boolean':
            return (
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!currentValue}
                        onChange={(e) => handleChange(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                        {currentValue ? 'Yes' : 'No'}
                    </span>
                </label>
            );

        case 'list-string': {
            const selectedValues = (currentValue as string[]) || [];
            const options = listOptions || [];
            return (
                <div className="flex flex-wrap gap-1">
                    {options.map((option) => (
                        <label
                            key={option}
                            className={`px-2 py-1 text-xs rounded cursor-pointer border ${
                                selectedValues.includes(option)
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedValues.includes(option)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleChange([...selectedValues, option]);
                                    } else {
                                        handleChange(selectedValues.filter((v) => v !== option));
                                    }
                                }}
                                className="sr-only"
                            />
                            {option}
                        </label>
                    ))}
                    {options.length === 0 && (
                        <span className="text-gray-400 dark:text-gray-500 text-xs italic">No options defined</span>
                    )}
                </div>
            );
        }

        case 'list-number': {
            const selectedValues = (currentValue as number[]) || [];
            const options = (listOptions || []).map((o) => parseFloat(o)).filter((n) => !isNaN(n));
            return (
                <div className="flex flex-wrap gap-1">
                    {options.map((option) => (
                        <label
                            key={option}
                            className={`px-2 py-1 text-xs rounded cursor-pointer border ${
                                selectedValues.includes(option)
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedValues.includes(option)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleChange([...selectedValues, option]);
                                    } else {
                                        handleChange(selectedValues.filter((v) => v !== option));
                                    }
                                }}
                                className="sr-only"
                            />
                            {option}
                        </label>
                    ))}
                    {options.length === 0 && (
                        <span className="text-gray-400 dark:text-gray-500 text-xs italic">No options defined</span>
                    )}
                </div>
            );
        }

        default:
            return (
                <input
                    type="text"
                    value={String(currentValue || '')}
                    placeholder={placeholder}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            );
    }
};

export const getParameterTypeLabel = (type: ReportParameterType): string => {
    const labels: Record<ReportParameterType, string> = {
        'string': 'Text',
        'integer': 'Integer',
        'float': 'Decimal',
        'date': 'Date',
        'time': 'Time',
        'datetime': 'Date & Time',
        'daterange': 'Date Range',
        'boolean': 'Yes/No',
        'list-string': 'Text List',
        'list-number': 'Number List',
        'email': 'Email',
    };
    return labels[type] || type;
};
