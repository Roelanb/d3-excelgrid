declare global {
    interface Window {
        __RUNTIME_CONFIG__?: {
            SQLREST_BASE_URL?: string;
            REPORTGEN_BASE_URL?: string;
        };
    }
}

function getFromRuntimeConfig(key: keyof NonNullable<Window['__RUNTIME_CONFIG__']>): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.__RUNTIME_CONFIG__?.[key];
}

export function getSqlRestBaseUrl(): string {
    if (import.meta.env.DEV) {
        return 'http://localhost:3200';
    }

    return (
        getFromRuntimeConfig('SQLREST_BASE_URL') ||
        import.meta.env.VITE_SQLREST_BASE_URL ||
        'http://localhost:3200'
    );
}

export function getReportGeneratorBaseUrl(): string {
    if (import.meta.env.DEV) {
        return 'http://localhost:3210';
    }

    return (
        getFromRuntimeConfig('REPORTGEN_BASE_URL') ||
        import.meta.env.VITE_REPORTGEN_BASE_URL ||
        'http://localhost:3210'
    );
}
