import { calculatePdfScale, getCanvasRenderMetrics } from './pdfViewerUtils';

describe('calculatePdfScale', () => {
  it('fits a PDF page to the available viewport without clipping', () => {
    const scale = calculatePdfScale({
      pageWidth: 1000,
      pageHeight: 1400,
      containerWidth: 360,
      containerHeight: 640,
      padding: 24,
      zoom: 1,
    });

    expect(scale).toBeLessThanOrEqual(0.312);
    expect(scale).toBeCloseTo(0.312, 2);
  });

  it('applies zoom while still fitting the viewport', () => {
    const scale = calculatePdfScale({
      pageWidth: 1000,
      pageHeight: 1400,
      containerWidth: 800,
      containerHeight: 600,
      padding: 24,
      zoom: 1.25,
    });

    expect(scale).toBeCloseTo(0.49, 2);
  });

  it('creates a high-DPI canvas size that matches the displayed page size', () => {
    const metrics = getCanvasRenderMetrics({ width: 200, height: 300 }, 2);

    expect(metrics.canvasWidth).toBe(400);
    expect(metrics.canvasHeight).toBe(600);
    expect(metrics.cssWidth).toBe(200);
    expect(metrics.cssHeight).toBe(300);
  });

  it('caps the canvas backing store for very high-DPI screens', () => {
    const metrics = getCanvasRenderMetrics({ width: 200, height: 300 }, 3.5);

    expect(metrics.canvasWidth).toBe(400);
    expect(metrics.canvasHeight).toBe(600);
    expect(metrics.cssWidth).toBe(200);
    expect(metrics.cssHeight).toBe(300);
  });
});
