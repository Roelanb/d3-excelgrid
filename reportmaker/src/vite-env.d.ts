interface ImportMetaEnv {
    readonly VITE_SQLREST_BASE_URL?: string;
    readonly VITE_REPORTGEN_BASE_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
