import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const BatchNew = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    product_id: "",
    batch_number: "",
    supplier_id: "",
    quantity: "",
    manufacture_date: "",
    quality_notes: "",
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name");
      return data || [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").in("contact_type", ["supplier", "both"]);
      return data || [];
    },
  });

  const createBatch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("batches").insert({
        product_id: form.product_id,
        batch_number: form.batch_number,
        supplier_id: form.supplier_id || null,
        quantity: Number(form.quantity),
        remaining_qty: Number(form.quantity),
        manufacture_date: form.manufacture_date || null,
        quality_notes: form.quality_notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast({ title: t("common.saved") });
      navigate("/inventory");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/inventory")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> {t("nav.inventory")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("inventory.addBatch")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("products.name")}</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t("products.name")} /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("inventory.batchNumber")}</Label>
            <Input value={form.batch_number} onChange={(e) => setForm((f) => ({ ...f, batch_number: e.target.value }))} />
          </div>
          <div>
            <Label>{t("inventory.supplier")}</Label>
            <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t("inventory.supplier")} /></SelectTrigger>
              <SelectContent>
                {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("invoice.quantity")}</Label>
            <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <Label>{t("inventory.manufactureDate")}</Label>
            <Input type="date" value={form.manufacture_date} onChange={(e) => setForm((f) => ({ ...f, manufacture_date: e.target.value }))} />
          </div>
          <div>
            <Label>{t("inventory.qualityNotes")}</Label>
            <Textarea value={form.quality_notes} onChange={(e) => setForm((f) => ({ ...f, quality_notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/inventory")}>{t("common.cancel")}</Button>
            <Button onClick={() => createBatch.mutate()} disabled={!form.product_id || !form.batch_number || !form.quantity || createBatch.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchNew;
