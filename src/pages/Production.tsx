import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Factory, Plus, Trash2 } from "lucide-react";

interface OutputItem {
  id: string;
  product_id: string;
  quantity: number;
}

const Production = () => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sourceProductId, setSourceProductId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState(0);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);

  const { data: products } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, name_ur, stock_qty").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: productions, isLoading } = useQuery({
    queryKey: ["productions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productions")
        .select("*, products!productions_source_product_id_fkey(name), production_outputs(quantity, products(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addOutput = () => {
    setOutputs((prev) => [...prev, { id: crypto.randomUUID(), product_id: "", quantity: 0 }]);
  };

  const resetForm = () => {
    setSourceProductId("");
    setSourceQuantity(0);
    setOutputs([]);
  };

  const handleSave = async () => {
    if (!sourceProductId || sourceQuantity <= 0 || outputs.length === 0) {
      toast({ title: t("invoice.addItems"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Insert production record
      const { data: prod, error: prodErr } = await supabase
        .from("productions")
        .insert({ source_product_id: sourceProductId, source_quantity: sourceQuantity })
        .select("id")
        .single();
      if (prodErr) throw prodErr;

      // Insert outputs
      const outputRows = outputs.filter((o) => o.product_id && o.quantity > 0).map((o) => ({
        production_id: prod.id,
        product_id: o.product_id,
        quantity: o.quantity,
      }));
      const { error: outErr } = await supabase.from("production_outputs").insert(outputRows);
      if (outErr) throw outErr;

      // Reduce source stock
      const srcProduct = products?.find((p) => p.id === sourceProductId);
      if (srcProduct) {
        await supabase.from("products").update({ stock_qty: Math.max(0, srcProduct.stock_qty - sourceQuantity) }).eq("id", sourceProductId);
      }

      // Increase output stocks
      for (const o of outputRows) {
        const outProduct = products?.find((p) => p.id === o.product_id);
        if (outProduct) {
          await supabase.from("products").update({ stock_qty: outProduct.stock_qty + o.quantity }).eq("id", o.product_id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      toast({ title: t("common.save") });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const pName = (p: any) => language === "ur" && p?.name_ur ? p.name_ur : p?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.production")}</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />{t("production.create")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("production.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                <Plus className="h-4 w-4 mr-1" /> {t("invoice.addItem")}
              </Button>
            </div>

            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            {t("production.history")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("production.source")}</TableHead>
                <TableHead>{t("production.sourceQty")}</TableHead>
                <TableHead>{t("production.outputs")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">{t("common.loading")}</TableCell></TableRow>
              ) : !productions?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                productions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.production_date}</TableCell>
                    <TableCell>{(p.products as any)?.name || "—"}</TableCell>
                    <TableCell>{p.source_quantity} KG</TableCell>
                    <TableCell>
                      {(p.production_outputs as any[])?.map((o: any, i: number) => (
                        <span key={i}>{o.products?.name}: {o.quantity} KG{i < (p.production_outputs as any[]).length - 1 ? ", " : ""}</span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Production;
