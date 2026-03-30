import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const REASONS = ["Damage", "Wastage", "Physical Count Difference", "Expired", "Correction", "Other"];

export default function AdjustmentNew() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [adjustmentDate, setAdjustmentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("decrease");
  const [quantityKg, setQuantityKg] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: batches } = useQuery({
    queryKey: ["batches-for-product", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase
        .from("batches")
        .select("id, batch_number, remaining_qty")
        .eq("product_id", productId)
        .gt("remaining_qty", 0)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!productId,
  });

  // Get next adjustment number
  const { data: nextNumber } = useQuery({
    queryKey: ["next-adjustment-number"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_adjustments")
        .select("adjustment_number")
        .order("created_at", { ascending: false })
        .limit(1);
      if (!data?.length) return "ADJ-001";
      const last = data[0].adjustment_number;
      const num = parseInt(last.replace("ADJ-", "")) + 1;
      return `ADJ-${String(num).padStart(3, "0")}`;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(quantityKg);
      if (!productId || !reason || isNaN(qty) || qty <= 0) throw new Error("Invalid input");

      // Insert adjustment record
      const { error: adjError } = await supabase.from("inventory_adjustments").insert({
        adjustment_number: nextNumber || "ADJ-001",
        adjustment_date: adjustmentDate,
        product_id: productId,
        batch_id: batchId || null,
        adjustment_type: adjustmentType,
        quantity_kg: qty,
        reason,
        notes: notes || null,
      });
      if (adjError) throw adjError;

      // Update product stock
      const { data: product } = await supabase.from("products").select("stock_qty").eq("id", productId).single();
      if (!product) throw new Error("Product not found");

      const currentStock = Number(product.stock_qty);
      const newStock = adjustmentType === "increase" ? currentStock + qty : Math.max(0, currentStock - qty);

      const { error: stockError } = await supabase.from("products").update({ stock_qty: newStock }).eq("id", productId);
      if (stockError) throw stockError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("common.saved"), description: t("adjustments.saved") });
      navigate("/inventory/adjustments");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory/adjustments")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t("adjustments.new")}</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("adjustments.form")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("adjustments.number")}</Label>
              <Input value={nextNumber || "ADJ-..."} disabled />
            </div>
            <div className="space-y-2">
              <Label>{t("invoice.date")}</Label>
              <Input type="date" value={adjustmentDate} onChange={(e) => setAdjustmentDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("products.name")}</Label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setBatchId(""); }}>
              <SelectTrigger><SelectValue placeholder={t("adjustments.selectProduct")} /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {productId && batches && batches.length > 0 && (
            <div className="space-y-2">
              <Label>{t("adjustments.batch")} ({t("adjustments.optional")})</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder={t("adjustments.selectBatch")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("adjustments.noBatch")}</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.batch_number} ({Number(b.remaining_qty)} KG)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("adjustments.type")}</Label>
              <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as "increase" | "decrease")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="decrease">{t("adjustments.decrease")}</SelectItem>
                  <SelectItem value="increase">{t("adjustments.increase")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("adjustments.quantity")} (KG)</Label>
              <Input type="number" min="0" step="0.01" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("adjustments.reason")}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder={t("adjustments.selectReason")} /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("adjustments.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("adjustments.notesPlaceholder")} />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !productId || !reason || !quantityKg}>
              {mutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory/adjustments")}>
              {t("common.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
