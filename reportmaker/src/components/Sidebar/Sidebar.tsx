import { Type, Image, BarChart, Table, ScanBarcode, Database, Minus, Square, Circle, Pentagon, Waypoints } from 'lucide-react';
import type { ReportObjectType } from '../../types';

const DraggableItem = ({ type, icon: Icon, label }: { type: ReportObjectType; icon: React.ElementType; label: string }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/react-dnd-type', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="flex items-center gap-3 p-3 mb-2 bg-white border border-gray-200 rounded cursor-move hover:bg-gray-50 hover:border-blue-400 transition-colors shadow-sm"
        >
            <Icon size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
    );
};

export const Sidebar = () => {
    return (
        <div className="w-64 bg-gray-100 border-r border-gray-200 p-4 flex flex-col h-full">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Components</h2>
            <div className="flex-1 overflow-y-auto">
                <DraggableItem type="text" icon={Type} label="Text" />
                <DraggableItem type="image" icon={Image} label="Image" />
                <DraggableItem type="chart" icon={BarChart} label="Chart" />
                <DraggableItem type="table" icon={Table} label="Table" />
                <DraggableItem type="barcode" icon={ScanBarcode} label="Barcode" />
                <DraggableItem type="dataRegion" icon={Database} label="Data Region" />

                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-4">Shapes</h3>
                <DraggableItem type="line" icon={Minus} label="Line" />
                <DraggableItem type="rectangle" icon={Square} label="Rectangle" />
                <DraggableItem type="ellipse" icon={Circle} label="Ellipse" />
                <DraggableItem type="polygon" icon={Pentagon} label="Polygon" />
                <DraggableItem type="polyline" icon={Waypoints} label="Polyline" />
            </div>
        </div>
    );
};
