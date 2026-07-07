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

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
// A small breathing space around the canvas so it never kisses the edges.
// Reduced on mobile to maximise usable width.
const PAD_DESKTOP = 24;
const PAD_MOBILE = 8;
// Below this viewport width we treat the device as "mobile" for defaults & layout.
const MOBILE_BREAKPOINT = 768;

export default function DigitalPdfViewer() {
  const { pdfId } = useParams();
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  // Default fit mode is decided once we know the viewport width (see effect below).
  const [fitMode, setFitMode] = useState("width");
  const [customScale, setCustomScale] = useState(1);
  const [effectiveScale, setEffectiveScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );

  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const initialisedFitRef = useRef(false);
  const navigate = useNavigate();

  // Track viewport size to switch mobile/desktop defaults and layout
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Pick the sensible default fit mode ONCE on first mount:
  //   Mobile → Fit Width so page always maps to screen width (never clipped).
  //   Desktop/Tablet → Fit Page so the entire page is visible.
  useEffect(() => {
    if (initialisedFitRef.current) return;
    initialisedFitRef.current = true;
    setFitMode(window.innerWidth < MOBILE_BREAKPOINT ? "width" : "page");
  }, []);

  // Fetch the PDF (business logic unchanged)
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

  // Observe container size. Because the viewer uses position:fixed inset:0
  // (see JSX below), the scroll surface is the real remaining viewport minus
  // the toolbar — so measurements match what the user actually sees.
  useEffect(() => {
    if (!scrollRef.current) return undefined;
    const el = scrollRef.current;
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
    const pad = isMobile ? PAD_MOBILE : PAD_DESKTOP;
    const availW = Math.max(50, containerSize.width - pad * 2);
    const availH = Math.max(50, containerSize.height - pad * 2);
    if (fitMode === "width") return availW / base.width;
    if (fitMode === "page") return Math.min(availW / base.width, availH / base.height);
    return customScale;
  }, [containerSize, fitMode, customScale, isMobile]);

  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !containerSize.width) return;
    try {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_e) { /* ignore */ }
        renderTaskRef.current = null;
      }
      const page = await pdf.getPage(pageNum);
      const scale = computeScale(page);
      const viewport = page.getViewport({ scale });
      // High-DPI: bigger backing store, logical CSS size — keeps text crisp on retina.
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

  useEffect(() => { if (!loading) renderPage(); }, [loading, renderPage]);

  // Block direct save/print (unchanged business logic)
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

  const pad = isMobile ? PAD_MOBILE : PAD_DESKTOP;

  return (
    // position:fixed inset:0 → viewer takes the ENTIRE visual viewport,
    // escaping AppLayout's <main> horizontal padding + sticky header. This is
    // the fix for both the desktop top-clip and the mobile left-clip: no
    // parent container can shrink or offset the scroll surface anymore.
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900"
      style={{ height: "100dvh", width: "100vw", overscrollBehavior: "contain" }}
      data-testid="pdf-viewer-root"
    >
      {/* Toolbar */}
      <div className="p-2 bg-white border-b flex flex-wrap items-center gap-1 sm:gap-2 shrink-0">
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
          <Button data-testid="pdf-viewer-zoom-out-btn" variant="outline" size="sm" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="text-xs text-slate-600 w-11 text-center tabular-nums" data-testid="pdf-viewer-zoom-level">
            {Math.round(effectiveScale * 100)}%
          </div>
          <Button data-testid="pdf-viewer-zoom-in-btn" variant="outline" size="sm" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
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
        Scroll surface.
        - `overflow-auto` gives BOTH horizontal & vertical scrollbars only when needed.
        - `touch-action: pan-x pan-y pinch-zoom` lets mobile users pan AND pinch-zoom
          the canvas natively (browser handles the pinch gesture, no custom code).
        - The inner wrapper uses `min-w/h: 100%` + canvas `margin: auto`. This is the
          proven pattern that CENTRES when the canvas fits and DOES NOT CLIP when it
          overflows (unlike `flex items-center justify-center`, which was the source
          of the earlier clipping bug).
      */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onContextMenu={(e) => e.preventDefault()}
        data-testid="pdf-viewer-scroll"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y pinch-zoom",
        }}
      >
        <div
          className="flex"
          style={{
            minWidth: "100%",
            minHeight: "100%",
            padding: `${pad}px`,
            boxSizing: "border-box",
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="pdf-viewer-canvas"
            style={{
              margin: "auto",
              display: "block",
              userSelect: "none",
              WebkitUserSelect: "none",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              background: "#fff",
              maxWidth: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
