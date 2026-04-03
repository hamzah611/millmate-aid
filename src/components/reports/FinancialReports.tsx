import { lazy, Suspense, useMemo, useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategoryBalances,
  calculateInventoryValue,
  calculateCashInHand,
  calculateBankBalances,
  calculateReceivables,
  calculatePayables,
} from "@/lib/financial-utils";
import type { BankBalance } from "@/lib/financial-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, ChevronRight, FileText, LayoutList } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/export-csv";
import { getBusinessUnitFilterOptions, matchesBusinessUnit, BUSINESS_UNITS } from "@/lib/business-units";
import { EXPENSE_ACCOUNT_CATEGORIES, getAccountCategoryLabel, fetchAccountCategories } from "@/lib/account-categories";
import type { DynamicAccountCategory } from "@/lib/account-categories";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

const BalanceSheetProfessional = lazy(() => import("./BalanceSheetProfessional"));

function StatRow({ label, value, bold, indent, negative }: { label: string; value: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <TableRow>
      <TableCell className={`${bold ? "font-bold" : ""} ${indent ? "pl-8" : ""}`}>{label}</TableCell>
      <TableCell className={`text-end font-mono ${bold ? "font-bold" : ""} ${negative && value < 0 ? "text-destructive" : ""}`}>
        ₨{fmtAmount(Math.abs(value)).slice(2)}
        {negative && value < 0 ? " (-)": ""}
      </TableCell>
    </TableRow>
  );
}

// === Breakdown by BU & Account Category ===
function BreakdownTable({ invoices, expenses, buFilter, t, dynamicCategories, language }: {
  invoices: { invoice_type: string; total: number; business_unit: string | null }[];
  expenses: { amount: number; business_unit: string | null; account_category: string | null }[];
  buFilter: string;
  t: (key: string) => string;
  dynamicCategories?: DynamicAccountCategory[];
  language?: string;
}) {


  const breakdown = useMemo(() => {
    let buColumns: { value: string | null; label: string }[] = [];
    if (buFilter === "all") {
      buColumns = BUSINESS_UNITS.map((bu) => ({ value: bu.value, label: t(bu.labelKey) }));
    } else if (buFilter === "unassigned") {
      buColumns = [{ value: null, label: t("accountCategory.unassigned") }];
    } else {
      const found = BUSINESS_UNITS.find((bu) => bu.value === buFilter);
      if (found) buColumns = [{ value: found.value, label: t(found.labelKey) }];
    }

    const revenueByBU = new Map<string | null, number>();
    for (const inv of invoices) {
      if (inv.invoice_type !== "sale") continue;
      const buKey = inv.business_unit || null;
      revenueByBU.set(buKey, (revenueByBU.get(buKey) || 0) + Number(inv.total));
    }

    const expenseCategories = [...EXPENSE_ACCOUNT_CATEGORIES, "unassigned"] as const;
    const expenseGrid = new Map<string, Map<string | null, number>>();
    for (const cat of expenseCategories) {
      expenseGrid.set(cat, new Map());
    }
    for (const exp of expenses) {
      const buKey = exp.business_unit || null;
      const catKey = exp.account_category || "unassigned";
      const row = expenseGrid.get(catKey) || expenseGrid.get("unassigned")!;
      row.set(buKey, (row.get(buKey) || 0) + Number(exp.amount));
    }

    return { buColumns, revenueByBU, expenseCategories, expenseGrid };
  }, [invoices, expenses, buFilter, t]);

  if (breakdown.buColumns.length === 0) return null;

  const getCatLabel = (cat: string) =>
    cat === "unassigned" ? t("accountCategory.unassigned") : getAccountCategoryLabel(cat, t, dynamicCategories, language);

  const hasAnyData = breakdown.buColumns.some((col) => {
    if ((breakdown.revenueByBU.get(col.value) || 0) > 0) return true;
    for (const [, buMap] of breakdown.expenseGrid) {
      if ((buMap.get(col.value) || 0) > 0) return true;
    }
    return false;
  });

  return (
    <Card>
      <CardHeader><CardTitle>{t("reports.breakdownTitle")}</CardTitle></CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="text-muted-foreground text-center py-4">{t("common.noData")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.lineItem")}</TableHead>
                {breakdown.buColumns.map((col) => (
                  <TableHead key={String(col.value)} className="text-end">{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-bold">{t("reports.revenueLabel")}</TableCell>
                {breakdown.buColumns.map((col) => (
                  <TableCell key={String(col.value)} className="text-end font-mono font-bold">
                    ₨{fmtAmount(breakdown.revenueByBU.get(col.value) || 0).slice(2)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow><TableCell colSpan={breakdown.buColumns.length + 1}><Separator /></TableCell></TableRow>
              {breakdown.expenseCategories.map((cat) => {
                const buMap = breakdown.expenseGrid.get(cat)!;
                return (
                  <TableRow key={cat}>
                    <TableCell className="pl-8">{getCatLabel(cat)}</TableCell>
                    {breakdown.buColumns.map((col) => (
                      <TableCell key={String(col.value)} className="text-end font-mono">
                        ₨{fmtAmount(buMap.get(col.value) || 0).slice(2)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// === Profit & Loss ===
export function ProfitLossReport() {
  const { t, language } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);
  const [buFilter, setBuFilter] = useState("all");

  const { data: dynamicAcCategories } = useQuery({
    queryKey: ["account_categories"],
    queryFn: fetchAccountCategories,
  });

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");
  const rangeLabel = `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`;

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["financial-invoices", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_type, total, discount, transport_charges, business_unit")
        .gte("invoice_date", fromDate)
        .lte("invoice_date", toDate);
      return data || [];
    },
  });

  const { data: expensesTotal, isLoading: loadingExpenses } = useQuery({
    queryKey: ["financial-expenses", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, business_unit, account_category")
        .gte("expense_date", fromDate)
        .lte("expense_date", toDate);
      return data || [];
    },
  });

  const pnl = useMemo(() => {
    if (!invoices || !expensesTotal) return null;
    let saleRevenue = 0, purchaseCost = 0;
    for (const inv of invoices) {
      if (!matchesBusinessUnit(inv.business_unit, buFilter)) continue;
      const total = Number(inv.total);
      if (inv.invoice_type === "sale") {
        saleRevenue += total;
      } else {
        purchaseCost += total;
      }
    }
    const grossProfit = saleRevenue - purchaseCost;
    const operatingExpenses = (expensesTotal || [])
      .filter((e) => matchesBusinessUnit(e.business_unit, buFilter))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = grossProfit - operatingExpenses;
    const marginPct = saleRevenue > 0 ? (netProfit / saleRevenue) * 100 : 0;
    return { saleRevenue, purchaseCost, grossProfit, operatingExpenses, netProfit, marginPct };
  }, [invoices, expensesTotal, buFilter]);

  if (isLoading || loadingExpenses) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t("reports.profitLoss")} — {rangeLabel}</h2>
        <div className="flex items-center gap-2">
          {pnl && (
            <Button variant="outline" size="sm" onClick={() => {
              exportToCSV(`pnl-${rangeLabel}`, ["Line Item", "Amount (₨)"], [
                [t("reports.totalRevenue"), pnl.saleRevenue],
                [t("reports.cogs"), pnl.purchaseCost],
                [t("reports.grossProfit"), pnl.grossProfit],
                [t("reports.operatingExpenses"), pnl.operatingExpenses],
                [t("reports.netProfit"), pnl.netProfit],
              ]);
            }}>
              <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
            </Button>
          )}
          <Select value={buFilter} onValueChange={setBuFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getBusinessUnitFilterOptions(t).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {pnl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.totalRevenue")}</p>
              <p className="text-2xl font-bold">{fmtAmount(pnl.saleRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.cogs")}</p>
              <p className="text-2xl font-bold">{fmtAmount(pnl.purchaseCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.netProfit")}</p>
              <p className={`text-2xl font-bold ${pnl.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                {fmtAmount(pnl.netProfit)} ({pnl.marginPct.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      {pnl && (
        <Card>
          <CardHeader><CardTitle>{t("reports.profitLossStatement")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.lineItem")}</TableHead>
                  <TableHead className="text-end">{t("payment.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <StatRow label={t("reports.totalRevenue")} value={pnl.saleRevenue} bold />
                <StatRow label={t("reports.cogs")} value={pnl.purchaseCost} indent />
                <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
                <StatRow label={t("reports.grossProfit")} value={pnl.grossProfit} bold negative />
                <StatRow label={t("reports.operatingExpenses")} value={pnl.operatingExpenses} indent />
                <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
                <StatRow label={t("reports.netProfit")} value={pnl.netProfit} bold negative />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {pnl && <BreakdownTable invoices={invoices || []} expenses={expensesTotal || []} buFilter={buFilter} t={t} dynamicCategories={dynamicAcCategories} language={language} />}
    </div>
  );
}

// === Cash Flow ===
export function CashFlowReport() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");
  const rangeLabel = `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`;

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["cashflow-payments", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, invoice_id, payment_date, invoices!inner(invoice_type)")
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate);
      return data || [];
    },
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["cashflow-invoices", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_type, amount_paid, invoice_date")
        .gte("invoice_date", fromDate)
        .lte("invoice_date", toDate);
      return data || [];
    },
  });

  const { data: cashExpenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["cashflow-expenses", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("payment_method", "cash")
        .gte("expense_date", fromDate)
        .lte("expense_date", toDate);
      return data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    },
  });

  const flow = useMemo(() => {
    if (!payments || !invoices || cashExpenses === undefined) return null;

    let totalInflow = 0;
    let totalOutflow = 0;

    for (const inv of invoices) {
      const paid = Number(inv.amount_paid);
      if (paid > 0) {
        if (inv.invoice_type === "sale") totalInflow += paid;
        else totalOutflow += paid;
      }
    }

    const totalCashExpenses = cashExpenses || 0;
    const purchaseOutflow = totalOutflow;
    totalOutflow += totalCashExpenses;
    const netCashFlow = totalInflow - totalOutflow;

    return { totalInflow, purchaseOutflow, totalCashExpenses, totalOutflow, netCashFlow };
  }, [payments, invoices, cashExpenses]);

  if (loadingPayments || loadingInvoices || loadingExpenses) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t("reports.cashFlow")} — {rangeLabel}</h2>
        <div className="flex items-center gap-2">
          {flow && (
            <Button variant="outline" size="sm" onClick={() => {
              exportToCSV(`cashflow-${rangeLabel}`, ["Line Item", "Amount (₨)"], [
                [t("reports.cashInflows"), flow.totalInflow],
                [t("reports.salePaymentsReceived"), flow.totalInflow],
                [t("reports.purchasePaymentsMade"), flow.purchaseOutflow],
                [t("reports.cashExpenses"), flow.totalCashExpenses],
                [t("reports.cashOutflows"), flow.totalOutflow],
                [t("reports.netCashFlow"), flow.netCashFlow],
              ]);
            }}>
              <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
            </Button>
          )}
        </div>
      </div>
      {flow && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.totalInflow")}</p>
              <p className="text-2xl font-bold text-green-600">{fmtAmount(flow.totalInflow)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.totalOutflow")}</p>
              <p className="text-2xl font-bold text-destructive">{fmtAmount(flow.totalOutflow)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.netCashFlow")}</p>
              <p className={`text-2xl font-bold ${flow.netCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                {fmtAmount(flow.netCashFlow)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      {flow && (
        <Card>
          <CardHeader><CardTitle>{t("reports.cashFlowStatement")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.lineItem")}</TableHead>
                  <TableHead className="text-end">{t("payment.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <StatRow label={t("reports.cashInflows")} value={flow.totalInflow} bold />
                <StatRow label={t("reports.salePaymentsReceived")} value={flow.totalInflow} indent />
                <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
                <StatRow label={t("reports.cashOutflows")} value={flow.totalOutflow} bold />
                <StatRow label={t("reports.purchasePaymentsMade")} value={flow.purchaseOutflow} indent />
                <StatRow label={t("reports.cashExpenses")} value={flow.totalCashExpenses} indent />
                <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
                <StatRow label={t("reports.netCashFlow")} value={flow.netCashFlow} bold negative />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// === Balance Sheet ===

/** Local formatter: ₨ with space, full decimal precision, parentheses for negatives */
export function bsFmt(n: number): string {
  const abs = Math.abs(n);
  const formatted = `₨ ${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}`;
  return n < 0 ? `(${formatted})` : formatted;
}

export function BSLineItem({ label, value, bold, indent, sub }: { label: string; value: number; bold?: boolean; indent?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-2.5 border-b border-border/20 ${indent ? "pl-6" : ""} ${sub ? "pl-10 text-sm text-muted-foreground" : ""}`}>
      <span className={bold ? "font-bold text-base" : "text-base"}>{label}</span>
      <span className={`font-mono text-base tabular-nums ${bold ? "font-bold" : ""} ${value < 0 ? "text-destructive" : ""}`}>
        {bsFmt(value)}
      </span>
    </div>
  );
}

export function BSCollapsibleItem({
  label,
  value,
  children,
  onOpen,
  defaultOpen,
}: {
  label: string;
  value: number;
  children: React.ReactNode;
  onOpen?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <Collapsible open={open} onOpenChange={(v) => { setOpen(v); if (v && onOpen) onOpen(); }}>
      <CollapsibleTrigger className="w-full">
        <div className="flex justify-between items-center py-2.5 pl-6 pr-0 hover:bg-muted/30 rounded-md cursor-pointer transition-colors border-b border-border/20">
          <span className="flex items-center gap-2 text-base">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
            {label}
          </span>
          <span className={`font-mono text-base tabular-nums ${value < 0 ? "text-destructive" : ""}`}>
            {bsFmt(value)}
          </span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-2 py-2 space-y-1 border-l-2 border-primary/20 ml-7 mb-3 bg-muted/10 rounded-r-md">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BSSubLine({ label, value, sign }: { label: string; value: number; sign?: "+" | "-" }) {
  return (
    <div className="flex justify-between items-baseline py-1">
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        {sign && <span className={`font-mono text-sm ${sign === "+" ? "text-green-600" : "text-destructive"}`}>{sign}</span>}
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-muted-foreground">{bsFmt(value)}</span>
    </div>
  );
}

export function BSSectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-muted/60 rounded-md px-4 py-2.5 mt-5 first:mt-0 mb-1">
      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
    </div>
  );
}

export function BSTotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-baseline py-3 mt-3 border-t-2 border-foreground/20">
      <span className="font-bold text-lg">{label}</span>
      <span className={`font-mono font-bold text-lg tabular-nums ${value < 0 ? "text-destructive" : ""}`}>
        {bsFmt(value)}
      </span>
    </div>
  );
}

export function BalanceSheetReport() {
  const { t, language } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);
  const [professionalView, setProfessionalView] = useState(false);
  const toDate = format(range.to, "yyyy-MM-dd");

  const { data: dynamicAcCategories } = useQuery({
    queryKey: ["account_categories"],
    queryFn: fetchAccountCategories,
  });

  // Shared helpers — same as dashboard
  const { data: cashData, isLoading: lCash } = useQuery({
    queryKey: ["bs-cash"],
    queryFn: () => calculateCashInHand(),
  });

  const { data: bankData, isLoading: lBank } = useQuery({
    queryKey: ["bs-banks"],
    queryFn: () => calculateBankBalances(),
  });

  const { data: recvData, isLoading: lRecv } = useQuery({
    queryKey: ["bs-receivables"],
    queryFn: () => calculateReceivables(),
  });

  const { data: payData, isLoading: lPay } = useQuery({
    queryKey: ["bs-payables"],
    queryFn: () => calculatePayables(),
  });

  const { data: inventoryData, isLoading: lInv } = useQuery({
    queryKey: ["bs-inventory"],
    queryFn: () => calculateInventoryValue(),
  });

  const { data: catBalances, isLoading: lCat } = useQuery({
    queryKey: ["bs-categories", toDate],
    queryFn: () => fetchCategoryBalances(toDate),
  });

  // Drill-down: customer list with invoice balances (lazy)
  const [showCustomers, setShowCustomers] = useState(false);
  const { data: customerList } = useQuery({
    queryKey: ["bs-customer-list-rich"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "customer");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, balance_due")
        .eq("invoice_type", "sale")
        .gt("balance_due", 0);
      const invMap = new Map<string, number>();
      for (const inv of invoices || []) {
        invMap.set(inv.contact_id, (invMap.get(inv.contact_id) || 0) + Number(inv.balance_due));
      }
      const result = (contacts || []).map(c => ({
        name: c.name,
        opening: Number(c.opening_balance || 0),
        invoiceBalance: invMap.get(c.id) || 0,
        total: Number(c.opening_balance || 0) + (invMap.get(c.id) || 0),
      })).filter(c => Math.abs(c.total) > 0);
      result.sort((a, b) => b.total - a.total);
      return result;
    },
    enabled: showCustomers,
  });

  // Drill-down: supplier list with invoice balances (lazy)
  const [showSuppliers, setShowSuppliers] = useState(false);
  const { data: supplierList } = useQuery({
    queryKey: ["bs-supplier-list-rich"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "supplier");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, balance_due")
        .eq("invoice_type", "purchase")
        .gt("balance_due", 0);
      const invMap = new Map<string, number>();
      for (const inv of invoices || []) {
        invMap.set(inv.contact_id, (invMap.get(inv.contact_id) || 0) + Number(inv.balance_due));
      }
      const result = (contacts || []).map(c => ({
        name: c.name,
        opening: Math.abs(Number(c.opening_balance || 0)),
        invoiceBalance: invMap.get(c.id) || 0,
        total: Math.abs(Number(c.opening_balance || 0)) + (invMap.get(c.id) || 0),
      })).filter(c => Math.abs(c.total) > 0);
      result.sort((a, b) => b.total - a.total);
      return result;
    },
    enabled: showSuppliers,
  });

  // Drill-down: employee list (lazy)
  const [showEmployees, setShowEmployees] = useState(false);
  const { data: employeeList } = useQuery({
    queryKey: ["bs-employee-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("name, opening_balance")
        .eq("account_category", "employee")
        .neq("opening_balance", 0)
        .order("opening_balance", { ascending: false });
      return data || [];
    },
    enabled: showEmployees,
  });

  // Drill-down: closing/capital accounts (lazy)
  const [showCapital, setShowCapital] = useState(false);
  const { data: capitalList } = useQuery({
    queryKey: ["bs-capital-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("name, opening_balance")
        .eq("account_category", "closing")
        .neq("opening_balance", 0)
        .order("opening_balance", { ascending: false });
      return data || [];
    },
    enabled: showCapital,
  });

  // Inventory show-all toggle
  const [showAllInventory, setShowAllInventory] = useState(false);

  const isLoading = lCash || lBank || lRecv || lPay || lInv || lCat;
  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  const bal = catBalances || { cashBalance: 0, bankBalance: 0, customerReceivables: 0, supplierPayables: 0, employeeReceivables: 0, capitalEquity: 0 };

  // Assets — using shared helpers (same values as dashboard)
  const cashInHand = cashData?.total || 0;
  const bankTotal = bankData?.reduce((s, b) => s + b.balance, 0) || 0;
  const customerReceivables = recvData?.total || 0;
  const employeeReceivables = bal.employeeReceivables;
  const inventoryValue = inventoryData?.totalValue || 0;
  const totalAssets = cashInHand + bankTotal + customerReceivables + employeeReceivables + inventoryValue;

  // Liabilities
  const supplierPayables = payData?.total || 0;
  const totalLiabilities = supplierPayables;

  // Equity
  const capitalEquity = bal.capitalEquity;
  const retainedEarnings = totalAssets - totalLiabilities - capitalEquity;
  const totalEquity = capitalEquity + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

  const inventoryProducts = inventoryData?.products || [];
  const visibleProducts = showAllInventory ? inventoryProducts : inventoryProducts.slice(0, 10);

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("reports.balanceSheet")}</h2>
          <p className="text-sm text-muted-foreground">
            As of {format(range.to, "dd MMM yyyy")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          exportToCSV("balance-sheet", ["Line Item", "Amount (₨)"], [
            ["--- ASSETS (DEBIT) ---", ""],
            [t("reports.cashInHand"), cashInHand],
            [t("reports.bankAccounts"), bankTotal],
            ...(bankData || []).map(b => [`  ${b.name}`, b.balance]),
            [t("reports.customerReceivables"), customerReceivables],
            [t("reports.employeeReceivables"), employeeReceivables],
            [t("reports.inventoryValue"), inventoryValue],
            [t("reports.totalAssets"), totalAssets],
            ["", ""],
            ["--- LIABILITIES + EQUITY (CREDIT) ---", ""],
            [t("reports.supplierPayables"), supplierPayables],
            [t("reports.totalLiabilities") || "Total Liabilities", totalLiabilities],
            [t("reports.closingAccounts"), capitalEquity],
            [t("reports.retainedEarnings"), retainedEarnings],
            [t("reports.capitalEquity"), totalEquity],
            ["Total Liabilities + Equity", totalLiabilitiesAndEquity],
          ]);
        }}>
          <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
        </Button>
      </div>

      {!isBalanced && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <span className="text-destructive text-lg">⚠</span>
          <div>
            <p className="font-semibold text-destructive text-sm">Balance Sheet Not Balanced</p>
            <p className="text-xs text-muted-foreground">
              Assets: {bsFmt(totalAssets)} ≠ Liabilities + Equity: {bsFmt(totalLiabilitiesAndEquity)}
              {" "}(Difference: {bsFmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))})
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Assets (Debit) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 bg-primary/5 rounded-t-lg border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-chart-2" />
              {t("reports.assets")} <span className="text-sm text-muted-foreground font-normal">(Debit)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-6 space-y-1 px-5">
            <BSSectionHeader title={t("reports.currentAssets") || "Current Assets"} />

            {/* Cash in Hand — collapsible */}
            <BSCollapsibleItem label={t("reports.cashInHand")} value={cashInHand}>
              {cashData && (
                <>
                  <BSSubLine label={t("contacts.openingBalance")} value={cashData.opening} sign="+" />
                  <BSSubLine label={t("reports.received") + " (vouchers)"} value={cashData.cashReceipts} sign="+" />
                  {cashData.untrackedSaleCash > 0 && <BSSubLine label={t("reports.received") + " (initial)"} value={cashData.untrackedSaleCash} sign="+" />}
                  <BSSubLine label={t("reports.paid") + " (vouchers)"} value={cashData.cashPayments} sign="-" />
                  {cashData.untrackedPurchaseCash > 0 && <BSSubLine label={t("reports.paid") + " (initial)"} value={cashData.untrackedPurchaseCash} sign="-" />}
                  <BSSubLine label={t("nav.expenses")} value={cashData.cashExpenses} sign="-" />
                </>
              )}
            </BSCollapsibleItem>

            {/* Bank Accounts — collapsible with per-bank */}
            {bankData && bankData.length > 0 && (
              <BSCollapsibleItem label={t("reports.bankAccounts")} value={bankTotal}>
                {bankData.map((bank: BankBalance) => (
                  <div key={bank.id} className="mb-2">
                    <div className="flex justify-between items-baseline py-1">
                      <span className="text-sm font-medium">{bank.name}</span>
                      <span className="font-mono text-sm tabular-nums">{bsFmt(bank.balance)}</span>
                    </div>
                    <div className="pl-3 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between"><span>Opening</span><span>{bsFmt(bank.opening)}</span></div>
                      <div className="flex justify-between"><span>+ Receipts</span><span>{bsFmt(bank.receipts)}</span></div>
                      <div className="flex justify-between"><span>- Payments</span><span>{bsFmt(bank.payments)}</span></div>
                      <div className="flex justify-between"><span>- Expenses</span><span>{bsFmt(bank.expenses)}</span></div>
                    </div>
                  </div>
                ))}
              </BSCollapsibleItem>
            )}
            {(!bankData || bankData.length === 0) && (
              <BSLineItem label={t("reports.bankAccounts")} value={0} indent />
            )}

            {/* Customer Receivables — collapsible with rich drill-down */}
            <BSCollapsibleItem label={t("reports.customerReceivables")} value={customerReceivables} onOpen={() => setShowCustomers(true)}>
              {recvData && (
                <>
                  <BSSubLine label={t("contacts.openingBalance")} value={recvData.openingBalance} sign="+" />
                  <BSSubLine label="Invoice Balances" value={recvData.invoiceBalance} sign="+" />
                </>
              )}
              {customerList && customerList.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Top Customers</p>
                  {customerList.map((c, i) => (
                    <BSSubLine key={i} label={c.name} value={c.total} />
                  ))}
                </div>
              )}
            </BSCollapsibleItem>

            {/* Employee Receivables — always show, collapsible */}
            <BSCollapsibleItem label={t("reports.employeeReceivables")} value={employeeReceivables} onOpen={() => setShowEmployees(true)}>
              {employeeList && employeeList.length > 0 ? (
                employeeList.map((e, i) => (
                  <BSSubLine key={i} label={e.name} value={Number(e.opening_balance)} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-1">No employee balances</p>
              )}
            </BSCollapsibleItem>

            <BSSectionHeader title={t("reports.inventoryValue") || "Inventory"} />

            {/* Inventory — collapsible with show-all */}
            <BSCollapsibleItem
              label={`${t("reports.inventoryValue")}${inventoryData?.hasValuationGap ? " ⚠" : ""}${inventoryData?.hasOpeningStock ? " *" : ""}`}
              value={inventoryValue}
            >
              {visibleProducts.map(p => (
                <div key={p.id} className="flex justify-between items-baseline py-0.5">
                  <span className="text-xs text-muted-foreground">{p.name} ({fmtQty(p.stockInUnit)} {p.unitName})</span>
                  <span className="font-mono text-xs tabular-nums">{bsFmt(p.inventoryValue)}</span>
                </div>
              ))}
              {inventoryProducts.length > 10 && !showAllInventory && (
                <button className="text-xs text-primary underline mt-1" onClick={() => setShowAllInventory(true)}>
                  Show all {inventoryProducts.length} products
                </button>
              )}
            </BSCollapsibleItem>

            <BSTotalRow label={t("reports.totalAssets")} value={totalAssets} />
          </CardContent>
        </Card>

        {/* RIGHT: Liabilities + Equity (Credit) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 bg-destructive/5 rounded-t-lg border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-destructive" />
              {t("reports.liabilities")} + {t("reports.capitalEquity")} <span className="text-sm text-muted-foreground font-normal">(Credit)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-6 space-y-1 px-5">
            <BSSectionHeader title={t("reports.currentLiabilities") || "Current Liabilities"} />

            {/* Supplier Payables — collapsible with rich drill-down */}
            <BSCollapsibleItem label={t("reports.supplierPayables")} value={supplierPayables} onOpen={() => setShowSuppliers(true)}>
              {payData && (
                <>
                  <BSSubLine label={t("contacts.openingBalance")} value={payData.openingBalance} sign="+" />
                  <BSSubLine label="Invoice Balances" value={payData.invoiceBalance} sign="+" />
                </>
              )}
              {supplierList && supplierList.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Top Suppliers</p>
                  {supplierList.map((c, i) => (
                    <BSSubLine key={i} label={c.name} value={c.total} />
                  ))}
                </div>
              )}
            </BSCollapsibleItem>

            <div className="flex justify-between items-baseline py-2.5 mt-2 border-t border-border/50">
              <span className="font-semibold text-base pl-2">{t("reports.totalLiabilities") || "Total Liabilities"}</span>
              <span className="font-mono font-semibold text-base tabular-nums">{bsFmt(totalLiabilities)}</span>
            </div>

            <BSSectionHeader title={t("reports.capitalEquity") || "Equity / Capital"} />

            {/* Capital — collapsible with individual accounts */}
            <BSCollapsibleItem label={t("reports.closingAccounts")} value={capitalEquity} onOpen={() => setShowCapital(true)}>
              {capitalList && capitalList.length > 0 ? (
                capitalList.map((c, i) => (
                  <BSSubLine key={i} label={c.name} value={Number(c.opening_balance)} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-1">No capital accounts</p>
              )}
            </BSCollapsibleItem>

            {/* Retained Earnings — collapsible with calculation breakdown */}
            <BSCollapsibleItem label={t("reports.retainedEarnings")} value={retainedEarnings}>
              <BSSubLine label={t("reports.totalAssets")} value={totalAssets} />
              <BSSubLine label={t("reports.totalLiabilities") || "Total Liabilities"} value={totalLiabilities} sign="-" />
              <BSSubLine label={t("reports.closingAccounts") + " (Capital)"} value={capitalEquity} sign="-" />
              <div className="border-t border-border/30 mt-1 pt-1">
                <BSSubLine label="= Retained Earnings" value={retainedEarnings} />
              </div>
            </BSCollapsibleItem>

            <div className="flex justify-between items-baseline py-2.5 mt-2 border-t border-border/50">
              <span className="font-semibold text-base pl-2">{t("reports.capitalEquity")}</span>
              <span className={`font-mono font-semibold text-base tabular-nums ${totalEquity < 0 ? "text-destructive" : ""}`}>
                {bsFmt(totalEquity)}
              </span>
            </div>

            <BSTotalRow label={`${t("reports.totalLiabilities") || "Total Liabilities"} + ${t("reports.capitalEquity")}`} value={totalLiabilitiesAndEquity} />
          </CardContent>
        </Card>
      </div>

      {/* Balance confirmation footer */}
      <div className={`rounded-lg p-5 text-center text-base font-medium ${isBalanced ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}>
        {isBalanced
          ? `✓ Balance Sheet is balanced — Total Assets = Total Liabilities + Equity = ${bsFmt(totalAssets)}`
          : `✗ Balance Sheet is NOT balanced — Assets: ${bsFmt(totalAssets)} ≠ L+E: ${bsFmt(totalLiabilitiesAndEquity)}`
        }
      </div>
    </div>
  );
}

