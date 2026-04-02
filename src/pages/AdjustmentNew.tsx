import { useState } from "react";
import { useEscapeBack } from "@/hooks/useEscapeBack";
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
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useEscapeBack();

  const [adjustmentDate, setAdjustmentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("decrease");
  const [quantityKg, setQuantityKg] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: unitsData } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name, name_ur");
      return data || [];
    },
  });

  const getUnitName = (unitId: string | null) => {
    if (!unitId || !unitsData) return "";
    const u = unitsData.find(u => u.id === unitId);
    if (!u) return "";
    return language === "ur" && u.name_ur ? u.name_ur : u.name;
  };

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, stock_qty, unit_id").order("name");
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

  const handleSave = () => {
    setSubmitted(true);
    if (!productId) {
      toast({ title: t("adjustments.validationProduct"), variant: "destructive" });
      return;
    }
    const qty = parseFloat(quantityKg);
    if (!quantityKg || isNaN(qty) || qty <= 0) {
      toast({ title: t("adjustments.validationQuantity"), variant: "destructive" });
      return;
    }
    if (!reason) {
      toast({ title: t("adjustments.validationReason"), variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(quantityKg);

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
              <SelectTrigger className={submitted && !productId ? "border-destructive" : ""}><SelectValue placeholder={t("adjustments.selectProduct")} /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Preview */}
          {(() => {
            const selectedProduct = products?.find((p) => p.id === productId);
            if (!selectedProduct) {
              return (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground">
                  {t("adjustments.selectProductHint")}
                </div>
              );
            }
            const currentStock = Number(selectedProduct.stock_qty);
            const qty = parseFloat(quantityKg) || 0;
            const projectedStock = adjustmentType === "increase" ? currentStock + qty : currentStock - qty;
            const isNegative = projectedStock < 0;
            const hasQty = qty > 0;

            return (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("adjustments.currentStock")}</span>
                  <span className="font-semibold">{currentStock.toLocaleString()} {getUnitName((selectedProduct as any).unit_id)}</span>
                </div>
                {hasQty && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("adjustments.afterStock")}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${adjustmentType === "increase" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {projectedStock.toLocaleString()} {getUnitName((selectedProduct as any).unit_id)}
                      </span>
                      {isNegative && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {t("adjustments.negativeWarning")}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
              <Input type="number" min="0" step="0.01" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} placeholder="0" className={submitted && (!quantityKg || parseFloat(quantityKg) <= 0) ? "border-destructive" : ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("adjustments.reason")}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className={submitted && !reason ? "border-destructive" : ""}><SelectValue placeholder={t("adjustments.selectReason")} /></SelectTrigger>
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
            <Button onClick={handleSave} disabled={mutation.isPending}>
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
