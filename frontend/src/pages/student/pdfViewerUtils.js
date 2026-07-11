export function calculatePdfScale({ pageWidth, pageHeight, containerWidth, containerHeight, padding = 24, zoom = 1 }) {
  const safeWidth = Math.max(1, containerWidth - padding * 2);
  const safeHeight = Math.max(1, containerHeight - padding * 2);
  const widthScale = safeWidth / pageWidth;
  const heightScale = safeHeight / pageHeight;
  return Math.min(widthScale, heightScale) * zoom;
}

export function getCanvasRenderMetrics(viewport, devicePixelRatio = 1, maxDpr = 2) {
  const dpr = Math.min(maxDpr, Math.max(1, Number(devicePixelRatio) || 1));
  const canvasWidth = Math.max(1, Math.round(viewport.width * dpr));
  const canvasHeight = Math.max(1, Math.round(viewport.height * dpr));
  return {
    canvasWidth,
    canvasHeight,
    cssWidth: Math.max(1, Math.round(viewport.width)),
    cssHeight: Math.max(1, Math.round(viewport.height)),
  };
}
