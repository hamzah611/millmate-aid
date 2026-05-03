import { useState } from "react";
import { useEscapeBack } from "@/hooks/useEscapeBack";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { fmtQty } from "@/lib/utils";

interface OutputItem {
  id: string;
  product_id: string;
  percentage: number;
}

const ProductionNew = () => {
  const { t, language, isRtl } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEscapeBack();
  const [saving, setSaving] = useState(false);
  const [sourceProductId, setSourceProductId] = useState("");
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const { data: products } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, name_ur, stock_qty, unit_id").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: unitsList } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name, name_ur");
      return data || [];
    },
  });

  const getUnitName = (unitId: string | null) => {
    if (!unitId || !unitsList) return "";
    const u = unitsList.find(u => u.id === unitId);
    return u ? (language === "ur" && u.name_ur ? u.name_ur : u.name) : "";
  };

  const pName = (p: any) => language === "ur" && p?.name_ur ? p.name_ur : p?.name || "—";

  const sourceProduct = products?.find(p => p.id === sourceProductId);
  const sourceQuantity = sourceProduct?.stock_qty || 0;
  const sourceUnitName = getUnitName(sourceProduct?.unit_id || null);

  const totalPercentage = outputs.reduce((sum, o) => sum + o.percentage, 0);

  const addOutput = () => {
    setOutputs((prev) => [...prev, { id: crypto.randomUUID(), product_id: "", percentage: 0 }]);
  };

  const [submitted, setSubmitted] = useState(false);

  const handleSave = async () => {
    setSubmitted(true);
    if (!sourceProductId || sourceQuantity <= 0) {
      toast.error(t("invoice.addItems"));
      return;
    }
    const validOutputs = outputs.filter((o) => o.product_id && o.percentage > 0);
    const invalidOutputs = outputs.filter((o) => !o.product_id || o.percentage <= 0);
    if (outputs.length === 0 || invalidOutputs.length > 0) {
      toast.error(t("production.invalidOutputs"));
      return;
    }
    if (totalPercentage > 100) {
      toast.error("Output percentages cannot exceed 100%");
      return;
    }
    setSaving(true);
    try {
      // Fresh read of source product stock to avoid stale data
      const { data: freshSrc } = await supabase.from("products").select("stock_qty").eq("id", sourceProductId).single();
      if (!freshSrc || freshSrc.stock_qty <= 0) {
        toast.error("Source product has no stock");
        setSaving(false);
        return;
      }
      const actualSourceQty = freshSrc.stock_qty;

      // Calculate deficit
      const totalOutputPct = validOutputs.reduce((s, o) => s + o.percentage, 0);
      const deficitQty = ((100 - totalOutputPct) / 100) * actualSourceQty;

      const { data: prod, error: prodErr } = await supabase
        .from("productions")
        .insert({
          source_product_id: sourceProductId,
          source_quantity: actualSourceQty,
          deficit_quantity: deficitQty,
        } as any)
        .select("id")
        .single();
      if (prodErr) throw prodErr;

      const outputRows = validOutputs.map((o) => ({
        production_id: prod.id,
        product_id: o.product_id,
        quantity: (o.percentage / 100) * actualSourceQty,
      }));
      const { error: outErr } = await supabase.from("production_outputs").insert(outputRows);
      if (outErr) throw outErr;

      // Deduct entire source stock
      await supabase.from("products").update({ stock_qty: 0 }).eq("id", sourceProductId);

      // Add output quantities to each output product
      for (const o of outputRows) {
        const { data: freshOut } = await supabase.from("products").select("stock_qty").eq("id", o.product_id).single();
        if (freshOut) {
          await supabase.from("products").update({ stock_qty: freshOut.stock_qty + o.quantity }).eq("id", o.product_id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      toast.success(t("common.save"));
      navigate("/production");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/production")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("nav.production")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("production.create")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t("production.source")}</Label>
            <Select value={sourceProductId} onValueChange={setSourceProductId}>
              <SelectTrigger><SelectValue placeholder={t("products.name")} /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{pName(p)} ({fmtQty(p.stock_qty)} {getUnitName(p.unit_id)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceProductId && (
              <p className="text-sm text-muted-foreground mt-1">
                Available Stock: <span className="font-mono font-medium text-foreground">{fmtQty(sourceQuantity)} {sourceUnitName}</span>
              </p>
            )}
          </div>

          <Separator />
          <Label>{t("production.outputs")}</Label>
          <div className="space-y-2">
            {outputs.map((o) => {
              const outProduct = products?.find(p => p.id === o.product_id);
              const calcQty = (o.percentage / 100) * sourceQuantity;
              return (
                <div key={o.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select value={o.product_id} onValueChange={(v) => setOutputs((prev) => prev.map((x) => x.id === o.id ? { ...x, product_id: v } : x))}>
                      <SelectTrigger className={`h-9 text-sm ${submitted && !o.product_id ? "border-destructive" : ""}`}><SelectValue placeholder={t("products.name")} /></SelectTrigger>
                      <SelectContent>
                        {products?.filter((p) => p.id !== sourceProductId).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{pName(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <Input type="number" min={0} max={100} className={`h-9 text-sm ${submitted && o.percentage <= 0 ? "border-destructive" : ""}`} placeholder="%" value={o.percentage || ""} onChange={(e) => setOutputs((prev) => prev.map((x) => x.id === o.id ? { ...x, percentage: parseFloat(e.target.value) || 0 } : x))} />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="col-span-4 text-sm text-muted-foreground font-mono">
                    = {fmtQty(calcQty)} {getUnitName(outProduct?.unit_id || null)}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setOutputs((prev) => prev.filter((x) => x.id !== o.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addOutput}>
              <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
            </Button>
            {outputs.length > 0 && (
              <p className={`text-sm font-medium ${totalPercentage > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                Total: {totalPercentage.toFixed(1)}%
                {totalPercentage > 100 && " — Total exceeds 100%"}
              </p>
            )}
          </div>

          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/production")}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionNew;
