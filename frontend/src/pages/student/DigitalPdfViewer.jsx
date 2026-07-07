import React, { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { useParams, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Use CDN worker matching installed pdfjs-dist version to simplify bundling
GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js";

export default function DigitalPdfViewer() {
  const { pdfId } = useParams();
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);
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
        renderPage(pdf, pageNum);
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
        try { pdfDocRef.current.destroy(); } catch {};
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfId]);

  const renderPage = async (pdf = pdfDocRef.current, p = pageNum) => {
    if (!pdf) return;
    try {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const renderContext = { canvasContext: context, viewport };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { if (!loading) renderPage(); }, [pageNum]);

  // Deter direct download/print of the rendered PDF: block Ctrl+S / Ctrl+P
  // while the viewer is focused. Combined with backend purchase enforcement
  // and pdf.js canvas rendering (no raw blob exposed to the DOM), this keeps
  // casual users from saving the file.
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

  if (loading) return <Skeleton className="h-screen w-full" />;
  return (
    <div className="h-screen flex flex-col">
      <div className="p-2 bg-white border-b flex items-center gap-2">
        <Button onClick={() => navigate(-1)}>Back</Button>
        <div className="ml-2 text-sm text-slate-600">Page {pageNum} / {numPages}</div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>Prev</Button>
          <Button onClick={() => setPageNum((p) => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}>Next</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center" onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvasRef} style={{ userSelect: 'none', WebkitUserSelect: 'none' }} />
      </div>
    </div>
  );
}
