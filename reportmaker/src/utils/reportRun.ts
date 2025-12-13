import { api } from '../services/api';
import { substituteParameters } from './parameterSubstitution';
import type { ReportObject, ReportParameter } from '../types';

const getSqlRestSourceName = (dataSource: any): string => {
    return dataSource?.name || dataSource?.tableName || '';
};

const splitFullName = (fullName: string): { schema: string; name: string } => {
    if (!fullName) return { schema: 'dbo', name: '' };
    if (fullName.includes('.')) {
        const [schema, name] = fullName.split('.');
        return { schema: schema || 'dbo', name: name || '' };
    }
    return { schema: 'dbo', name: fullName };
};

export const runDataConnections = async (objects: ReportObject[], parameters: ReportParameter[]) => {
    const dataRegions = objects.filter(o => o.type === 'dataRegion');
    const updates: { id: string; data: any[] }[] = [];

    for (const region of dataRegions) {
        const ds = region.properties?.dataSource;
        if (!ds || ds.type !== 'sqlrest') continue;

        const sourceName = getSqlRestSourceName(ds);
        if (!sourceName) continue;

        const sourceType = ds.sourceType || 'table';

        if (sourceType === 'storedProcedure') {
            const { schema, name } = splitFullName(sourceName);
            const rawParams = ds.procedureParams || {};
            const resolvedParams = Object.fromEntries(
                Object.entries(rawParams).map(([k, v]) => [k, substituteParameters(String(v ?? ''), parameters)])
            ) as Record<string, string>;

            const response = await api.executeStoredProcedure(schema, name, resolvedParams);
            const resultSets = response?.resultSets || response?.ResultSets;
            const data = Array.isArray(resultSets) && Array.isArray(resultSets[0]) ? resultSets[0] : [];
            updates.push({ id: region.id, data: Array.isArray(data) ? data : [] });
        } else {
            const response = await api.getData(sourceName);
            const data = response && response.data ? response.data : [];
            updates.push({ id: region.id, data: Array.isArray(data) ? data : [] });
        }
    }

    return updates;
};

export const applyDataUpdatesToObjects = (objects: ReportObject[], updates: { id: string; data: any[] }[]): ReportObject[] => {
    if (!updates.length) return objects;
    const map = new Map(updates.map(u => [u.id, u.data]));
    return objects.map(o => {
        const data = map.get(o.id);
        return data !== undefined ? { ...o, data } : o;
    });
};
