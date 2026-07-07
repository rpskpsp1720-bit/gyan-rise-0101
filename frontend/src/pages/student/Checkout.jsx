import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("Failed to load script"));
    document.head.appendChild(s);
  });
}

export default function Checkout() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const pdf_id = params.get("pdf_id");

    const doCheckout = async () => {
      try {
        let orderInfo = null;
        // If session has prefilled order
        const saved = sessionStorage.getItem("razorpay_order");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.pdf_id === pdf_id) orderInfo = parsed;
        }
        if (!orderInfo) {
          if (!pdf_id) { toast.error("Missing PDF id"); navigate(-1); return; }
          const { data } = await api.post(`/digital-store/checkout/${pdf_id}`);
          orderInfo = { order: data.order, key_id: data.key_id, pdf_id };
        }
        await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        const options = {
          key: orderInfo.key_id,
          order_id: orderInfo.order.id,
          currency: orderInfo.order.currency,
          name: "Digital Store",
          description: "Purchase PDF",
          handler: async function (res) {
            try {
              const verifyBody = {
                razorpay_payment_id: res.razorpay_payment_id,
                razorpay_order_id: res.razorpay_order_id,
                razorpay_signature: res.razorpay_signature,
                pdf_id: orderInfo.pdf_id,
              };
              const v = await api.post("/digital-store/payments/verify", verifyBody);
              toast.success("Payment successful — PDF unlocked");
              // clear session storage
              sessionStorage.removeItem("razorpay_order");
              navigate(`/store/read/${orderInfo.pdf_id}`);
            } catch (err) {
              toast.error(err?.response?.data?.detail || "Payment verification failed");
            }
          },
          modal: { escape: false },
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          toast.error('Payment failed');
        });
        rzp.open();
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Checkout failed');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    doCheckout();
  }, [loc.search]);

  return <div className="min-h-screen grid place-items-center">{loading ? "Initializing checkout…" : ""}</div>;
}
