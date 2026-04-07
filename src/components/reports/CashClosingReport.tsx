import { useMemo, useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Banknote, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

export function CashClosingReport() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(() => {
    const today = new Date();
    return { from: today, to: today };
  });

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");

  const { data: invoices, isLoading: li } = useQuery({
    queryKey: ["cash-closing-invoices", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_type, total, amount_paid, contact_id, contacts!invoices_contact_id_fkey(name)")
        .gte("invoice_date", fromDate)
        .lte("invoice_date", toDate);
      return data || [];
    },
  });

  const { data: payments, isLoading: lp } = useQuery({
    queryKey: ["cash-closing-payments", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, payment_method, voucher_type, invoice_id, invoices!inner(invoice_number, invoice_type, contact_id, contacts!invoices_contact_id_fkey(name))")
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate);
      return data || [];
    },
  });

  const summary = useMemo(() => {
    if (!invoices || !payments) return null;

    let totalSaleValue = 0;
    let totalPurchaseValue = 0;

    const saleInvoices: Array<{ number: string; contact: string; total: number; paid: number }> = [];
    const purchaseInvoices: Array<{ number: string; contact: string; total: number; paid: number }> = [];

    for (const inv of invoices) {
      const contact = inv.contacts as unknown as { name: string };
      const total = Number(inv.total);
      const paid = Number(inv.amount_paid);
      if (inv.invoice_type === "sale") {
        totalSaleValue += total;
        saleInvoices.push({ number: inv.invoice_number, contact: contact?.name || "", total, paid });
      } else {
        totalPurchaseValue += total;
        purchaseInvoices.push({ number: inv.invoice_number, contact: contact?.name || "", total, paid });
      }
    }

    // Cash movements from payments table only (no double counting)
    let cashFromSales = 0;
    let cashToPurchases = 0;
    const salePaymentDetails: Array<{ number: string; contact: string; amount: number; method: string }> = [];
    const purchasePaymentDetails: Array<{ number: string; contact: string; amount: number; method: string }> = [];

    for (const p of payments) {
      const inv = p.invoices as unknown as { invoice_number: string; invoice_type: string; contacts: { name: string } };
      const amount = Number(p.amount);
      const method = p.payment_method || "cash";
      const voucherType = (p as any).voucher_type || "receipt";
      if (inv.invoice_type === "sale") {
        if (method === "cash" && voucherType === "receipt") cashFromSales += amount;
        salePaymentDetails.push({ number: inv.invoice_number, contact: inv.contacts?.name || "", amount, method });
      } else {
        if (method === "cash" && voucherType === "payment") cashToPurchases += amount;
        purchasePaymentDetails.push({ number: inv.invoice_number, contact: inv.contacts?.name || "", amount, method });
      }
    }

    const totalCashIn = cashFromSales;
    const totalCashOut = cashToPurchases;
    const netCash = totalCashIn - totalCashOut;

    // Credit = invoice total minus all payments for that invoice (across all methods)
    const invoicePaidMap = new Map<string, number>();
    for (const p of payments) {
      if (p.invoice_id) {
        invoicePaidMap.set(p.invoice_id, (invoicePaidMap.get(p.invoice_id) || 0) + Number(p.amount));
      }
    }
    let creditGiven = 0;
    let creditTaken = 0;
    for (const inv of invoices) {
      const total = Number(inv.total);
      const paidViaVouchers = invoicePaidMap.get(inv.id) || 0;
      const unpaid = total - paidViaVouchers;
      if (inv.invoice_type === "sale") creditGiven += Math.max(0, unpaid);
      else creditTaken += Math.max(0, unpaid);
    }

    return {
      totalSaleValue, totalPurchaseValue,
      cashFromSales, cashToPurchases,
      totalCashIn, totalCashOut, netCash,
      creditGiven, creditTaken,
      saleInvoices, purchaseInvoices, salePaymentDetails, purchasePaymentDetails,
    };
  }, [invoices, payments]);

  if (li || lp) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <ArrowDownLeft className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.totalCashIn")}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fmtAmount(summary.totalCashIn)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <ArrowUpRight className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.totalCashOut")}</p>
                  <p className="text-2xl font-bold text-destructive">{fmtAmount(summary.totalCashOut)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Banknote className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.cashInHand")}</p>
                  <p className={`text-2xl font-bold ${summary.netCash >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {fmtAmount(summary.netCash)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("reports.creditGiven")}</p>
                <p className="text-xl font-bold">{fmtAmount(summary.creditGiven)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("reports.creditTaken")}</p>
                <p className="text-xl font-bold">{fmtAmount(summary.creditTaken)}</p>
              </CardContent>
            </Card>
          </div>

          {summary.saleInvoices.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t("reports.saleInvoicesToday")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoice.number")}</TableHead>
                      <TableHead>{t("invoice.contact")}</TableHead>
                      <TableHead className="text-end">{t("invoice.total")}</TableHead>
                      <TableHead className="text-end">{t("invoice.amountPaid")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.saleInvoices.map((inv, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{inv.number}</TableCell>
                        <TableCell>{inv.contact}</TableCell>
                        <TableCell className="text-end">{fmtAmount(inv.total)}</TableCell>
                        <TableCell className="text-end">{fmtAmount(inv.paid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {summary.purchaseInvoices.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t("reports.purchaseInvoicesToday")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoice.number")}</TableHead>
                      <TableHead>{t("invoice.contact")}</TableHead>
                      <TableHead className="text-end">{t("invoice.total")}</TableHead>
                      <TableHead className="text-end">{t("invoice.amountPaid")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.purchaseInvoices.map((inv, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{inv.number}</TableCell>
                        <TableCell>{inv.contact}</TableCell>
                        <TableCell className="text-end">{fmtAmount(inv.total)}</TableCell>
                        <TableCell className="text-end">{fmtAmount(inv.paid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {(summary.salePaymentDetails.length > 0 || summary.purchasePaymentDetails.length > 0) && (
            <Card>
              <CardHeader><CardTitle>{t("reports.followUpPayments")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoice.number")}</TableHead>
                      <TableHead>{t("invoice.contact")}</TableHead>
                      <TableHead>{t("contacts.type")}</TableHead>
                      <TableHead className="text-end">{t("payment.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.salePaymentDetails.map((p, i) => (
                      <TableRow key={`s-${i}`}>
                        <TableCell className="font-medium">{p.number}</TableCell>
                        <TableCell>{p.contact}</TableCell>
                        <TableCell className="text-green-600 dark:text-green-400">{t("reports.received")}</TableCell>
                        <TableCell className="text-end">{fmtAmount(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {summary.purchasePaymentDetails.map((p, i) => (
                      <TableRow key={`p-${i}`}>
                        <TableCell className="font-medium">{p.number}</TableCell>
                        <TableCell>{p.contact}</TableCell>
                        <TableCell className="text-destructive">{t("reports.paid")}</TableCell>
                        <TableCell className="text-end">{fmtAmount(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
