import React, { useEffect, useState } from "react";
import { api, resolveImage } from "@/lib/apiClient";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, BookOpen, Lock, Check } from "lucide-react";
import { startPdfCheckout } from "@/lib/razorpay";
import { useAuth } from "@/context/AuthContext";

/**
 * Product details page for a single Digital Store PDF.
 *  - Mounted at /store/view/:pdfId (the public "View" button target).
 *  - Shows title, description, price, page count (if available), thumbnail,
 *    and a Buy Now / Read button depending on purchase state.
 *  - Does NOT preview or download the PDF before purchase.
 *  - When already purchased, "Read PDF" routes to the protected viewer
 *    at /store/read/:pdfId.
 */
export default function DigitalPdfDetail() {
  const { pdfId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await api.get(`/digital-store/${pdfId}`);
        if (alive) setItem(data);
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Product not found");
        navigate("/store", { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [pdfId, navigate]);

  const isFree = !item?.price || item.price <= 0;

  const handleBuy = async (e) => {
    // Defensive: prevent any default form/button submit behavior that could
    // cause a page reload (the symptom user reported on the Digital Store).
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    if (!item) return;
    if (item.is_purchased) {
      navigate(`/store/read/${pdfId}`);
      return;
    }
    if (isFree) {
      toast.message("This PDF is free — opening reader…");
      navigate(`/store/read/${pdfId}`);
      return;
    }

    setBuying(true);
    await startPdfCheckout({
      pdf: item,
      user,
      onAlready: () => {
        toast.success("PDF already purchased");
        navigate(`/store/read/${pdfId}`);
      },
      onSuccess: () => {
        toast.success("Payment successful — PDF unlocked");
        navigate(`/store/read/${pdfId}`);
      },
      onCancel: () => toast.error("Payment cancelled"),
      onError: (msg) => toast.error(msg || "Checkout failed"),
    });
    setBuying(false);
  };

  if (loading) {
    return (
      <div className="space-y-4" data-testid="pdf-detail-loading">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Skeleton className="md:col-span-2 h-72 w-full rounded-lg" />
          <div className="md:col-span-3 space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const purchased = !!item.is_purchased;
  const priceLabel = isFree
    ? "Free"
    : `${item.currency || "INR"} ${Number(item.price).toLocaleString()}`;

  return (
    <div className="space-y-6" data-testid="pdf-detail-page">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/store")}
          className="text-slate-600 hover:text-slate-900 px-2"
          data-testid="pdf-detail-back-btn"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Store
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-white border border-slate-200 rounded-xl p-5">
        <div className="md:col-span-2">
          {item.thumbnail_url ? (
            <img
              src={resolveImage(item.thumbnail_url)}
              alt={item.title}
              className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-200"
              data-testid="pdf-detail-thumb"
            />
          ) : (
            <div className="w-full aspect-[3/4] rounded-lg border border-dashed border-slate-300 grid place-items-center text-slate-400">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="md:col-span-3 flex flex-col">
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">
            {item.category || "Digital PDF"}
          </div>
          <h1
            className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1"
            data-testid="pdf-detail-title"
          >
            {item.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            <div>
              <span className="text-slate-400">Price:</span>{" "}
              <span className="font-semibold text-[#F97316]" data-testid="pdf-detail-price">
                {priceLabel}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Pages:</span>{" "}
              <span className="font-semibold text-slate-900" data-testid="pdf-detail-pages">
                {item.page_count ? item.page_count : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Format:</span>{" "}
              <span className="font-semibold text-slate-900">PDF</span>
            </div>
          </div>

          <p className="text-slate-600 leading-relaxed mt-4 whitespace-pre-line" data-testid="pdf-detail-description">
            {item.description || "No description provided."}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            {purchased ? (
              <>
                <Button
                  onClick={() => navigate(`/store/read/${pdfId}`)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px]"
                  data-testid="pdf-detail-read-btn"
                >
                  <BookOpen className="h-4 w-4 mr-2" /> Read PDF
                </Button>
                <span className="text-sm text-emerald-700 inline-flex items-center">
                  <Check className="h-4 w-4 mr-1" /> Purchased — access granted
                </span>
              </>
            ) : (
              <Button
                type="button"
                onClick={handleBuy}
                disabled={buying}
                className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white min-w-[180px]"
                data-testid="pdf-detail-buy-btn"
              >
                {buying ? (
                  "Processing…"
                ) : isFree ? (
                  <><BookOpen className="h-4 w-4 mr-2" /> Get Free Access</>
                ) : (
                  <><ShoppingCart className="h-4 w-4 mr-2" /> Buy Now · {priceLabel}</>
                )}
              </Button>
            )}
          </div>

          {!purchased && !isFree && (
            <div className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3 inline-flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
              <span>
                Secure payment via Razorpay. PDF preview and download are locked until
                payment is verified. Access is granted only to the purchasing account.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
