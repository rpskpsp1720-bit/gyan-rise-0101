/**
 * Razorpay PDF-checkout helper.
 *
 * Wraps the exact same inline pattern that the batch BuyButton uses (which is
 * known to work in production): create order → load SDK → open modal → verify.
 * Used by both the Digital Store list (DigitalStore.jsx) and the product
 * details page (DigitalPdfDetail.jsx) so the two surfaces stay in sync.
 */
import { api } from "@/lib/apiClient";

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      // already injected, wait for it
      const wait = setInterval(() => {
        if (window.Razorpay) { clearInterval(wait); resolve(true); }
      }, 50);
      setTimeout(() => { clearInterval(wait); reject(new Error("Razorpay SDK load timeout")); }, 10000);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.head.appendChild(s);
  });
}

/**
 * Run the whole PDF-purchase flow inline. Callers must `await` it.
 *
 * @param {object}   pdf        the digital_store PDF document (id, title)
 * @param {object}   user       current user ({ name, email })
 * @param {function} onAlready  fired if backend says user already owns the PDF
 * @param {function} onSuccess  fired after verify endpoint returns 200
 * @param {function} onError    fired with a string message on any failure
 * @param {function} onCancel   fired if the user dismisses the Razorpay modal
 */
export async function startPdfCheckout({ pdf, user, onAlready, onSuccess, onError, onCancel }) {
  let data;
  try {
    const resp = await api.post(`/digital-store/checkout/${pdf.id}`);
    data = resp.data;
  } catch (err) {
    onError?.(err?.response?.data?.detail || "Could not start checkout");
    return;
  }

  if (data?.already) {
    onAlready?.();
    return;
  }
  if (!data?.order || !data?.key_id) {
    onError?.("Checkout failed — invalid order response");
    return;
  }

  try {
    await loadRazorpayScript();
  } catch (e) {
    onError?.(e?.message || "Failed to load Razorpay SDK");
    return;
  }

  const options = {
    key: data.key_id,
    amount: data.order.amount,
    currency: data.order.currency,
    name: "GYAN RISE",
    description: pdf.title || "Digital PDF",
    order_id: data.order.id,
    prefill: {
      name: user?.name || undefined,
      email: user?.email || undefined,
    },
    theme: { color: "#1D4ED8" },
    handler: async function (res) {
      try {
        await api.post("/digital-store/payments/verify", {
          razorpay_payment_id: res.razorpay_payment_id,
          razorpay_order_id: res.razorpay_order_id,
          razorpay_signature: res.razorpay_signature,
          pdf_id: pdf.id,
        });
        onSuccess?.();
      } catch (err) {
        onError?.(err?.response?.data?.detail || "Payment verification failed");
      }
    },
    modal: {
      ondismiss: () => onCancel?.(),
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", function () {
    onError?.("Payment failed");
  });
  rzp.open();
}
