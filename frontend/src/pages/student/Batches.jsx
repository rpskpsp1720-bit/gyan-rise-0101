import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import BatchCard from "@/components/BatchCard";
import BuyButton from "@/components/BuyButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function StudentBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/batches");
    setBatches(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const purchased = batches.filter(b => b.is_enrolled);
  const available = batches.filter(b => !b.is_enrolled);

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-[#F97316] font-semibold">Library</div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-900 mt-1">Batches</h1>
        <p className="text-slate-500 mt-2">Browse all batches and unlock content with a single click.</p>
      </div>

      <Tabs defaultValue="purchased">
        <TabsList className="bg-white border border-slate-200 rounded-lg p-1">
          <TabsTrigger value="purchased" data-testid="tab-purchased">Purchased ({purchased.length})</TabsTrigger>
          <TabsTrigger value="available" data-testid="tab-available">Available ({available.length})</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-batches">All ({batches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="purchased" className="mt-6">
          {loading ? <SkelGrid /> : purchased.length === 0 ? (
            <Empty msg="You haven't purchased any batch yet. Switch to 'Available' to enroll." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="purchased-batches-grid">
              {purchased.map((b) => <BatchCard key={b.id} batch={b} testid="purchased-batch" />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="mt-6">
          {loading ? <SkelGrid /> : available.length === 0 ? (
            <Empty msg="No more batches available." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="available-batches-grid">
              {available.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  testid="available-batch"
                  footer={<BuyButton batch={b} onSuccess={load} />}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {loading ? <SkelGrid /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="all-batches-grid">
              {batches.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  testid="all-batch"
                  footer={!b.is_enrolled ? <BuyButton batch={b} onSuccess={load} /> : null}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SkelGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
    </div>
  );
}
function Empty({ msg }) {
  return <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">{msg}</div>;
}
