import type { ReportParameter, DateRangeValue } from '../types';

/**
 * Formats a parameter value for display
 */
const formatParameterValue = (param: ReportParameter): string => {
    const value = param.value ?? param.defaultValue;

    if (value === undefined || value === null) {
        return '';
    }

    switch (param.type) {
        case 'boolean':
            return value ? 'Yes' : 'No';

        case 'daterange': {
            const range = value as DateRangeValue;
            if (range.from && range.to) {
                return `${range.from} - ${range.to}`;
            } else if (range.from) {
                return `From ${range.from}`;
            } else if (range.to) {
                return `To ${range.to}`;
            }
            return '';
        }

        case 'list-string':
        case 'list-number': {
            const list = value as (string[] | number[]);
            return Array.isArray(list) ? list.join(', ') : String(value);
        }

        default:
            return String(value);
    }
};

/**
 * Substitutes {{parameterName}} placeholders in text with actual parameter values
 * @param text - The text containing parameter placeholders
 * @param parameters - Array of report parameters
 * @returns Text with placeholders replaced by parameter values
 */
export const substituteParameters = (text: string, parameters: ReportParameter[]): string => {
    if (!text || !parameters || parameters.length === 0) {
        return text;
    }

    // Match {{parameterName}} pattern
    const pattern = /\{\{(\w+)\}\}/g;

    return text.replace(pattern, (match, paramName) => {
        const param = parameters.find(p => p.name === paramName);

        if (!param) {
            // Parameter not found, keep the original placeholder
            return match;
        }

        return formatParameterValue(param);
    });
};

/**
 * Checks if text contains any parameter placeholders
 */
export const hasParameterPlaceholders = (text: string): boolean => {
    if (!text) return false;
    return /\{\{\w+\}\}/.test(text);
};

/**
 * Extracts all parameter names used in text
 */
export const extractParameterNames = (text: string): string[] => {
    if (!text) return [];
    const pattern = /\{\{(\w+)\}\}/g;
    const names: string[] = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (!names.includes(match[1])) {
            names.push(match[1]);
        }
    }
    return names;
};
