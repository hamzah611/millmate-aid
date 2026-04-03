import { useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import RecordPayment from "./RecordPayment";
import { getBusinessUnitLabel } from "@/lib/business-units";

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
  pending: "outline",
};

const InvoiceDetail = ({ invoiceId, open, onOpenChange }: Props) => {
  const { t, language } = useLanguage();
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const { data: invoice } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const { data, error } = await supabase
        .from("invoices")
        .select("*, contacts!invoices_contact_id_fkey(name)")
        .eq("id", invoiceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId && open,
  });

  const { data: brokerContact } = useQuery({
    queryKey: ["broker-contact", invoice?.broker_contact_id],
    queryFn: async () => {
      if (!invoice?.broker_contact_id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("name")
        .eq("id", invoice.broker_contact_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!invoice?.broker_contact_id,
  });

  const { data: commissionUnit } = useQuery({
    queryKey: ["commission-unit", invoice?.broker_commission_unit_id],
    queryFn: async () => {
      if (!invoice?.broker_commission_unit_id) return null;
      const { data, error } = await supabase
        .from("units")
        .select("name, name_ur")
        .eq("id", invoice.broker_commission_unit_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!invoice?.broker_commission_unit_id,
  });

  const { data: items } = useQuery({
    queryKey: ["invoice-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*, products(name, name_ur), units(name, name_ur)")
        .eq("invoice_id", invoiceId);
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId && open,
  });

  const { data: payments } = useQuery({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId && open,
  });

  const handlePaymentRecorded = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleDelete = async () => {
    if (!invoiceId || !invoice) return;
    setDeleting(true);
    try {
      const { data: invoiceItems } = await supabase
        .from("invoice_items")
        .select("*, units(kg_value)")
        .eq("invoice_id", invoiceId);

      if (invoiceItems) {
        for (const item of invoiceItems) {
          const kgValue = (item.units as any)?.kg_value || 1;
          const kgQty = item.quantity * kgValue;
          const { data: freshProduct } = await supabase
            .from("products")
            .select("stock_qty")
            .eq("id", item.product_id)
            .single();
          if (freshProduct) {
            const newStock = invoice.invoice_type === "sale"
              ? freshProduct.stock_qty + kgQty
              : Math.max(0, freshProduct.stock_qty - kgQty);
            await supabase.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
          }
        }
      }

      await supabase.from("payments").delete().eq("invoice_id", invoiceId);
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
      await supabase.from("invoices").delete().eq("id", invoiceId);

      toast.success(t("common.deleted"));
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (!invoice) return null;

  const showRecordPayment = invoice.balance_due > 0;

  const handleShareWhatsApp = () => {
    const contact = (invoice.contacts as any)?.name || "";
    const itemLines = items?.map((item) => {
      const name = (item.products as any)?.name || "";
      return `• ${name} x${item.quantity} = ${fmtAmount(item.total)}`;
    }).join("\n") || "";

    const msg = [
      `📋 Invoice: ${invoice.invoice_number}`,
      `📅 Date: ${invoice.invoice_date}`,
      `👤 ${contact}`,
      ``,
      itemLines,
      ``,
      `💰 Total: ${fmtAmount(invoice.total)}`,
      `✅ Paid: ${fmtAmount(invoice.amount_paid)}`,
      invoice.balance_due > 0 ? `⚠️ Balance: ${fmtAmount(invoice.balance_due)}` : "",
    ].filter(Boolean).join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const hasBroker = invoice.broker_contact_id && brokerContact;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {invoice.invoice_number}
            <Badge variant={statusColors[invoice.payment_status] || "outline"}>
              {t(`invoice.${invoice.payment_status}`)}
            </Badge>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleShareWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-1" />
                {t("invoice.shareWhatsApp")}
              </Button>
              {userRole === "owner" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("common.confirmDeleteDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleting ? t("common.loading") : t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Invoice info */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t("invoice.date")}:</span>{" "}
            <span className="font-medium">{invoice.invoice_date}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("invoice.contact")}:</span>{" "}
            <span className="font-medium">{(invoice.contacts as any)?.name || "—"}</span>
          </div>
          {invoice.business_unit && (
            <div className="col-span-2">
              <span className="text-muted-foreground">{t("businessUnit.label")}:</span>{" "}
              <span className="font-medium">{getBusinessUnitLabel(invoice.business_unit, t)}</span>
            </div>
          )}
        </div>

        {/* Broker info */}
        {hasBroker && (
          <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 rounded-md p-2">
            <div>
              <span className="text-muted-foreground">{t("invoice.broker")}:</span>{" "}
              <span className="font-medium">{brokerContact.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("invoice.commissionRate")}:</span>{" "}
              <span className="font-medium">
                ₨{invoice.broker_commission_rate}/{commissionUnit ? (language === "ur" && commissionUnit.name_ur ? commissionUnit.name_ur : commissionUnit.name) : ""}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t("invoice.commissionTotal")}:</span>{" "}
              <span className="font-semibold text-orange-600 dark:text-orange-400">{fmtAmount(invoice.broker_commission_total ?? 0)}</span>
            </div>
          </div>
        )}

        <Separator />

        {/* Line items */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.name")}</TableHead>
              <TableHead>{t("products.unit")}</TableHead>
              <TableHead className="text-right">{t("invoice.quantity")}</TableHead>
              <TableHead className="text-right">{t("invoice.price")}</TableHead>
              <TableHead className="text-right">{t("invoice.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {language === "ur" && (item.products as any)?.name_ur
                    ? (item.products as any).name_ur
                    : (item.products as any)?.name || "—"}
                </TableCell>
                <TableCell>
                  {language === "ur" && (item.units as any)?.name_ur
                    ? (item.units as any).name_ur
                    : (item.units as any)?.name || "—"}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{fmtAmount(item.price_per_unit)}</TableCell>
                <TableCell className="text-right font-medium">{fmtAmount(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("invoice.subtotal")}</span>
            <span>{fmtAmount(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoice.discount")}</span>
              <span>- {fmtAmount(invoice.discount)}</span>
            </div>
          )}
          {invoice.transport_charges > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoice.transport")}</span>
              <span>+ {fmtAmount(invoice.transport_charges)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>{t("invoice.total")}</span>
            <span>{fmtAmount(invoice.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("voucher.totalPaid")}</span>
            <span className="text-green-600 dark:text-green-400 font-medium">{fmtAmount(invoice.amount_paid)}</span>
          </div>
          {invoice.balance_due > 0 && (
            <div className="flex justify-between font-medium text-destructive">
              <span>{t("voucher.remaining")}</span>
              <span>{fmtAmount(invoice.balance_due)}</span>
            </div>
          )}
        </div>

        {/* Voucher history */}
        {payments && payments.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">{t("voucher.history")}</h4>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-1 gap-2">
                    <span className="text-muted-foreground shrink-0">{p.payment_date}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {(p as any).payment_method === "bank" ? t("voucher.bank") : t("voucher.cash")}
                    </Badge>
                    {(p as any).notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{(p as any).notes}</span>
                    )}
                    <span className="font-medium shrink-0 ml-auto">{fmtAmount(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Record payment */}
        {showRecordPayment && invoiceId && (
          <>
            <Separator />
            <RecordPayment
              invoiceId={invoiceId}
              balanceDue={invoice.balance_due}
              invoiceTotal={invoice.total}
              currentAmountPaid={invoice.amount_paid}
              contactId={invoice.contact_id}
              invoiceType={invoice.invoice_type}
              onSuccess={handlePaymentRecorded}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetail;
