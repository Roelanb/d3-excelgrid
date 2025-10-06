import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface Viewport {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

const INITIAL_VIEWPORT: Viewport = { startRow: 0, endRow: 50, startCol: 0, endCol: 20 };

type CalculateViewportFn = (
  scrollLeft: number,
  scrollTop: number,
  viewportWidth: number,
  viewportHeight: number,
) => Viewport;

export const useViewport = (
  containerRef: RefObject<HTMLDivElement>,
  calculateViewport: CalculateViewportFn,
) => {
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const renderRequestRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (renderRequestRef.current !== null) {
        cancelAnimationFrame(renderRequestRef.current);
      }

      renderRequestRef.current = requestAnimationFrame(() => {
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const viewportWidth = container.clientWidth;
        const viewportHeight = container.clientHeight;

        const newViewport = calculateViewport(scrollLeft, scrollTop, viewportWidth, viewportHeight);

        setViewport((prev) => {
          if (
            prev.startRow !== newViewport.startRow ||
            prev.endRow !== newViewport.endRow ||
            prev.startCol !== newViewport.startCol ||
            prev.endCol !== newViewport.endCol
          ) {
            return newViewport;
          }
          return prev;
        });
        renderRequestRef.current = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (renderRequestRef.current !== null) {
        cancelAnimationFrame(renderRequestRef.current);
      }
    };
  }, [containerRef, calculateViewport]);

  return {
    viewport,
    setViewport,
  } as const;
};
