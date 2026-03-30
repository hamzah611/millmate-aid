import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
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
  const queryClient = useQueryClient();

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

  // Fetch broker contact name if present
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

  // Fetch broker commission unit name if present
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

  if (!invoice) return null;

  const showRecordPayment = invoice.payment_status === "credit" || invoice.payment_status === "partial";

  const handleShareWhatsApp = () => {
    const contact = (invoice.contacts as any)?.name || "";
    const itemLines = items?.map((item) => {
      const name = (item.products as any)?.name || "";
      return `• ${name} x${item.quantity} = ₨${item.total.toLocaleString()}`;
    }).join("\n") || "";

    const msg = [
      `📋 Invoice: ${invoice.invoice_number}`,
      `📅 Date: ${invoice.invoice_date}`,
      `👤 ${contact}`,
      ``,
      itemLines,
      ``,
      `💰 Total: ₨${invoice.total.toLocaleString()}`,
      `✅ Paid: ₨${invoice.amount_paid.toLocaleString()}`,
      invoice.balance_due > 0 ? `⚠️ Balance: ₨${invoice.balance_due.toLocaleString()}` : "",
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
            <Button variant="ghost" size="sm" onClick={handleShareWhatsApp} className="ml-auto">
              <MessageCircle className="h-4 w-4 mr-1" />
              {t("invoice.shareWhatsApp")}
            </Button>
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

        {/* Broker info (purchase only) */}
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
              <span className="font-semibold text-orange-600 dark:text-orange-400">₨ {invoice.broker_commission_total?.toLocaleString()}</span>
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
                <TableCell className="text-right">₨ {item.price_per_unit.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium">₨ {item.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("invoice.subtotal")}</span>
            <span>₨ {invoice.subtotal.toLocaleString()}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoice.discount")}</span>
              <span>- ₨ {invoice.discount.toLocaleString()}</span>
            </div>
          )}
          {invoice.transport_charges > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoice.transport")}</span>
              <span>+ ₨ {invoice.transport_charges.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>{t("invoice.total")}</span>
            <span>₨ {invoice.total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("invoice.amountPaid")}</span>
            <span>₨ {invoice.amount_paid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-medium text-destructive">
            <span>{t("invoice.balanceDue")}</span>
            <span>₨ {invoice.balance_due.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment history */}
        {payments && payments.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">{t("payment.history")}</h4>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">{p.payment_date}</span>
                    <span className="font-medium">₨ {p.amount.toLocaleString()}</span>
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
              currentAmountPaid={invoice.amount_paid}
              onSuccess={handlePaymentRecorded}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetail;
