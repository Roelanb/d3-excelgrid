import type { CellValue, CellType } from '../types/cell';

/**
 * Infer the cell value type from a string input
 */
export const inferCellValue = (input: string): CellValue => {
  const trimmed = input.trim();

  // Empty
  if (trimmed === '') {
    return { type: 'text', value: '', rawValue: input };
  }

  // Boolean
  if (trimmed.toLowerCase() === 'true') {
    return { type: 'boolean', value: true, rawValue: input };
  }
  if (trimmed.toLowerCase() === 'false') {
    return { type: 'boolean', value: false, rawValue: input };
  }

  // GUID/UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (guidPattern.test(trimmed)) {
    return { type: 'guid', value: trimmed, rawValue: input };
  }

  // Email (basic pattern)
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(trimmed)) {
    return { type: 'email', value: trimmed, rawValue: input };
  }

  // URI/URL
  const uriPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  if (uriPattern.test(trimmed)) {
    return { type: 'uri', value: trimmed, rawValue: input };
  }

  // Phone number (various formats: +1-234-567-8900, (123) 456-7890, 123-456-7890, etc.)
  const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
  if (phonePattern.test(trimmed.replace(/\s/g, ''))) {
    return { type: 'phone', value: trimmed, rawValue: input };
  }

  // Percentage (e.g., 25%, 0.25%)
  const percentagePattern = /^-?\d+\.?\d*%$/;
  if (percentagePattern.test(trimmed)) {
    const numValue = parseFloat(trimmed.replace('%', ''));
    return { type: 'percentage', value: numValue, rawValue: input };
  }

  // Currency (e.g., $100, €50.25, £75.50)
  const currencyPattern = /^[$€£¥₹]?\s?-?\d+(?:,\d{3})*(?:\.\d{2})?$/;
  if (currencyPattern.test(trimmed)) {
    const numValue = parseFloat(trimmed.replace(/[$€£¥₹,\s]/g, ''));
    return { type: 'currency', value: numValue, rawValue: input };
  }

  // Duration (e.g., 1:30:45, 2:15, 00:45:30)
  const durationPattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  if (durationPattern.test(trimmed)) {
    return { type: 'duration', value: trimmed, rawValue: input };
  }

  // Time (e.g., 14:30, 2:30 PM, 14:30:45)
  const timePattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s?(AM|PM)?$/i;
  if (timePattern.test(trimmed)) {
    return { type: 'time', value: trimmed, rawValue: input };
  }

  // DateTime (ISO format: 2024-01-15T14:30:00 or 2024-01-15 14:30:00)
  const datetimePattern = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/;
  if (datetimePattern.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return { type: 'datetime', value: date, rawValue: input };
    }
  }

  // Date (ISO format YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (datePattern.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return { type: 'date', value: date, rawValue: input };
    }
  }

  // Number (including negative and decimal)
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') {
    return { type: 'number', value: num, rawValue: input };
  }

  // Default to text
  return { type: 'text', value: input, rawValue: input };
};

/**
 * Format a cell value for display based on its type
 */
export const formatCellValue = (value: CellValue): string => {
  if (value.value === null || value.value === undefined) return '';

  switch (value.type) {
    case 'date':
      return value.value instanceof Date
        ? value.value.toLocaleDateString()
        : String(value.value);
    
    case 'datetime':
      return value.value instanceof Date
        ? value.value.toLocaleString()
        : String(value.value);
    
    case 'time':
      return String(value.value);
    
    case 'boolean':
      return value.value ? 'TRUE' : 'FALSE';
    
    case 'number':
      return typeof value.value === 'number'
        ? value.value.toString()
        : String(value.value);
    
    case 'percentage':
      return typeof value.value === 'number'
        ? `${value.value}%`
        : String(value.value);
    
    case 'currency':
      return typeof value.value === 'number'
        ? `$${value.value.toFixed(2)}`
        : String(value.value);
    
    case 'duration':
    case 'phone':
    case 'email':
    case 'uri':
    case 'guid':
    case 'text':
    default:
      return String(value.value);
  }
};

/**
 * Convert a value to a specific type
 */
export const convertToType = (currentValue: CellValue, targetType: CellType): CellValue => {
  const rawValue = currentValue.rawValue || String(currentValue.value);
  
  // If converting to text, just use the raw value
  if (targetType === 'text') {
    return { type: 'text', value: rawValue, rawValue };
  }

  // Try to infer the value with the target type in mind
  const inferred = inferCellValue(rawValue);
  
  // If inference matches target type, use it
  if (inferred.type === targetType) {
    return inferred;
  }

  // Otherwise, force the type but keep the value as string
  return { type: targetType, value: rawValue, rawValue };
};

/**
 * Get display name for cell type
 */
export const getCellTypeDisplayName = (type: CellType): string => {
  const displayNames: Record<CellType, string> = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    boolean: 'Boolean',
    guid: 'GUID',
    uri: 'URI',
    email: 'Email',
    phone: 'Phone',
    time: 'Time',
    datetime: 'Date & Time',
    duration: 'Duration',
    currency: 'Currency',
    percentage: 'Percentage',
  };
  return displayNames[type] || type;
};
