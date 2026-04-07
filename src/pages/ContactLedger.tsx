import { useParams, useNavigate } from "react-router-dom";
import { fmtAmount } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, DollarSign, ShoppingCart, Truck, Clock, CreditCard } from "lucide-react";
import { getBusinessUnitLabel } from "@/lib/business-units";
import { exportToCSV } from "@/lib/export-csv";
import { useState, useMemo } from "react";

// --- Invoice Detail Dialog ---
const InvoiceDetailDialog = ({ invoice, open, onOpenChange, t, statusColor }: {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
  statusColor: (s: string) => string;
}) => {
  const { language } = useLanguage();

  const { data: invoiceItems } = useQuery({
    queryKey: ["invoice-detail-items", invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*, products(name, name_ur), units(name, name_ur)")
        .eq("invoice_id", invoice.id);
      if (error) throw error;
      return data;
    },
    enabled: !!invoice?.id && open,
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {invoice.invoice_number}
            <Badge variant={statusColor(invoice.payment_status) as any}>
              {t(`invoice.${invoice.payment_status}`)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t("invoice.date")}:</span>{" "}
            <span className="font-medium">{invoice.invoice_date}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("invoice.type")}:</span>{" "}
            <Badge variant="outline" className="ml-1 text-xs">
              {invoice.invoice_type === "sale" ? t("invoice.sale") : t("invoice.purchase")}
            </Badge>
          </div>
          {invoice.business_unit && (
            <div className="col-span-2">
              <span className="text-muted-foreground">{t("businessUnit.label")}:</span>{" "}
              <span className="font-medium">{getBusinessUnitLabel(invoice.business_unit, t)}</span>
            </div>
          )}
        </div>

        <Separator />

        {invoiceItems && invoiceItems.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.name")}</TableHead>
                <TableHead className="text-right">{t("invoice.quantity")}</TableHead>
                <TableHead className="text-right">{t("invoice.price")}</TableHead>
                <TableHead className="text-right">{t("invoice.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {language === "ur" && item.products?.name_ur
                      ? item.products.name_ur
                      : item.products?.name || "—"}
                    {item.units && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({language === "ur" && item.units?.name_ur ? item.units.name_ur : item.units?.name})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{fmtAmount(item.price_per_unit)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtAmount(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

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

        {invoice.notes && (
          <>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("voucher.notes")}</p>
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Unified ledger entry type ---
type UnifiedEntry = {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  sourceType: "opening" | "invoice" | "payment";
  sourceData?: any;
};

const ContactLedger = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

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
        .order("invoice_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Two-step fetch for invoice-linked payments: use invoice IDs from fetched invoices
  const invoiceIds = useMemo(() => (invoices || []).map(i => i.id), [invoices]);

  const { data: invoicePayments } = useQuery({
    queryKey: ["contact-invoice-payments", id, invoiceIds],
    queryFn: async () => {
      if (!invoiceIds.length) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .in("invoice_id", invoiceIds)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id && invoiceIds.length > 0,
  });

  const { data: directVouchers } = useQuery({
    queryKey: ["contact-direct-vouchers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("contact_id", id!)
        .is("invoice_id", null)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch invoice items for CSV export (all invoices for this contact)
  const { data: allInvoiceItems } = useQuery({
    queryKey: ["contact-invoice-items", id, invoiceIds],
    queryFn: async () => {
      if (!invoiceIds.length) return [];
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*, products(name)")
        .in("invoice_id", invoiceIds);
      if (error) throw error;
      return data;
    },
    enabled: !!id && invoiceIds.length > 0,
  });

  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("account_category", "bank");
      return data || [];
    },
  });
  const bankNameMap = new Map((bankContacts || []).map(b => [b.id, b.name]));

  // Build invoice items map for CSV: invoiceId -> product names
  const invoiceProductsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    (allInvoiceItems || []).forEach((item: any) => {
      const invId = item.invoice_id;
      if (!map.has(invId)) map.set(invId, []);
      if (item.products?.name) map.get(invId)!.push(item.products.name);
    });
    return map;
  }, [allInvoiceItems]);

  const allPayments = useMemo(() => [...(invoicePayments || []), ...(directVouchers || [])], [invoicePayments, directVouchers]);

  const openingBalance = Number(contact?.opening_balance || 0);
  const openingBalanceDate = (contact as any)?.opening_balance_date || "2025-12-03";
  const totalSales = invoices?.filter(i => i.invoice_type === "sale").reduce((s, i) => s + (i.total || 0), 0) || 0;
  const totalPurchases = invoices?.filter(i => i.invoice_type === "purchase").reduce((s, i) => s + (i.total || 0), 0) || 0;
  const totalPaid = allPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const receiptVoucherTotal = (directVouchers || []).filter(p => p.voucher_type === "receipt").reduce((s, p) => s + (p.amount || 0), 0);
  const paymentVoucherTotal = (directVouchers || []).filter(p => p.voucher_type === "payment").reduce((s, p) => s + (p.amount || 0), 0);
  const invoiceBalanceDue = invoices?.reduce((s, i) => s + (i.balance_due || 0), 0) || 0;
  // Determine contact type for debit/credit logic
  const isSupplier = contact?.account_category === 'supplier' || contact?.contact_type === "supplier" || contact?.contact_type === "both";

  const totalOutstanding = isSupplier
    ? openingBalance + invoiceBalanceDue - paymentVoucherTotal + receiptVoucherTotal
    : openingBalance + invoiceBalanceDue - receiptVoucherTotal + paymentVoucherTotal;

  const lastTxDate = invoices?.length ? invoices[invoices.length - 1]?.invoice_date : "—";
  const unifiedEntries = useMemo(() => {
    const entries: UnifiedEntry[] = [];

    // Opening balance row
    if (openingBalance !== 0) {
      entries.push({
        id: "opening",
        date: openingBalanceDate,
        reference: "—",
        description: t("ledger.openingBalance"),
        debit: openingBalance > 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        sourceType: "opening",
      });
    }

    // Invoices
    (invoices || []).forEach(inv => {
      const desc = inv.invoice_type === "sale" ? t("invoice.sale") : t("invoice.purchase");
      entries.push({
        id: inv.id,
        date: inv.invoice_date,
        reference: inv.invoice_number,
        description: desc,
        debit: inv.total || 0,
        credit: 0,
        sourceType: "invoice",
        sourceData: inv,
      });
    });

    // Invoice-linked payments
    (invoicePayments || []).forEach(p => {
      const linkedInv = (invoices || []).find(i => i.id === p.invoice_id);
      const ref = p.voucher_number || linkedInv?.invoice_number || "—";
      const bankName = p.payment_method === "bank" && p.bank_contact_id ? bankNameMap.get(p.bank_contact_id) : undefined;
      const desc = (p.voucher_type === "receipt" ? t("voucher.receipt") : t("voucher.payment")) +
        (bankName ? ` — ${bankName}` : "");
      entries.push({
        id: p.id,
        date: p.payment_date,
        reference: ref,
        description: desc,
        debit: 0,
        credit: p.amount || 0,
        sourceType: "payment",
        sourceData: p,
      });
    });

    // Direct vouchers
    (directVouchers || []).forEach(p => {
      const bankName = p.payment_method === "bank" && p.bank_contact_id ? bankNameMap.get(p.bank_contact_id) : undefined;
      const baseLabel = p.voucher_type === "receipt" ? t("voucher.directReceipt") : t("voucher.directPayment");
      const desc = bankName ? `${baseLabel} — ${bankName}` : baseLabel;

      // Receipt = credit (reduces balance), Payment = debit (increases balance)
      entries.push({
        id: p.id,
        date: p.payment_date,
        reference: p.voucher_number || "—",
        description: desc,
        debit: p.voucher_type === "payment" ? (p.amount || 0) : 0,
        credit: p.voucher_type === "receipt" ? (p.amount || 0) : 0,
        sourceType: "payment",
        sourceData: p,
      });
    });

    // Sort by date ascending
    entries.sort((a, b) => a.date.localeCompare(b.date) || (a.sourceType === "opening" ? -1 : 0));

    return entries;
  }, [invoices, invoicePayments, directVouchers, openingBalance, openingBalanceDate, bankNameMap, t]);

  // Apply date filters
  const filteredEntries = useMemo(() => {
    return unifiedEntries.filter(e => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [unifiedEntries, dateFrom, dateTo]);

  // Compute running balance
  const entriesWithBalance = useMemo(() => {
    let balance = 0;
    return filteredEntries.map(e => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });
  }, [filteredEntries]);

  // ISSUE 3: Enhanced CSV export with product details
  const handleExportStatement = () => {
    const rows: (string | number)[][] = [];
    // Header info
    rows.push([`Statement for: ${contact?.name || ""}`, "", "", "", "", ""]);
    if (dateFrom || dateTo) {
      rows.push([`Period: ${dateFrom || "Start"} to ${dateTo || "End"}`, "", "", "", "", ""]);
    }
    rows.push(["", "", "", "", "", ""]);

    entriesWithBalance.forEach(e => {
      let desc = e.description;
      // Add product names for invoice rows
      if (e.sourceType === "invoice" && e.sourceData) {
        const products = invoiceProductsMap.get(e.sourceData.id);
        if (products?.length) {
          desc += ` [${products.join(", ")}]`;
        }
      }
      rows.push([e.date, e.reference, desc, e.debit || "", e.credit || "", e.balance]);
    });

    // Closing balance
    const closingBalance = entriesWithBalance.length > 0 ? entriesWithBalance[entriesWithBalance.length - 1].balance : 0;
    rows.push(["", "", "", "", "", ""]);
    rows.push(["", "", "Closing Balance", "", "", closingBalance]);

    exportToCSV(
      `statement-${contact?.name || "contact"}`,
      ["Date", "Reference", "Description", "Debit", "Credit", "Balance"],
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

  const handleRowClick = (entry: UnifiedEntry) => {
    if (entry.sourceType === "invoice") {
      setSelectedInvoice(entry.sourceData);
    } else if (entry.sourceType === "payment") {
      setSelectedVoucher(entry.sourceData);
    }
  };

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

      {/* Unified Ledger Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("ledger.title")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("invoice.number")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead className="text-right">{t("ledger.debit") || "Debit"}</TableHead>
                <TableHead className="text-right">{t("ledger.credit") || "Credit"}</TableHead>
                <TableHead className="text-right">{t("ledger.balance") || "Balance"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!entriesWithBalance.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : entriesWithBalance.map((e) => (
                <TableRow
                  key={e.id}
                  className={e.sourceType !== "opening" ? "cursor-pointer hover:bg-muted/50 transition-colors" : "bg-muted/30"}
                  onClick={() => handleRowClick(e)}
                >
                  <TableCell>{e.date}</TableCell>
                  <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                  <TableCell className="text-sm">{e.description}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {e.debit > 0 ? fmtAmount(e.debit) : ""}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {e.credit > 0 ? fmtAmount(e.credit) : ""}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm font-medium ${e.balance >= 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {fmtAmount(Math.abs(e.balance))} {e.balance >= 0 ? "DR" : "CR"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Voucher Detail Dialog */}
      <Dialog open={!!selectedVoucher} onOpenChange={(open) => !open && setSelectedVoucher(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("voucher.details")}</DialogTitle>
          </DialogHeader>
          {selectedVoucher && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("voucher.voucherNumber")}</span>
                <span className="font-mono">{selectedVoucher.voucher_number || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("invoice.date")}</span>
                <span>{selectedVoucher.payment_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("voucher.type")}</span>
                <Badge variant="outline">
                  {selectedVoucher.voucher_type === "receipt" ? t("voucher.receipt") : t("voucher.payment")}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("payment.amount")}</span>
                <span className="font-bold">{fmtAmount(selectedVoucher.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("voucher.method")}</span>
                <span className="capitalize">{selectedVoucher.payment_method || "—"}</span>
              </div>
              {selectedVoucher.payment_method === "bank" && selectedVoucher.bank_contact_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("voucher.bank")}</span>
                  <span>{bankNameMap.get(selectedVoucher.bank_contact_id) || "—"}</span>
                </div>
              )}
              {selectedVoucher.notes && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground mb-1">{t("voucher.notes")}</p>
                  <p className="whitespace-pre-wrap">{selectedVoucher.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
        t={t}
        statusColor={statusColor}
      />
    </div>
  );
};

export default ContactLedger;
