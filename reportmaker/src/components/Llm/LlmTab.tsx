import React, { useMemo, useState } from 'react';
import { reportGeneratorApi } from '../../services/reportGeneratorApi';
import { useReportStore } from '../../hooks/useReportStore';

export const LlmTab: React.FC = () => {
    const { loadReport, reportObjects, canvasSettings, parameters } = useReportStore();

    const [question, setQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const canGenerate = useMemo(() => question.trim().length > 0 && !isLoading, [question, isLoading]);

    const handleGenerate = async () => {
        if (!canGenerate) return;
        setIsLoading(true);
        try {
            const result = await reportGeneratorApi.generateReportWithLlm(question.trim(), {
                report: {
                    reportObjects: reportObjects.map(o => ({
                        id: o.id,
                        type: o.type,
                        x: o.x,
                        y: o.y,
                        width: o.width,
                        height: o.height,
                        properties: o.properties,
                    })),
                    canvasSettings,
                    parameters,
                }
            });
            loadReport({
                reportObjects: result.reportObjects || [],
                canvasSettings: result.canvasSettings,
                parameters: result.parameters || [],
            });
            alert('LLM report loaded into editor');
        } catch (e: any) {
            alert(e?.message || 'Failed to generate report via LLM');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className={`px-3 py-1.5 rounded transition-colors text-sm font-medium ${canGenerate ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-300 text-white cursor-not-allowed'}`}
                            type="button"
                        >
                            {isLoading ? 'Generating...' : 'Generate report'}
                        </button>
                        <div className="text-sm text-gray-500">
                            Ask a question. The prompt is based on the whole database. The report will be loaded into the Editor tab.
                        </div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-600 font-medium">Prompt</label>
                        <textarea
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[100px]"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="e.g. Add a footer, change the title, and align the table to the left"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-gray-100 overflow-auto p-4">
                <div className="border rounded bg-white p-4 text-sm text-gray-600">
                    After generating, switch to the Editor tab to adjust layout, columns, styling, etc.
                </div>
            </div>
        </div>
    );
};
