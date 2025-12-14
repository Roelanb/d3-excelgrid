import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { reportGeneratorApi } from '../../services/reportGeneratorApi';
import { useReportStore } from '../../hooks/useReportStore';
import type { CanvasSettings, ReportObject, ReportParameter } from '../../types';

type LlmHistoryItem = {
    prompt: string;
    report: {
        reportObjects: ReportObject[];
        canvasSettings: CanvasSettings;
        parameters: ReportParameter[];
    };
};

const HISTORY_STORAGE_KEY = 'reportmaker_llm_history_v1';

export const LlmPromptPanel: React.FC = () => {
    const { reportObjects, canvasSettings, parameters, loadReport } = useReportStore();

    const [isOpen, setIsOpen] = useState(true);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<LlmHistoryItem[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) return;
            const items: LlmHistoryItem[] = parsed
                .filter((x: any) => x && typeof x.prompt === 'string' && x.report)
                .map((x: any) => ({
                    prompt: String(x.prompt),
                    report: x.report,
                }));
            setHistory(items);
        } catch {
            setHistory([]);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        } catch {
            // ignore
        }
    }, [history]);

    const canGenerate = useMemo(() => prompt.trim().length > 0 && !isLoading, [prompt, isLoading]);

    const handleGenerate = async () => {
        if (!canGenerate) return;

        setIsLoading(true);
        setError(null);
        try {
            const currentPrompt = prompt.trim();

            const currentReport = {
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
            };

            const result = await reportGeneratorApi.generateReportWithLlm(currentPrompt, {
                history,
                report: {
                    reportObjects: currentReport.reportObjects,
                    canvasSettings: currentReport.canvasSettings,
                    parameters: currentReport.parameters,
                },
            });

            const nextHistory = [...history, {
                prompt: currentPrompt,
                report: {
                    reportObjects: result.reportObjects || [],
                    canvasSettings: result.canvasSettings,
                    parameters: result.parameters || [],
                },
            }];

            setHistory(nextHistory.slice(-20));

            loadReport({
                reportObjects: result.reportObjects || [],
                canvasSettings: result.canvasSettings,
                parameters: result.parameters || [],
            });
        } catch (e: any) {
            setError(e?.message || 'Failed to generate report via LLM');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white border-t border-gray-200">
            {isLoading && (
                <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl px-6 py-4 border border-gray-200">
                        <div className="text-sm font-medium text-gray-800">Generating report…</div>
                        <div className="mt-1 text-xs text-gray-500">Waiting for LLM response</div>
                    </div>
                </div>
            )}

            {isHistoryOpen && (
                <div
                    className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center"
                    onMouseDown={() => setIsHistoryOpen(false)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl border border-gray-200 w-[min(900px,95vw)] max-h-[85vh] overflow-hidden"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-800">LLM History</div>
                            <button
                                type="button"
                                className="text-sm text-gray-600 hover:text-gray-900"
                                onClick={() => setIsHistoryOpen(false)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-4 overflow-auto max-h-[calc(85vh-52px)]">
                            {history.length === 0 ? (
                                <div className="text-sm text-gray-500">No history yet.</div>
                            ) : (
                                <div className="space-y-3">
                                    {history
                                        .map((item, idx) => ({ item, idx }))
                                        .reverse()
                                        .map(({ item, idx }) => {
                                            const isExpanded = expandedHistoryIndex === idx;
                                            const json = JSON.stringify(item.report, null, 2);
                                            return (
                                                <div key={idx} className="border border-gray-200 rounded">
                                                    <button
                                                        type="button"
                                                        className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                                                        onClick={() => setExpandedHistoryIndex(v => (v === idx ? null : idx))}
                                                    >
                                                        <div className="text-sm font-medium text-gray-800 truncate">
                                                            {item.prompt}
                                                        </div>
                                                        <div className="text-xs text-gray-500 ml-3 flex-shrink-0">
                                                            {isExpanded ? 'Hide' : 'Show'}
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="text-xs font-semibold text-gray-600">Response (report JSON)</div>
                                                                <button
                                                                    type="button"
                                                                    className="text-xs text-blue-700 hover:text-blue-900"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await navigator.clipboard.writeText(json);
                                                                        } catch {
                                                                            // ignore
                                                                        }
                                                                    }}
                                                                >
                                                                    Copy JSON
                                                                </button>
                                                            </div>
                                                            <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-auto max-h-[360px]">{json}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
                <div className="flex items-center gap-2">
                    <span>LLM Prompt</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        className="text-xs text-blue-700 hover:text-blue-900"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsHistoryOpen(true);
                        }}
                    >
                        History ({history.length})
                    </button>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
            </button>

            {isOpen && (
                <div className="px-4 pb-4">
                    <div className="flex items-start gap-3">
                        <textarea
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[110px]"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. Move the title to the header, add a table of customers, and change the footer text"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className={`px-3 py-2 rounded transition-colors text-sm font-medium ${canGenerate ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-300 text-white cursor-not-allowed'}`}
                            type="button"
                        >
                            {isLoading ? 'Generating...' : 'Generate'}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
