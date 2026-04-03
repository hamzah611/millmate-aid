import { useParams, useNavigate } from "react-router-dom";
import { fmtAmount, fmtQty } from "@/lib/utils";
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

  // Invoice-linked payments
  const { data: invoicePayments } = useQuery({
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

  // Standalone (direct) vouchers for this contact
  const { data: directVouchers } = useQuery({
    queryKey: ["contact-direct-vouchers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("contact_id", id!)
        .is("invoice_id", null)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch bank contacts for name lookup
  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("account_category", "bank");
      return data || [];
    },
  });
  const bankNameMap = new Map((bankContacts || []).map(b => [b.id, b.name]));

  // Combine all payments for totals
  const allPayments = [...(invoicePayments || []), ...(directVouchers || [])];

  const openingBalance = Number(contact?.opening_balance || 0);
  const openingBalanceDate = (contact as any)?.opening_balance_date || "2025-12-03";
  const totalSales = invoices?.filter(i => i.invoice_type === "sale").reduce((s, i) => s + (i.total || 0), 0) || 0;
  const totalPurchases = invoices?.filter(i => i.invoice_type === "purchase").reduce((s, i) => s + (i.total || 0), 0) || 0;
  const totalPaid = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalOutstanding = (invoices?.reduce((s, i) => s + (i.balance_due || 0), 0) || 0) + (openingBalance > 0 ? openingBalance : 0);
  const lastTxDate = invoices?.[0]?.invoice_date || "—";

  const filteredInvoices = invoices?.filter(inv => {
    if (dateFrom && inv.invoice_date < dateFrom) return false;
    if (dateTo && inv.invoice_date > dateTo) return false;
    return true;
  });

  const filteredInvoicePayments = (invoicePayments || []).filter(p => {
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    return true;
  });

  const filteredDirectVouchers = (directVouchers || []).filter(p => {
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    return true;
  });

  // Unified chronological ledger entries
  type LedgerEntry = {
    date: string;
    reference: string;
    type: string;
    amount: number;
    label: string;
    bankInfo?: string;
  };

  const ledgerEntries: LedgerEntry[] = [];

  // Add invoice-linked payments
  filteredInvoicePayments.forEach(p => {
    const bankName = (p as any).payment_method === "bank" && (p as any).bank_contact_id
      ? bankNameMap.get((p as any).bank_contact_id)
      : undefined;
    ledgerEntries.push({
      date: p.payment_date,
      reference: (p.invoices as any)?.invoice_number || "—",
      type: p.voucher_type === "receipt" ? t("voucher.receipt") : t("voucher.payment"),
      amount: p.amount,
      label: p.voucher_type === "receipt" ? t("voucher.receipt") : t("voucher.payment"),
      bankInfo: bankName || undefined,
    });
  });

  // Add standalone vouchers
  filteredDirectVouchers.forEach(p => {
    const bankName = (p as any).payment_method === "bank" && (p as any).bank_contact_id
      ? bankNameMap.get((p as any).bank_contact_id)
      : undefined;
    const baseLabel = p.voucher_type === "receipt" ? t("voucher.directReceipt") : t("voucher.directPayment");
    const label = bankName ? `${baseLabel} — ${bankName}` : baseLabel;
    ledgerEntries.push({
      date: p.payment_date,
      reference: (p as any).voucher_number || "—",
      type: baseLabel,
      amount: p.amount,
      label,
      bankInfo: bankName || undefined,
    });
  });

  // Sort chronologically (newest first)
  ledgerEntries.sort((a, b) => b.date.localeCompare(a.date));

  const handleExportStatement = () => {
    const rows: (string | number)[][] = [];
    rows.push(["--- Invoices ---", "", "", "", "", ""]);
    (filteredInvoices || []).forEach(inv => {
      rows.push([inv.invoice_number, inv.invoice_type, inv.invoice_date, inv.total, inv.amount_paid, inv.balance_due]);
    });
    rows.push(["--- Payments & Vouchers ---", "", "", "", "", ""]);
    ledgerEntries.forEach(e => {
      rows.push([e.reference, e.type, e.date, e.amount, "", ""]);
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
    { label: t("ledger.totalSales"), value: `${fmtAmount(totalSales)}`, icon: ShoppingCart },
    { label: t("ledger.totalPurchases"), value: `${fmtAmount(totalPurchases)}`, icon: Truck },
    { label: t("ledger.totalPaid"), value: `${fmtAmount(totalPaid)}`, icon: CreditCard },
    { label: t("ledger.totalOutstanding"), value: `${fmtAmount(totalOutstanding)}`, icon: DollarSign },
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
                      <TableCell>{fmtAmount(Math.abs(openingBalance))}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>{fmtAmount(Math.abs(openingBalance))}</TableCell>
                      <TableCell><Badge variant={openingBalance > 0 ? "destructive" : "default"}>{openingBalance > 0 ? "DR" : "CR"}</Badge></TableCell>
                    </TableRow>
                  )}
                  {filteredInvoices?.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell>{fmtAmount(inv.total)}</TableCell>
                      <TableCell>{fmtAmount(inv.amount_paid)}</TableCell>
                      <TableCell>{fmtAmount(inv.balance_due)}</TableCell>
                      <TableCell><Badge variant={statusColor(inv.payment_status)}>{t(`invoice.${inv.payment_status}`)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment & Voucher History (unified) */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("payment.history")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("voucher.voucherNumber")}</TableHead>
                <TableHead>{t("voucher.type")}</TableHead>
                <TableHead>{t("payment.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!ledgerEntries.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : ledgerEntries.map((e, i) => (
                <TableRow key={i}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                  <TableCell>
                    <Badge variant={e.type.includes("Direct") || e.type.includes("براہ") ? "secondary" : "outline"} className="text-xs">
                      {e.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtAmount(e.amount)}</TableCell>
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
