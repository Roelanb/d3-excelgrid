export type ReportObjectType = 'text' | 'image' | 'chart' | 'table' | 'datatable' | 'barcode' | 'dataRegion' | 'header' | 'footer' | 'line' | 'rectangle' | 'ellipse' | 'polygon' | 'polyline';

export type SqlRestSourceType = 'table' | 'view' | 'storedProcedure' | 'query';

export interface TextStyleProperties {
    fontSize?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikeThrough?: boolean;
    color?: string;
    backgroundColor?: string;
    opacity?: number;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
    textAlign?: 'left' | 'center' | 'right';
}

export type DataTableAggregation = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface DataTableTotalsRow {
    enabled?: boolean;
    aggregations?: Record<string, DataTableAggregation>;
}

export interface DataSource {
    type: 'sqlrest';
    sourceType?: SqlRestSourceType;
    name?: string;
    procedureParams?: Record<string, string>;
    tableName?: string;
    sql?: string;
}

export interface ReportObjectProperties {
    text?: string;
    src?: string; // For images (render source: data URL/blob URL/http URL)
    imagePath?: string; // Relative path for persisted image file (e.g. images/logo.png)
    imageDataUrl?: string; // Temporary/staging data URL (used for writing file on save)
    imageFileName?: string;
    imageMimeType?: string;
    barcodeType?: 'qrcode' | 'code128' | 'pdf417' | 'datamatrix';
    barcodeIncludeText?: boolean;
    fontSize?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikeThrough?: boolean;
    color?: string;
    backgroundColor?: string;
    opacity?: number;
    rotation?: number;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
    margin?: number;
    textAlign?: 'left' | 'center' | 'right';
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    dataSource?: DataSource;
    dataBinding?: {
        tableName: string;
        columnName: string;
    };
    // Shape-specific properties
    strokeWidth?: number;
    strokeColor?: string;
    fillColor?: string;
    points?: string; // For polygon/polyline (SVG points format)
    columns?: string[]; // For Table objects: list of column names to display

    columnWidths?: Record<string, number | null>; // For Table objects: per-column width in px (null/undefined = auto)

    tableColumnLabels?: Record<string, string>;

    tableHeaderStyle?: TextStyleProperties;
    tableHeaderCellStyles?: Record<string, TextStyleProperties>;

    dataTableRowHeight?: number;
    dataTableHeaderHeight?: number;
    dataTableTotalsRow?: DataTableTotalsRow;
    dataTableGroupBy?: string[];
}

export interface ReportObject {
    id: string;
    type: ReportObjectType;
    x: number;
    y: number;
    width: number;
    height: number;
    properties: ReportObjectProperties;
    isSelected?: boolean;
    data?: any[]; // Store fetched data records
}

export interface PageMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export type PagePreset = 'A4' | 'Letter' | 'Custom';

export type PageOrientation = 'portrait' | 'landscape';

export interface PageSettings {
    preset: PagePreset;
    orientation: PageOrientation;
    width: number;
    height: number;
    margins: PageMargins;
}

export interface CanvasSettings {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    zoom: number;
    width: number;
    height: number;
    page: PageSettings;
}

export interface ReportMetadata {
    name: string;
    description: string;
    author: string;
}

// Report Parameter Types
export type ReportParameterType =
    | 'string'
    | 'integer'
    | 'float'
    | 'date'
    | 'time'
    | 'datetime'
    | 'daterange'
    | 'boolean'
    | 'list-string'
    | 'list-number'
    | 'email';

export interface DateRangeValue {
    from: string;
    to: string;
}

export interface ReportParameter {
    id: string;
    name: string;                    // Variable name (used in expressions like @paramName)
    type: ReportParameterType;
    label?: string;                  // Display label
    description?: string;            // Help text
    placeholder?: string;            // Input placeholder
    required: boolean;               // Mandatory or optional
    defaultValue?: string | number | boolean | string[] | number[] | DateRangeValue;
    value?: string | number | boolean | string[] | number[] | DateRangeValue;
    listOptions?: string[];          // For list types: available options to choose from
}

export interface ReportDefinition {
    version?: number;
    reportObjects: ReportObject[];
    canvasSettings: CanvasSettings;
    parameters?: ReportParameter[];
    metadata?: ReportMetadata;
}
