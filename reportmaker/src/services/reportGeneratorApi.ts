import type { ReportObject, CanvasSettings, ReportParameter, ReportMetadata } from '../types';

import { getReportGeneratorBaseUrl } from './runtimeConfig';

function getReportGeneratorApiUrl(): string {
    return `${getReportGeneratorBaseUrl()}/api`;
}

export interface LlmGenerateReportResponse {
    reportObjects: ReportObject[];
    canvasSettings: CanvasSettings;
    parameters?: ReportParameter[];
    metadata?: ReportMetadata;
}

export interface LlmGenerateReportRequest {
    question: string;
    model?: string;
    sources?: string[];
    history?: {
        prompt: string;
        report: {
            reportObjects: ReportObject[];
            canvasSettings: CanvasSettings;
            parameters: ReportParameter[];
            metadata?: ReportMetadata;
        };
    }[];
    report?: {
        reportObjects: ReportObject[];
        canvasSettings: CanvasSettings;
        parameters: ReportParameter[];
        metadata?: ReportMetadata;
    };
}

export interface GenerateReportRequest {
    report: {
        reportObjects: ReportObject[];
        canvasSettings: CanvasSettings;
        parameters: ReportParameter[];
    };
    data: Record<string, any[]>;
    output: {
        format: 'pdf';
        filename: string;
    };
}

/**
 * Prepares report objects for API transmission.
 * - Converts blob URLs to data URLs for images
 * - Ensures all image sources are accessible by the API
 */
function prepareObjectsForApi(objects: ReportObject[]): ReportObject[] {
    return objects.map(obj => {
        if (obj.type === 'image') {
            const props = obj.properties;
            // If src is a blob URL, use imageDataUrl instead (which contains the base64 data)
            // The API needs a data URL or http URL, not a blob URL
            if (props.src?.startsWith('blob:') && props.imageDataUrl) {
                return {
                    ...obj,
                    properties: {
                        ...props,
                        src: props.imageDataUrl, // Use the data URL for API
                    },
                };
            }
        }
        return obj;
    });
}

export const reportGeneratorApi = {
    /**
     * Generate a PDF report using the Report Generator API
     * Returns a blob URL that can be used in an iframe or for download
     */
    async generatePdf(
        reportObjects: ReportObject[],
        canvasSettings: CanvasSettings,
        parameters: ReportParameter[],
        data: Record<string, any[]> = {}
    ): Promise<string> {
        // Prepare objects - convert blob URLs to data URLs for images
        const preparedObjects = prepareObjectsForApi(reportObjects);

        const apiUrl = getReportGeneratorApiUrl();

        if (import.meta.env.DEV) {
            const tables = preparedObjects
                .filter(o => o.type === 'table')
                .map(o => ({
                    id: o.id,
                    hasTableHeaderStyle: !!(o.properties as any)?.tableHeaderStyle,
                    tableHeaderCellStyleKeys: Object.keys(((o.properties as any)?.tableHeaderCellStyles || {}) as Record<string, any>),
                }));
            // eslint-disable-next-line no-console
            console.debug('[reportGeneratorApi.generatePdf]', { apiUrl, tables });
        }

        const request: GenerateReportRequest = {
            report: {
                reportObjects: preparedObjects,
                canvasSettings,
                parameters,
            },
            data,
            output: {
                format: 'pdf',
                filename: 'report.pdf',
            },
        };

        const response = await fetch(`${apiUrl}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            let errorMessage = 'Failed to generate PDF';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // Ignore JSON parse error
            }
            throw new Error(errorMessage);
        }

        // Get the PDF blob and create a URL
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    },

    async generateReportWithLlm(
        question: string,
        options?: {
            model?: string;
            sources?: string[];
            history?: {
                prompt: string;
                report: {
                    reportObjects: ReportObject[];
                    canvasSettings: CanvasSettings;
                    parameters: ReportParameter[];
                    metadata?: ReportMetadata;
                };
            }[];
            report?: {
                reportObjects: ReportObject[];
                canvasSettings: CanvasSettings;
                parameters: ReportParameter[];
                metadata?: ReportMetadata;
            };
        }
    ): Promise<LlmGenerateReportResponse> {
        const response = await fetch(`${getReportGeneratorApiUrl()}/llm/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question,
                model: options?.model,
                sources: options?.sources ?? [],
                history: options?.history,
                report: options?.report,
            } satisfies LlmGenerateReportRequest),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Failed to generate report via LLM');
        }

        return await response.json();
    },
};
