import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye } from "lucide-react";
import { format } from "date-fns";

export function BatchTracking() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
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

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("batches")
        .select("*, products(name), contacts(name)")
        .order("created_at", { ascending: false });
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
      setOpen(false);
      setForm({ product_id: "", batch_number: "", supplier_id: "", quantity: "", manufacture_date: "", quality_notes: "" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const detailBatch = batches?.find((b) => b.id === detailBatchId);

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t("inventory.batchTracking")}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />{t("inventory.addBatch")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("inventory.addBatch")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
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
              <Button className="w-full" onClick={() => createBatch.mutate()} disabled={!form.product_id || !form.batch_number || !form.quantity}>
                {t("common.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {batches?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("common.noData")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inventory.batchNumber")}</TableHead>
                  <TableHead>{t("products.name")}</TableHead>
                  <TableHead>{t("inventory.supplier")}</TableHead>
                  <TableHead className="text-right">{t("invoice.quantity")}</TableHead>
                  <TableHead className="text-right">{t("inventory.remaining")}</TableHead>
                  <TableHead>{t("invoice.date")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches?.map((batch) => {
                  const product = batch.products as unknown as { name: string } | null;
                  const supplier = batch.contacts as unknown as { name: string } | null;
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono font-medium">{batch.batch_number}</TableCell>
                      <TableCell>{product?.name || "—"}</TableCell>
                      <TableCell>{supplier?.name || "—"}</TableCell>
                      <TableCell className="text-right">{Number(batch.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(batch.remaining_qty) <= 0 ? "destructive" : "secondary"}>
                          {Number(batch.remaining_qty).toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.manufacture_date || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setDetailBatchId(batch.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch Detail Dialog */}
      <Dialog open={!!detailBatchId} onOpenChange={(v) => !v && setDetailBatchId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("inventory.batchDetail")}</DialogTitle></DialogHeader>
          {detailBatch && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">{t("inventory.batchNumber")}:</span>
                <span className="font-mono font-medium">{detailBatch.batch_number}</span>
                <span className="text-muted-foreground">{t("products.name")}:</span>
                <span>{(detailBatch.products as unknown as { name: string })?.name}</span>
                <span className="text-muted-foreground">{t("inventory.supplier")}:</span>
                <span>{(detailBatch.contacts as unknown as { name: string })?.name || "—"}</span>
                <span className="text-muted-foreground">{t("invoice.quantity")}:</span>
                <span>{Number(detailBatch.quantity).toLocaleString()}</span>
                <span className="text-muted-foreground">{t("inventory.remaining")}:</span>
                <span>{Number(detailBatch.remaining_qty).toLocaleString()}</span>
                <span className="text-muted-foreground">{t("inventory.manufactureDate")}:</span>
                <span>{detailBatch.manufacture_date || "—"}</span>
              </div>
              {detailBatch.quality_notes && (
                <div>
                  <p className="text-muted-foreground mb-1">{t("inventory.qualityNotes")}:</p>
                  <p className="bg-muted p-3 rounded-md">{detailBatch.quality_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
