import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ParametersPanel } from './components/ParametersPanel';

function App() {
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 overflow-hidden">
      <Toolbar />
      <ParametersPanel />
      <div className="flex flex-1 overflow-hidden">
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
      </div>
    </div>
  );
}

export default App;
