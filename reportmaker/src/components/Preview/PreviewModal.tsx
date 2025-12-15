import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useReportStore } from '../../hooks/useReportStore';
import { runDataConnections, applyDataUpdatesToObjects } from '../../utils/reportRun';
import { reportGeneratorApi } from '../../services/reportGeneratorApi';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose }) => {
    const { reportObjects, canvasSettings, parameters, reportMetadata, updateObjectsData } = useReportStore();
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            generatePdf();
        } else {
            // Cleanup URL object to avoid memory leaks
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
        }
    }, [isOpen]);

    const generatePdf = async () => {
        try {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const dataUpdates = await runDataConnections(reportObjects, parameters, reportMetadata);
            const dataMap: Record<string, any[]> = {};
            for (const update of dataUpdates) {
                dataMap[update.id] = update.data;
            }

            if (dataUpdates.length > 0) {
                updateObjectsData(dataUpdates);
            }

            const objectsWithData = applyDataUpdatesToObjects(reportObjects, dataUpdates);

            const url = await reportGeneratorApi.generatePdf(
                objectsWithData,
                canvasSettings,
                parameters,
                dataMap
            );

            setPdfUrl(url);
        } catch (e) {
            console.error('Failed to generate PDF preview:', e);
            setPdfUrl(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Report Preview</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 p-4 bg-gray-100 overflow-hidden">
                    {pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full border rounded bg-white" title="PDF Preview" />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p>Generating PDF...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
