import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { CalendarIcon, Banknote, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function CashClosingReport() {
  const { t } = useLanguage();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Invoices created on this date (initial payments)
  const { data: invoices, isLoading: li } = useQuery({
    queryKey: ["cash-closing-invoices", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_type, total, amount_paid, contact_id, contacts(name)")
        .eq("invoice_date", date);
      return data || [];
    },
  });

  // Payments recorded on this date (follow-up payments on older invoices)
  const { data: payments, isLoading: lp } = useQuery({
    queryKey: ["cash-closing-payments", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, invoice_id, invoices!inner(invoice_number, invoice_type, contact_id, contacts(name))")
        .eq("payment_date", date);
      return data || [];
    },
  });

  const summary = useMemo(() => {
    if (!invoices || !payments) return null;

    let cashFromSales = 0;
    let cashFromSalePayments = 0;
    let cashToPurchases = 0;
    let cashToPurchasePayments = 0;
    let totalSaleValue = 0;
    let totalPurchaseValue = 0;
    let creditGiven = 0;
    let creditTaken = 0;

    const saleInvoices: Array<{ number: string; contact: string; total: number; paid: number }> = [];
    const purchaseInvoices: Array<{ number: string; contact: string; total: number; paid: number }> = [];

    for (const inv of invoices) {
      const contact = inv.contacts as unknown as { name: string };
      const total = Number(inv.total);
      const paid = Number(inv.amount_paid);
      if (inv.invoice_type === "sale") {
        totalSaleValue += total;
        cashFromSales += paid;
        creditGiven += total - paid;
        saleInvoices.push({ number: inv.invoice_number, contact: contact?.name || "", total, paid });
      } else {
        totalPurchaseValue += total;
        cashToPurchases += paid;
        creditTaken += total - paid;
        purchaseInvoices.push({ number: inv.invoice_number, contact: contact?.name || "", total, paid });
      }
    }

    const salePaymentDetails: Array<{ number: string; contact: string; amount: number }> = [];
    const purchasePaymentDetails: Array<{ number: string; contact: string; amount: number }> = [];

    for (const p of payments) {
      const inv = p.invoices as unknown as { invoice_number: string; invoice_type: string; contacts: { name: string } };
      const amount = Number(p.amount);
      if (inv.invoice_type === "sale") {
        cashFromSalePayments += amount;
        salePaymentDetails.push({ number: inv.invoice_number, contact: inv.contacts?.name || "", amount });
      } else {
        cashToPurchasePayments += amount;
        purchasePaymentDetails.push({ number: inv.invoice_number, contact: inv.contacts?.name || "", amount });
      }
    }

    const totalCashIn = cashFromSales + cashFromSalePayments;
    const totalCashOut = cashToPurchases + cashToPurchasePayments;
    const netCash = totalCashIn - totalCashOut;

    return {
      totalSaleValue, totalPurchaseValue,
      cashFromSales, cashFromSalePayments, cashToPurchases, cashToPurchasePayments,
      totalCashIn, totalCashOut, netCash,
      creditGiven, creditTaken,
      saleInvoices, purchaseInvoices, salePaymentDetails, purchasePaymentDetails,
    };
  }, [invoices, payments]);

  if (li || lp) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t("reports.cashClosing")}</h2>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" />
        </div>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <ArrowDownLeft className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.totalCashIn")}</p>
                  <p className="text-2xl font-bold text-green-600">₨{summary.totalCashIn.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <ArrowUpRight className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.totalCashOut")}</p>
                  <p className="text-2xl font-bold text-destructive">₨{summary.totalCashOut.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Banknote className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.cashInHand")}</p>
                  <p className={`text-2xl font-bold ${summary.netCash >= 0 ? "text-green-600" : "text-destructive"}`}>
                    ₨{summary.netCash.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("reports.creditGiven")}</p>
                <p className="text-xl font-bold">₨{summary.creditGiven.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("reports.creditTaken")}</p>
                <p className="text-xl font-bold">₨{summary.creditTaken.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sale Invoices */}
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
                        <TableCell className="text-end">₨{inv.total.toLocaleString()}</TableCell>
                        <TableCell className="text-end">₨{inv.paid.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Purchase Invoices */}
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
                        <TableCell className="text-end">₨{inv.total.toLocaleString()}</TableCell>
                        <TableCell className="text-end">₨{inv.paid.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Follow-up payments */}
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
                      <TableHead className="text-right">{t("payment.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.salePaymentDetails.map((p, i) => (
                      <TableRow key={`s-${i}`}>
                        <TableCell className="font-medium">{p.number}</TableCell>
                        <TableCell>{p.contact}</TableCell>
                        <TableCell className="text-green-600">{t("reports.received")}</TableCell>
                        <TableCell className="text-right">₨{p.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {summary.purchasePaymentDetails.map((p, i) => (
                      <TableRow key={`p-${i}`}>
                        <TableCell className="font-medium">{p.number}</TableCell>
                        <TableCell>{p.contact}</TableCell>
                        <TableCell className="text-destructive">{t("reports.paid")}</TableCell>
                        <TableCell className="text-right">₨{p.amount.toLocaleString()}</TableCell>
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
