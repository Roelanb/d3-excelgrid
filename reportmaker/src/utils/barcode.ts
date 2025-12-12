import bwipjs from '@bwip-js/browser';

export type SupportedBarcodeType = 'qrcode' | 'code128' | 'pdf417' | 'datamatrix';

export function generateBarcodeDataUrlSync(params: {
    bcid: SupportedBarcodeType;
    text: string;
    widthPx: number;
    heightPx: number;
    includetext?: boolean;
}): string {
    const canvas = document.createElement('canvas');

    const bcid = params.bcid;
    const text = params.text || '';

    const pxPerMm = 3.78;
    const heightMm = Math.max(5, Math.round(params.heightPx / pxPerMm));

    const baseOptions: any = {
        bcid,
        text,
        scale: 2,
        padding: 0,
    };

    if (bcid === 'code128') {
        baseOptions.height = heightMm;
        baseOptions.includetext = !!params.includetext;
        baseOptions.textxalign = 'center';
    }

    if (bcid === 'pdf417') {
        baseOptions.includetext = false;
    }

    if (bcid === 'datamatrix' || bcid === 'qrcode') {
        baseOptions.includetext = false;
    }

    bwipjs.toCanvas(canvas, baseOptions);
    return canvas.toDataURL('image/png');
}

export async function generateBarcodeDataUrl(params: {
    bcid: SupportedBarcodeType;
    text: string;
    widthPx: number;
    heightPx: number;
    includetext?: boolean;
}): Promise<string> {
    try {
        return generateBarcodeDataUrlSync(params);
    } catch (e) {
        const msg = typeof e === 'string' ? e : (e as any)?.message;
        throw new Error(msg || 'Failed to generate barcode');
    }
}
