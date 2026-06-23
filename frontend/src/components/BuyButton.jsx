import React, { useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Lock, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatPrice } from "@/components/BatchCard";

/**
 * Enroll/Buy button.
 * - If batch is free → POST /enrollments/self/{id}
 * - If batch is paid → POST /payments/checkout/{id} (Razorpay-ready; MOCKED until keys live)
 * Calls onSuccess() after enrollment to allow parent refresh.
 */
export default function BuyButton({ batch, onSuccess, className = "" }) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isFree = !batch.price || batch.price === 0;

  if (batch.is_enrolled) {
    return (
      <Button disabled className={`w-full bg-emerald-500/95 hover:bg-emerald-500/95 text-white rounded-lg ${className}`} data-testid={`purchased-badge-${batch.id}`}>
        <Check className="h-4 w-4 mr-2" /> Purchased
      </Button>
    );
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (isFree) {
        await api.post(`/enrollments/self/${batch.id}`);
        toast.success(`Enrolled in ${batch.name}`);
      } else {
        // Create order on backend
        const { data } = await api.post(`/payments/checkout/${batch.id}`);
        if (data?.already) {
          toast.success(`Already enrolled in ${batch.name}`);
        } else {
          // Load Razorpay script
          await new Promise((resolve, reject) => {
            if (window.Razorpay) return resolve(true);
            const s = document.createElement("script");
            s.src = "https://checkout.razorpay.com/v1/checkout.js";
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
            document.head.appendChild(s);
          });

          const order = data.order;
          const options = {
            key: data.key_id,
            amount: order.amount,
            currency: order.currency,
            name: "Lecture Hub",
            description: batch.name,
            order_id: order.id,
            handler: async function (res) {
              try {
                await api.post(`/payments/verify`, {
                  razorpay_payment_id: res.razorpay_payment_id,
                  razorpay_order_id: res.razorpay_order_id,
                  razorpay_signature: res.razorpay_signature,
                  batch_id: batch.id,
                });
                toast.success(`Payment successful · enrolled in ${batch.name}`);
                onSuccess?.();
              } catch (e) {
                toast.error(e?.response?.data?.detail || "Payment verification failed");
              }
            },
            modal: { ondismiss: () => { toast.error("Payment cancelled"); } },
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }
      setConfirmOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not complete enrollment");
    } finally { setLoading(false); }
  };

  const triggerLabel = isFree ? (
    <><ShoppingCart className="h-4 w-4 mr-2" /> Enroll Free</>
  ) : (
    <><ShoppingCart className="h-4 w-4 mr-2" /> Buy Now · {formatPrice(batch.price, batch.currency)}</>
  );

  return (
    <>
      <Button
        onClick={() => setConfirmOpen(true)}
        className={`w-full ${isFree ? "bg-[#1D4ED8] hover:bg-[#1E40AF]" : "bg-[#F97316] hover:bg-[#EA580C]"} text-white rounded-lg ${className}`}
        data-testid={`buy-btn-${batch.id}`}
      >
        {triggerLabel}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid={`buy-dialog-${batch.id}`}>
          <DialogHeader>
            <DialogTitle>{isFree ? "Enroll in this batch?" : `Complete purchase`}</DialogTitle>
            <DialogDescription className="pt-2">
              <span className="block font-semibold text-slate-900">{batch.name}</span>
              <span className="block text-slate-500 mt-1">{batch.description}</span>
              {!isFree && (
                <span className="block mt-3 text-base">
                  Amount: <span className="font-bold text-[#F97316]">{formatPrice(batch.price, batch.currency)}</span>
                </span>
              )}
              {!isFree && (
                <span className="block text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-2 mt-3">
                  <Lock className="inline h-3 w-3 mr-1" />
                  Secure payment via Razorpay. Clicking "Confirm & Pay" will open the Razorpay checkout.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid={`buy-cancel-${batch.id}`}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={loading} className={isFree ? "bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" : "bg-[#F97316] hover:bg-[#EA580C] text-white"} data-testid={`buy-confirm-${batch.id}`}>
              {loading ? "Processing..." : isFree ? "Enroll" : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
