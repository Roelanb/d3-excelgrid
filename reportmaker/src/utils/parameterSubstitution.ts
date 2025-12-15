import type { ReportMetadata, ReportParameter, DateRangeValue } from '../types';

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

    // New format: @parameterName
    // We only match when '@' is NOT preceded by a word char, so emails like 'a@b.com' won't match.
    const atPattern = /(^|[^\w])@(\w+)/g;

    const replacedAt = text.replace(atPattern, (match, prefix: string, paramName: string) => {
        const param = parameters.find(p => p.name === paramName);
        if (!param) return match;
        return `${prefix}${formatParameterValue(param)}`;
    });

    // Backwards compatibility: {{parameterName}}
    const curlyPattern = /\{\{(\w+)\}\}/g;

    return replacedAt.replace(curlyPattern, (match, paramName) => {
        const param = parameters.find(p => p.name === paramName);
        if (!param) return match;
        return formatParameterValue(param);
    });
};

/**
 * Checks if text contains any parameter placeholders
 */
export const hasParameterPlaceholders = (text: string): boolean => {
    if (!text) return false;
    return /(^|[^\w])@\w+/.test(text) || /\{\{\w+\}\}/.test(text);
};

/**
 * Extracts all parameter names used in text
 */
export const extractParameterNames = (text: string): string[] => {
    if (!text) return [];
    const names: string[] = [];

    const atPattern = /(^|[^\w])@(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = atPattern.exec(text)) !== null) {
        const name = match[2];
        if (name && !names.includes(name)) names.push(name);
    }

    const curlyPattern = /\{\{(\w+)\}\}/g;
    while ((match = curlyPattern.exec(text)) !== null) {
        const name = match[1];
        if (name && !names.includes(name)) names.push(name);
    }

    return names;
};

export const mergeReportMetadataParameters = (
    parameters: ReportParameter[],
    metadata: ReportMetadata | null | undefined
): ReportParameter[] => {
    if (!metadata) return parameters;

    const has = new Set(parameters.map(p => p.name));
    const extras: ReportParameter[] = [];

    const add = (name: string, value: string) => {
        if (!name || has.has(name)) return;
        extras.push({
            id: `__meta_${name}`,
            name,
            type: 'string',
            required: false,
            value,
            label: name,
        });
        has.add(name);
    };

    add('reportName', String(metadata.name ?? ''));
    add('reportDescription', String(metadata.description ?? ''));
    add('reportAuthor', String(metadata.author ?? ''));

    return extras.length ? [...parameters, ...extras] : parameters;
};
