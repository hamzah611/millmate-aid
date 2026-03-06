import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Eye } from "lucide-react";

export function BatchTracking() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);

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

  const detailBatch = batches?.find((b) => b.id === detailBatchId);

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t("inventory.batchTracking")}</h2>
        <Button onClick={() => navigate("/inventory/batches/new")}>
          <Plus className="mr-2 h-4 w-4" />{t("inventory.addBatch")}
        </Button>
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

      {/* Batch Detail Dialog — view only, kept as dialog */}
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
