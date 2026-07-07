import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { useParams, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, MoveHorizontal, ArrowLeft } from "lucide-react";

// Use CDN worker matching installed pdfjs-dist version to simplify bundling
GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js";

// Zoom bounds (used when user manually zooms in/out)
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;

// Space we leave around the canvas so it never touches the container edges
const CANVAS_PADDING = 24; // px on each side

export default function DigitalPdfViewer() {
  const { pdfId } = useParams();
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [fitMode, setFitMode] = useState("page"); // "page" | "width" | "custom"
  const [customScale, setCustomScale] = useState(1);
  const [effectiveScale, setEffectiveScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let objectUrl = null;
    const fetchAndRender = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/digital-store/preview/${pdfId}`, { responseType: "arraybuffer" });
        const data = res.data;
        const loadingTask = getDocument({ data });
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || "Failed to load PDF";
        toast.error(msg);
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    fetchAndRender();
    return () => {
      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy(); } catch (_e) { /* ignore */ }
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfId]);

  // Observe container size so we can recompute fit on resize / orientation change
  useEffect(() => {
    if (!scrollRef.current) return undefined;
    const el = scrollRef.current;
    // seed
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const computeScale = useCallback((page) => {
    const base = page.getViewport({ scale: 1 });
    const availW = Math.max(50, containerSize.width - CANVAS_PADDING * 2);
    const availH = Math.max(50, containerSize.height - CANVAS_PADDING * 2);
    if (fitMode === "width") return availW / base.width;
    if (fitMode === "page") return Math.min(availW / base.width, availH / base.height);
    return customScale;
  }, [containerSize, fitMode, customScale]);

  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !containerSize.width) return;
    try {
      // Cancel any in-flight render before starting a new one
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_e) { /* ignore */ }
        renderTaskRef.current = null;
      }
      const page = await pdf.getPage(pageNum);
      const scale = computeScale(page);
      const viewport = page.getViewport({ scale });
      // High-DPI: render to a bigger backing store, display at logical size so text stays crisp
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const context = canvas.getContext("2d");
      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
      const task = page.render({ canvasContext: context, viewport, transform });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      setEffectiveScale(scale);
      // Reset scroll to top-left when page or fit changes so user never lands mid-page
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        scrollRef.current.scrollLeft = 0;
      }
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") {
        console.error(err);
      }
    }
  }, [pageNum, computeScale, containerSize.width]);

  // Re-render on any dependency change
  useEffect(() => { if (!loading) renderPage(); }, [loading, renderPage]);

  // Block direct save/print of the rendered PDF (Ctrl/Cmd+S, Ctrl/Cmd+P)
  useEffect(() => {
    const blockSavePrint = (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p")) {
        e.preventDefault();
        toast.error("Download and print are disabled for this PDF");
      }
    };
    window.addEventListener("keydown", blockSavePrint);
    return () => window.removeEventListener("keydown", blockSavePrint);
  }, []);

  const zoomIn = () => {
    setCustomScale((prev) => {
      const base = fitMode === "custom" ? prev : effectiveScale;
      return Math.min(MAX_ZOOM, +(base + ZOOM_STEP).toFixed(3));
    });
    setFitMode("custom");
  };
  const zoomOut = () => {
    setCustomScale((prev) => {
      const base = fitMode === "custom" ? prev : effectiveScale;
      return Math.max(MIN_ZOOM, +(base - ZOOM_STEP).toFixed(3));
    });
    setFitMode("custom");
  };
  const fitToPage = () => setFitMode("page");
  const fitToWidth = () => setFitMode("width");

  if (loading) return <Skeleton className="h-screen w-full" />;

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="p-2 bg-white border-b flex flex-wrap items-center gap-2 shrink-0">
        <Button
          data-testid="pdf-viewer-back-btn"
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="ml-1 text-xs sm:text-sm text-slate-600 whitespace-nowrap" data-testid="pdf-viewer-page-indicator">
          Page {pageNum} / {numPages}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          <Button
            data-testid="pdf-viewer-zoom-out-btn"
            variant="outline"
            size="sm"
            onClick={zoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <div className="text-xs text-slate-600 w-12 text-center tabular-nums" data-testid="pdf-viewer-zoom-level">
            {Math.round(effectiveScale * 100)}%
          </div>

          <Button
            data-testid="pdf-viewer-zoom-in-btn"
            variant="outline"
            size="sm"
            onClick={zoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            data-testid="pdf-viewer-fit-width-btn"
            variant={fitMode === "width" ? "default" : "outline"}
            size="sm"
            onClick={fitToWidth}
            title="Fit width"
            className="gap-1"
          >
            <MoveHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Fit Width</span>
          </Button>

          <Button
            data-testid="pdf-viewer-fit-page-btn"
            variant={fitMode === "page" ? "default" : "outline"}
            size="sm"
            onClick={fitToPage}
            title="Fit page"
            className="gap-1"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Fit Page</span>
          </Button>

          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

          <Button
            data-testid="pdf-viewer-prev-page-btn"
            variant="outline"
            size="sm"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            data-testid="pdf-viewer-next-page-btn"
            variant="outline"
            size="sm"
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/*
        Scroll surface. The `margin: auto` trick on the direct child centers the
        canvas when it fits (both axes), and — critically — does NOT clip the
        canvas when it's larger than the container. This is why we do NOT use
        `flex items-center justify-center` here (that pattern was the source of
        the top-clipping on desktop and left-clipping on mobile).
      */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onContextMenu={(e) => e.preventDefault()}
        data-testid="pdf-viewer-scroll"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="flex"
          style={{
            minWidth: "100%",
            minHeight: "100%",
            padding: `${CANVAS_PADDING}px`,
            boxSizing: "border-box",
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="pdf-viewer-canvas"
            style={{
              margin: "auto", // centers when smaller; scrolls without clipping when larger
              display: "block",
              userSelect: "none",
              WebkitUserSelect: "none",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              background: "#fff",
              maxWidth: "none", // let the canvas take its natural computed size
            }}
          />
        </div>
      </div>
    </div>
  );
}
