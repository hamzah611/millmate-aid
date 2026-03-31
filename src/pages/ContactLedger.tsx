import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, DollarSign, ShoppingCart, Truck, Clock, CreditCard } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { useState } from "react";

const ContactLedger = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: invoices } = useQuery({
    queryKey: ["contact-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("contact_id", id!)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["contact-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, invoices!inner(contact_id, invoice_number)")
        .eq("invoices.contact_id", id!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const openingBalance = Number(contact?.opening_balance || 0);
  const openingBalanceDate = (contact as any)?.opening_balance_date || "2025-12-03";
  const totalSales = invoices?.filter(i => i.invoice_type === "sale").reduce((s, i) => s + (i.total || 0), 0) || 0;
  const totalPurchases = invoices?.filter(i => i.invoice_type === "purchase").reduce((s, i) => s + (i.total || 0), 0) || 0;
  const totalPaid = payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
  const totalOutstanding = (invoices?.reduce((s, i) => s + (i.balance_due || 0), 0) || 0) + (openingBalance > 0 ? openingBalance : 0);
  const lastTxDate = invoices?.[0]?.invoice_date || "—";

  const filteredInvoices = invoices?.filter(inv => {
    if (dateFrom && inv.invoice_date < dateFrom) return false;
    if (dateTo && inv.invoice_date > dateTo) return false;
    return true;
  });

  const filteredPayments = payments?.filter(p => {
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    return true;
  });

  const handleExportStatement = () => {
    const rows: (string | number)[][] = [];
    rows.push(["--- Invoices ---", "", "", "", "", ""]);
    (filteredInvoices || []).forEach(inv => {
      rows.push([inv.invoice_number, inv.invoice_type, inv.invoice_date, inv.total, inv.amount_paid, inv.balance_due]);
    });
    rows.push(["--- Payments ---", "", "", "", "", ""]);
    (filteredPayments || []).forEach(p => {
      rows.push([(p.invoices as any)?.invoice_number || "", "payment", p.payment_date, p.amount, "", p.notes || ""]);
    });
    exportToCSV(
      `statement-${contact?.name || "contact"}`,
      ["Reference", "Type", "Date", "Amount", "Paid", "Balance/Notes"],
      rows
    );
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "default";
    if (s === "partial") return "secondary";
    return "destructive";
  };

  const summaryCards = [
    { label: t("ledger.totalSales"), value: `₨ ${totalSales.toLocaleString()}`, icon: ShoppingCart },
    { label: t("ledger.totalPurchases"), value: `₨ ${totalPurchases.toLocaleString()}`, icon: Truck },
    { label: t("ledger.totalPaid"), value: `₨ ${totalPaid.toLocaleString()}`, icon: CreditCard },
    { label: t("ledger.totalOutstanding"), value: `₨ ${totalOutstanding.toLocaleString()}`, icon: DollarSign },
    { label: t("ledger.lastTransaction"), value: lastTxDate, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{contact?.name || "..."}</h1>
          <p className="text-sm text-muted-foreground">{t("ledger.title")}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map(c => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-lg font-bold">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>{t("filter.clear")}</Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleExportStatement}>
          <Download className="me-2 h-4 w-4" />{t("ledger.downloadStatement")}
        </Button>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("ledger.invoiceHistory")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice.number")}</TableHead>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("invoice.total")}</TableHead>
                <TableHead>{t("invoice.amountPaid")}</TableHead>
                <TableHead>{t("invoice.balanceDue")}</TableHead>
                <TableHead>{t("invoice.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredInvoices?.length && openingBalance === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                <>
                  {openingBalance !== 0 && (!dateFrom || openingBalanceDate >= dateFrom) && (!dateTo || openingBalanceDate <= dateTo) && (
                    <TableRow>
                      <TableCell className="font-medium italic">{t("ledger.openingBalance")}</TableCell>
                      <TableCell>{openingBalanceDate}</TableCell>
                      <TableCell>₨ {Math.abs(openingBalance).toLocaleString()}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>₨ {Math.abs(openingBalance).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={openingBalance > 0 ? "destructive" : "default"}>{openingBalance > 0 ? "DR" : "CR"}</Badge></TableCell>
                    </TableRow>
                  )}
                  {filteredInvoices?.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell>₨ {inv.total.toLocaleString()}</TableCell>
                      <TableCell>₨ {inv.amount_paid.toLocaleString()}</TableCell>
                      <TableCell>₨ {inv.balance_due.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={statusColor(inv.payment_status)}>{t(`invoice.${inv.payment_status}`)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("payment.history")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("invoice.number")}</TableHead>
                <TableHead>{t("payment.amount")}</TableHead>
                <TableHead>{t("adjustments.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredPayments?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : filteredPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell>{(p.invoices as any)?.invoice_number || "—"}</TableCell>
                  <TableCell>₨ {p.amount.toLocaleString()}</TableCell>
                  <TableCell>{p.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactLedger;
