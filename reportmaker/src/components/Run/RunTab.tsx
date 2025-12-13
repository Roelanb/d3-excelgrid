import React, { useEffect, useMemo, useState } from 'react';
import { Play, Server } from 'lucide-react';
import { useReportStore } from '../../hooks/useReportStore';
import { ParameterInput } from '../ParametersPanel';
import { runReportAndGeneratePdfUrl, runDataConnections, applyDataUpdatesToObjects } from '../../utils/reportRun';
import { reportGeneratorApi } from '../../services/reportGeneratorApi';

export const RunTab: React.FC = () => {
    const { reportObjects, canvasSettings, parameters, setParameterValue, updateObjectsData } = useReportStore();
    const [isRunning, setIsRunning] = useState(false);
    const [isGeneratingViaApi, setIsGeneratingViaApi] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const hasParameters = parameters.length > 0;

    const parametersForRun = useMemo(() => parameters, [parameters]);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const handleRun = async () => {
        if (isRunning || isGeneratingViaApi) return;
        setIsRunning(true);

        try {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            const result = await runReportAndGeneratePdfUrl(reportObjects, canvasSettings, parametersForRun);
            if (result.updates.length > 0) {
                updateObjectsData(result.updates);
            }
            setPdfUrl(result.pdfUrl);
        } catch (e: any) {
            alert(e?.message || 'Failed to run report');
        } finally {
            setIsRunning(false);
        }
    };

    const handleGenerateViaApi = async () => {
        if (isRunning || isGeneratingViaApi) return;
        setIsGeneratingViaApi(true);

        try {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            // First, fetch data for data regions (same as local run)
            const dataUpdates = await runDataConnections(reportObjects, parametersForRun);

            // Build data map for API request
            const dataMap: Record<string, any[]> = {};
            for (const update of dataUpdates) {
                dataMap[update.id] = update.data;
            }

            // Apply updates to objects for the store
            if (dataUpdates.length > 0) {
                updateObjectsData(dataUpdates);
            }

            // Get updated objects with data applied
            const objectsWithData = applyDataUpdatesToObjects(reportObjects, dataUpdates);

            // Call the Report Generator API
            const url = await reportGeneratorApi.generatePdf(
                objectsWithData,
                canvasSettings,
                parametersForRun,
                dataMap
            );
            setPdfUrl(url);
        } catch (e: any) {
            alert(e?.message || 'Failed to generate PDF via API');
        } finally {
            setIsGeneratingViaApi(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRun}
                            disabled={isRunning || isGeneratingViaApi}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors text-sm font-medium ${isRunning || isGeneratingViaApi ? 'bg-purple-300 text-white cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                            title="Run report locally (browser-based PDF generation)"
                            type="button"
                        >
                            <Play size={16} />
                            {isRunning ? 'Running...' : 'Run (Local)'}
                        </button>
                        <button
                            onClick={handleGenerateViaApi}
                            disabled={isRunning || isGeneratingViaApi}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors text-sm font-medium ${isRunning || isGeneratingViaApi ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            title="Generate PDF via Report Generator API (server-side)"
                            type="button"
                        >
                            <Server size={16} />
                            {isGeneratingViaApi ? 'Generating...' : 'Run (API)'}
                        </button>
                        <div className="text-sm text-gray-500">
                            {isRunning ? 'Generating PDF locally...' : isGeneratingViaApi ? 'Generating PDF via API...' : 'Choose local or API-based PDF generation'}
                        </div>
                    </div>
                </div>

                {hasParameters && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {parameters.map((p) => (
                            <div key={p.id} className="flex flex-col gap-1">
                                <label className="text-xs text-gray-600 font-medium">
                                    {p.label || p.name}
                                </label>
                                <ParameterInput
                                    parameter={p}
                                    onChange={(v) => setParameterValue(p.id, v)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 bg-gray-100 overflow-hidden p-4">
                {pdfUrl ? (
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full border rounded bg-white"
                        title="PDF Preview"
                    />
                ) : (
                    <div className="w-full h-full border rounded bg-white flex items-center justify-center text-gray-500">
                        Click Run to generate a PDF preview.
                    </div>
                )}
            </div>
        </div>
    );
};
