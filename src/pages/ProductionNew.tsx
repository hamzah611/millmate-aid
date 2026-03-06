import { useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";

interface OutputItem {
  id: string;
  product_id: string;
  quantity: number;
}

const ProductionNew = () => {
  const { t, language, isRtl } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [sourceProductId, setSourceProductId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState(0);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const { data: products } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, name_ur, stock_qty").order("name");
      if (error) throw error;
      return data;
    },
  });

  const pName = (p: any) => language === "ur" && p?.name_ur ? p.name_ur : p?.name || "—";

  const addOutput = () => {
    setOutputs((prev) => [...prev, { id: crypto.randomUUID(), product_id: "", quantity: 0 }]);
  };

  const handleSave = async () => {
    if (!sourceProductId || sourceQuantity <= 0 || outputs.length === 0) {
      toast({ title: t("invoice.addItems"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: prod, error: prodErr } = await supabase
        .from("productions")
        .insert({ source_product_id: sourceProductId, source_quantity: sourceQuantity })
        .select("id")
        .single();
      if (prodErr) throw prodErr;

      const outputRows = outputs.filter((o) => o.product_id && o.quantity > 0).map((o) => ({
        production_id: prod.id,
        product_id: o.product_id,
        quantity: o.quantity,
      }));
      const { error: outErr } = await supabase.from("production_outputs").insert(outputRows);
      if (outErr) throw outErr;

      const srcProduct = products?.find((p) => p.id === sourceProductId);
      if (srcProduct) {
        await supabase.from("products").update({ stock_qty: Math.max(0, srcProduct.stock_qty - sourceQuantity) }).eq("id", sourceProductId);
      }
      for (const o of outputRows) {
        const outProduct = products?.find((p) => p.id === o.product_id);
        if (outProduct) {
          await supabase.from("products").update({ stock_qty: outProduct.stock_qty + o.quantity }).eq("id", o.product_id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      toast({ title: t("common.save") });
      navigate("/production");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
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
                  <SelectItem key={p.id} value={p.id}>{pName(p)} ({p.stock_qty} KG)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("production.sourceQty")}</Label>
            <Input type="number" min={0} value={sourceQuantity || ""} onChange={(e) => setSourceQuantity(parseFloat(e.target.value) || 0)} />
          </div>

          <Separator />
          <Label>{t("production.outputs")}</Label>
          <div className="space-y-2">
            {outputs.map((o) => (
              <div key={o.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7">
                  <Select value={o.product_id} onValueChange={(v) => setOutputs((prev) => prev.map((x) => x.id === o.id ? { ...x, product_id: v } : x))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("products.name")} /></SelectTrigger>
                    <SelectContent>
                      {products?.filter((p) => p.id !== sourceProductId).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{pName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input type="number" min={0} className="h-9 text-sm" placeholder="KG" value={o.quantity || ""} onChange={(e) => setOutputs((prev) => prev.map((x) => x.id === o.id ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setOutputs((prev) => prev.filter((x) => x.id !== o.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOutput}>
              <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
            </Button>
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
