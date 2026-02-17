import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import InvoiceForm from "@/components/InvoiceForm";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
  pending: "outline",
};

const Purchases = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, contacts(name)")
        .eq("invoice_type", "purchase")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("invoice.purchases")}</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />{t("invoice.create")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("invoice.create")} — {t("invoice.purchases")}</DialogTitle>
          </DialogHeader>
          <InvoiceForm type="purchase" onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice.number")}</TableHead>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("invoice.contact")}</TableHead>
                <TableHead>{t("invoice.total")}</TableHead>
                <TableHead>{t("invoice.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">{t("common.loading")}</TableCell></TableRow>
              ) : !invoices?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.invoice_date}</TableCell>
                    <TableCell>{(inv.contacts as any)?.name || "—"}</TableCell>
                    <TableCell>₨ {inv.total?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[inv.payment_status] || "outline"}>
                        {t(`invoice.${inv.payment_status}`)}
                      </Badge>
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

export default Purchases;
