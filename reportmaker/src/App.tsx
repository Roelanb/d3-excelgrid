import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ParametersPanel } from './components/ParametersPanel';
import { RunTab } from './components/Run/RunTab';

function App() {
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'run'>('editor');

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 overflow-hidden">
      <Toolbar />
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'editor' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('run')}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'run' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
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
            <Canvas />
            <div className="flex h-full flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsPropertiesCollapsed(v => !v)}
                className="w-8 bg-gray-50 border-l border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600"
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
        ) : (
          <RunTab />
        )}
      </div>
    </div>
  );
}

export default App;
