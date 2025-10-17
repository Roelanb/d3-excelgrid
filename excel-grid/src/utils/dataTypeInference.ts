import type { CellValue, CellType, CellFormatting } from '../types/cell';

type ParsedDateType = Extract<CellType, 'date' | 'datetime'>;

type ParsedDateResult = {
  type: ParsedDateType;
  date: Date;
};

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const padNumber = (value: number, length = 2): string => value.toString().padStart(length, '0');

const DATE_FORMATTERS: Record<string, (date: Date) => string> = {
  'YYYY-MM-DD': (date) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`,
  'DD/MM/YYYY': (date) => `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}/${date.getFullYear()}`,
  'MM/DD/YYYY': (date) => `${padNumber(date.getMonth() + 1)}/${padNumber(date.getDate())}/${date.getFullYear()}`,
  'DD-MM-YYYY': (date) => `${padNumber(date.getDate())}-${padNumber(date.getMonth() + 1)}-${date.getFullYear()}`,
  'MMM DD YYYY': (date) => `${MONTH_SHORT_NAMES[date.getMonth()]} ${padNumber(date.getDate())} ${date.getFullYear()}`,
  'DD MMM YYYY': (date) => `${padNumber(date.getDate())} ${MONTH_SHORT_NAMES[date.getMonth()]} ${date.getFullYear()}`,
  'DD-MMM-YYYY': (date) => `${padNumber(date.getDate())}-${MONTH_SHORT_NAMES[date.getMonth()]}-${date.getFullYear()}`,
  'YYYY-MM-DD HH:mm': (date) => `${DATE_FORMATTERS['YYYY-MM-DD'](date)} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`,
  'DD MMM YYYY HH:mm': (date) => `${DATE_FORMATTERS['DD MMM YYYY'](date)} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`,
  'MMM DD YYYY HH:mm': (date) => `${DATE_FORMATTERS['MMM DD YYYY'](date)} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`,
};

export const DATE_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default (locale)' },
  { value: 'YYYY-MM-DD', label: '2024-01-15 (YYYY-MM-DD)' },
  { value: 'DD/MM/YYYY', label: '15/01/2024 (DD/MM/YYYY)' },
  { value: 'DD-MM-YYYY', label: '15-01-2024 (DD-MM-YYYY)' },
  { value: 'DD MMM YYYY', label: '15 Jan 2024 (DD MMM YYYY)' },
  { value: 'DD-MMM-YYYY', label: '15-Jan-2024 (DD-MMM-YYYY)' },
  { value: 'MMM DD YYYY', label: 'Jan 15 2024 (MMM DD YYYY)' },
  { value: 'YYYY-MM-DD HH:mm', label: '2024-01-15 14:30 (YYYY-MM-DD HH:mm)' },
  { value: 'DD MMM YYYY HH:mm', label: '15 Jan 2024 14:30 (DD MMM YYYY HH:mm)' },
  { value: 'MMM DD YYYY HH:mm', label: 'Jan 15 2024 14:30 (MMM DD YYYY HH:mm)' },
];

const formatDateByPattern = (date: Date, format?: string, includeTimeFallback = false): string => {
  if (!format) {
    return includeTimeFallback ? date.toLocaleString() : date.toLocaleDateString();
  }
  const formatter = DATE_FORMATTERS[format];
  if (formatter) {
    return formatter(date);
  }
  return includeTimeFallback ? date.toLocaleString() : date.toLocaleDateString();
};

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const getMonthIndex = (month: string): number | null => {
  const value = MONTH_LOOKUP[month.toLowerCase()];
  return typeof value === 'number' ? value : null;
};

const createValidatedDate = (
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  validateTime = false,
  validateSeconds = false
): Date | null => {
  const date = new Date(year, monthIndex, day, hour, minute, second);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  if (validateTime) {
    if (date.getHours() !== hour || date.getMinutes() !== minute) {
      return null;
    }
    if (validateSeconds && date.getSeconds() !== second) {
      return null;
    }
  }
  return date;
};

/**
 * Detect the date format pattern from input string
 */
const detectDateFormat = (value: string): string | undefined => {
  const trimmed = value.trim();

  // YYYY-MM-DD HH:mm
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/.test(trimmed)) {
    return 'YYYY-MM-DD HH:mm';
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return 'YYYY-MM-DD';
  }

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    return 'DD/MM/YYYY';
  }

  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
    return 'DD-MM-YYYY';
  }

  // DD MMM YYYY HH:mm (e.g., "15 Jan 2024 14:30")
  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s+\d{1,2}:\d{2}$/.test(trimmed)) {
    return 'DD MMM YYYY HH:mm';
  }

  // MMM DD YYYY HH:mm (e.g., "Jan 15 2024 14:30")
  if (/^[A-Za-z]{3,}\s+\d{1,2}(?:,)?\s+\d{4}\s+\d{1,2}:\d{2}$/.test(trimmed)) {
    return 'MMM DD YYYY HH:mm';
  }

  // DD MMM YYYY or DD-MMM-YYYY
  if (/^\d{1,2}(?:\s+|-\s?)[A-Za-z]{3,}(?:\s+|-\s?)\d{4}$/.test(trimmed)) {
    return trimmed.includes('-') ? 'DD-MMM-YYYY' : 'DD MMM YYYY';
  }

  // MMM DD YYYY (e.g., "Jan 15 2024")
  if (/^[A-Za-z]{3,}\s+\d{1,2}(?:,)?\s+\d{4}$/.test(trimmed)) {
    return 'MMM DD YYYY';
  }

  return undefined;
};

const tryParseAdditionalDate = (value: string): ParsedDateResult | null => {
  const trimmed = value.trim();

  const dayMonthNameTimeMatch = trimmed.match(
    /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i
  );
  if (dayMonthNameTimeMatch) {
    const day = Number(dayMonthNameTimeMatch[1]);
    const monthIndex = getMonthIndex(dayMonthNameTimeMatch[2]);
    const year = Number(dayMonthNameTimeMatch[3]);
    const hour = Number(dayMonthNameTimeMatch[4]);
    const minute = Number(dayMonthNameTimeMatch[5]);
    const hasSeconds = Boolean(dayMonthNameTimeMatch[6]);
    const second = hasSeconds ? Number(dayMonthNameTimeMatch[6]) : 0;
    if (monthIndex !== null) {
      const date = createValidatedDate(year, monthIndex, day, hour, minute, second, true, hasSeconds);
      if (date) {
        return { type: 'datetime', date };
      }
    }
  }

  const monthDayYearTimeMatch = trimmed.match(
    /^([A-Za-z]{3,})\s+(\d{1,2})(?:,)?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i
  );
  if (monthDayYearTimeMatch) {
    const monthIndex = getMonthIndex(monthDayYearTimeMatch[1]);
    const day = Number(monthDayYearTimeMatch[2]);
    const year = Number(monthDayYearTimeMatch[3]);
    const hour = Number(monthDayYearTimeMatch[4]);
    const minute = Number(monthDayYearTimeMatch[5]);
    const hasSeconds = Boolean(monthDayYearTimeMatch[6]);
    const second = hasSeconds ? Number(monthDayYearTimeMatch[6]) : 0;
    if (monthIndex !== null) {
      const date = createValidatedDate(year, monthIndex, day, hour, minute, second, true, hasSeconds);
      if (date) {
        return { type: 'datetime', date };
      }
    }
  }

  const monthDayYearMatch = trimmed.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:,)?\s+(\d{4})$/i);
  if (monthDayYearMatch) {
    const monthIndex = getMonthIndex(monthDayYearMatch[1]);
    const day = Number(monthDayYearMatch[2]);
    const year = Number(monthDayYearMatch[3]);
    if (monthIndex !== null) {
      const date = createValidatedDate(year, monthIndex, day);
      if (date) {
        return { type: 'date', date };
      }
    }
  }

  const dayMonthNameMatch = trimmed.match(
    /^(\d{1,2})(?:\s+|-\s?)([A-Za-z]{3,})(?:\s+|-\s?)(\d{4})$/i
  );
  if (dayMonthNameMatch) {
    const day = Number(dayMonthNameMatch[1]);
    const monthIndex = getMonthIndex(dayMonthNameMatch[2]);
    const year = Number(dayMonthNameMatch[3]);
    if (monthIndex !== null) {
      const date = createValidatedDate(year, monthIndex, day);
      if (date) {
        return { type: 'date', date };
      }
    }
  }

  const dayMonthYearMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = Number(dayMonthYearMatch[2]);
    const year = Number(dayMonthYearMatch[3]);
    if (month >= 1 && month <= 12) {
      const date = createValidatedDate(year, month - 1, day);
      if (date) {
        return { type: 'date', date };
      }
    }
  }

  return null;
};

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

  // DateTime (ISO format: 2024-01-15T14:30:00 or 2024-01-15 14:30:00)
  const datetimePattern = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/;
  if (datetimePattern.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const detectedFormat = detectDateFormat(trimmed);
      return { type: 'datetime', value: date, rawValue: input, detectedFormat };
    }
  }

  // Date (ISO format YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (datePattern.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const detectedFormat = detectDateFormat(trimmed);
      return { type: 'date', value: date, rawValue: input, detectedFormat };
    }
  }

  const additionalDate = tryParseAdditionalDate(trimmed);
  if (additionalDate) {
    const detectedFormat = detectDateFormat(trimmed);
    return { type: additionalDate.type, value: additionalDate.date, rawValue: input, detectedFormat };
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

  // Currency (e.g., $100, €50.25)
  const currencyPattern = /^[$€]\s?-?\d+(?:,\d{3})*(?:\.\d+)?$/;
  if (currencyPattern.test(trimmed)) {
    const numValue = parseFloat(trimmed.replace(/[$€,\s]/g, ''));
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
export const formatCellValue = (value: CellValue, formatting?: CellFormatting): string => {
  if (value.value === null || value.value === undefined) return '';

  switch (value.type) {
    case 'date': {
      if (value.value instanceof Date) {
        return formatDateByPattern(value.value, formatting?.dateFormat);
      }
      if (typeof value.rawValue === 'string') {
        const parsed = inferCellValue(value.rawValue);
        if (parsed.type === 'date' && parsed.value instanceof Date) {
          return formatDateByPattern(parsed.value, formatting?.dateFormat);
        }
      }
      return String(value.value);
    }
    
    case 'datetime': {
      if (value.value instanceof Date) {
        return formatDateByPattern(value.value, formatting?.dateFormat, true);
      }
      if (typeof value.rawValue === 'string') {
        const parsed = inferCellValue(value.rawValue);
        if (parsed.type === 'datetime' && parsed.value instanceof Date) {
          return formatDateByPattern(parsed.value, formatting?.dateFormat, true);
        }
      }
      return String(value.value);
    }
    
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
