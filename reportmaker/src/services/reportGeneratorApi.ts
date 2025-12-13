import type { ReportObject, CanvasSettings, ReportParameter } from '../types';

const REPORT_GENERATOR_URL = 'http://localhost:3210/api';

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

        const response = await fetch(`${REPORT_GENERATOR_URL}/generate`, {
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
};
