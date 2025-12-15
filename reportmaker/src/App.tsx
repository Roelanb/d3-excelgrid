import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TextStyleToolbar } from './components/TextStyleToolbar/TextStyleToolbar';
import { Canvas } from './components/Canvas/Canvas';
import { LlmPromptPanel } from './components/Llm/LlmPromptPanel';
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ParametersPanel } from './components/ParametersPanel';
import { RunTab } from './components/Run/RunTab';
import { useReportStore } from './hooks/useReportStore';

function App() {
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'run'>('editor');

  const { loadReport, setReportFileHandle, setReportFileName } = useReportStore();

  const isFileDrag = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types || []);
    return types.includes('Files');
  };

  return (
    <div
      className="flex flex-col h-screen w-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden"
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={async (e) => {
        if (!isFileDrag(e)) return;
        const files = Array.from(e.dataTransfer.files || []);
        const file = files.find(f => f.name.toLowerCase().endsWith('.json'));
        if (!file) return;

        e.preventDefault();
        e.stopPropagation();

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const payload = (parsed && typeof parsed === 'object' && (parsed as any).report && (parsed as any).report.reportObjects)
            ? (parsed as any).report
            : parsed;

          setReportFileHandle(null);
          setReportFileName(file.name);
          loadReport(payload);
        } catch (error) {
          console.error('Failed to load report:', error);
          alert('Failed to load report. Please check the file format.');
        }
      }}
    >
      <Toolbar />
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'editor' ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'}`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('run')}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'run' ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'}`}
          >
            Run
          </button>
        </div>
      </div>

      {activeTab === 'editor' && (
        <ParametersPanel />
      )}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'editor' ? (
          <>
            <Sidebar />
            <TextStyleToolbar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Canvas />
              <div className="flex-shrink-0">
                <LlmPromptPanel />
              </div>
            </div>
            <div className="flex h-full flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsPropertiesCollapsed(v => !v)}
                className="w-8 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                title={isPropertiesCollapsed ? 'Show properties' : 'Hide properties'}
              >
                {isPropertiesCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>

              {!isPropertiesCollapsed && (
                <div className="w-72 h-full">
                  <PropertiesPanel />
                </div>
              )}
            </div>
          </>
        ) : null}

        {activeTab === 'run' && (
          <RunTab />
        )}
      </div>
    </div>
  );
}

export default App;
