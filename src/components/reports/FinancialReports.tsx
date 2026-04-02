import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategoryBalances } from "@/lib/financial-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/export-csv";
import { getBusinessUnitFilterOptions, matchesBusinessUnit, BUSINESS_UNITS } from "@/lib/business-units";
import { EXPENSE_ACCOUNT_CATEGORIES, getAccountCategoryLabel } from "@/lib/account-categories";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

function StatRow({ label, value, bold, indent, negative }: { label: string; value: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <TableRow>
      <TableCell className={`${bold ? "font-bold" : ""} ${indent ? "pl-8" : ""}`}>{label}</TableCell>
      <TableCell className={`text-end font-mono ${bold ? "font-bold" : ""} ${negative && value < 0 ? "text-destructive" : ""}`}>
        ₨{Math.abs(value).toLocaleString()}
        {negative && value < 0 ? " (-)": ""}
      </TableCell>
    </TableRow>
  );
}

// === Breakdown by BU & Account Category ===
function BreakdownTable({ invoices, expenses, buFilter, t }: {
  invoices: { invoice_type: string; total: number; business_unit: string | null }[];
  expenses: { amount: number; business_unit: string | null; account_category: string | null }[];
  buFilter: string;
  t: (key: string) => string;
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
    cat === "unassigned" ? t("accountCategory.unassigned") : getAccountCategoryLabel(cat, t);

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
                    ₨{(breakdown.revenueByBU.get(col.value) || 0).toLocaleString()}
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
                        ₨{(buMap.get(col.value) || 0).toLocaleString()}
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
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);
  const [buFilter, setBuFilter] = useState("all");

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
              <p className="text-2xl font-bold">₨{pnl.saleRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.cogs")}</p>
              <p className="text-2xl font-bold">₨{pnl.purchaseCost.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.netProfit")}</p>
              <p className={`text-2xl font-bold ${pnl.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                ₨{pnl.netProfit.toLocaleString()} ({pnl.marginPct.toFixed(1)}%)
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
      {pnl && <BreakdownTable invoices={invoices || []} expenses={expensesTotal || []} buFilter={buFilter} t={t} />}
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
    if (!payments || !invoices) return null;

    let totalInflow = 0;
    let totalOutflow = 0;

    for (const inv of invoices) {
      const paid = Number(inv.amount_paid);
      if (paid > 0) {
        if (inv.invoice_type === "sale") totalInflow += paid;
        else totalOutflow += paid;
      }
    }

    const netCashFlow = totalInflow - totalOutflow;

    return { totalInflow, totalOutflow, netCashFlow };
  }, [payments, invoices]);

  if (loadingPayments || loadingInvoices) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

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
              <p className="text-2xl font-bold text-green-600">₨{flow.totalInflow.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.totalOutflow")}</p>
              <p className="text-2xl font-bold text-destructive">₨{flow.totalOutflow.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("reports.netCashFlow")}</p>
              <p className={`text-2xl font-bold ${flow.netCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                ₨{flow.netCashFlow.toLocaleString()}
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
                <StatRow label={t("reports.purchasePaymentsMade")} value={flow.totalOutflow} indent />
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
export function BalanceSheetReport() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);
  const toDate = format(range.to, "yyyy-MM-dd");

  // Category-aware opening balances
  const { data: catBalances, isLoading: lc } = useQuery({
    queryKey: ["balance-categories", toDate],
    queryFn: () => fetchCategoryBalances(toDate),
  });

  // Invoice receivables (sale balance_due)
  const { data: invoiceReceivables, isLoading: lr } = useQuery({
    queryKey: ["balance-receivables", toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("balance_due")
        .eq("invoice_type", "sale")
        .gt("balance_due", 0)
        .lte("invoice_date", toDate);
      return data?.reduce((sum, inv) => sum + Number(inv.balance_due), 0) || 0;
    },
  });

  // Invoice payables (purchase balance_due)
  const { data: invoicePayables, isLoading: lp } = useQuery({
    queryKey: ["balance-payables", toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("balance_due")
        .eq("invoice_type", "purchase")
        .gt("balance_due", 0)
        .lte("invoice_date", toDate);
      return data?.reduce((sum, inv) => sum + Number(inv.balance_due), 0) || 0;
    },
  });

  // Inventory value (existing logic)
  const { data: inventory, isLoading: li } = useQuery({
    queryKey: ["balance-inventory"],
    queryFn: async () => {
      const { data: products } = await supabase.from("products").select("id, stock_qty, default_price").gt("stock_qty", 0);
      if (!products?.length) return 0;

      const { data: purchaseInvoices } = await supabase.from("invoices").select("id").eq("invoice_type", "purchase");
      const avgCostMap = new Map<string, number>();

      if (purchaseInvoices?.length) {
        const { data: items } = await supabase.from("invoice_items").select("product_id, quantity, total").in("invoice_id", purchaseInvoices.map(i => i.id));
        const agg = new Map<string, { cost: number; qty: number }>();
        items?.forEach(it => {
          const e = agg.get(it.product_id) || { cost: 0, qty: 0 };
          e.cost += Number(it.total);
          e.qty += Number(it.quantity);
          agg.set(it.product_id, e);
        });
        for (const [pid, { cost, qty }] of agg) {
          if (qty > 0) avgCostMap.set(pid, cost / qty);
        }
      }

      return products.reduce((sum, p) => {
        const unitCost = avgCostMap.get(p.id) ?? Number(p.default_price);
        return sum + Number(p.stock_qty) * unitCost;
      }, 0);
    },
  });

  if (lr || lp || li || lc) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  const bal = catBalances || { cashBalance: 0, bankBalance: 0, customerReceivables: 0, supplierPayables: 0, employeeReceivables: 0, capitalEquity: 0 };

  // Assets
  const cashInHand = bal.cashBalance;
  const bankAccounts = bal.bankBalance;
  const customerReceivables = bal.customerReceivables + (invoiceReceivables || 0);
  const employeeReceivables = bal.employeeReceivables;
  const inventoryValue = inventory || 0;
  const totalAssets = cashInHand + bankAccounts + customerReceivables + employeeReceivables + inventoryValue;

  // Liabilities — supplier opening balances are negative, use abs()
  const supplierPayables = Math.abs(bal.supplierPayables) + (invoicePayables || 0);
  const totalLiabilities = supplierPayables;

  // Capital / Equity — raw sum of closing accounts
  const capitalEquity = bal.capitalEquity;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t("reports.balanceSheet")}</h2>
        <Button variant="outline" size="sm" onClick={() => {
          exportToCSV("balance-sheet", ["Line Item", "Amount (₨)"], [
            [t("reports.assets"), totalAssets],
            [t("reports.cashInHand"), cashInHand],
            [t("reports.bankAccounts"), bankAccounts],
            [t("reports.customerReceivables"), customerReceivables],
            [t("reports.employeeReceivables"), employeeReceivables],
            [t("reports.inventoryValue"), inventoryValue],
            [t("reports.liabilities"), totalLiabilities],
            [t("reports.supplierPayables"), supplierPayables],
            [t("reports.capitalEquity"), capitalEquity],
          ]);
        }}>
          <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.totalAssets")}</p>
            <p className={`text-2xl font-bold ${totalAssets < 0 ? "text-destructive" : ""}`}>₨{totalAssets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.totalLiabilities")}</p>
            <p className="text-2xl font-bold text-destructive">₨{totalLiabilities.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.capitalEquity")}</p>
            <p className={`text-2xl font-bold ${capitalEquity >= 0 ? "text-chart-2" : "text-destructive"}`}>
              ₨{capitalEquity.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("reports.balanceSheet")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.lineItem")}</TableHead>
                <TableHead className="text-end">{t("payment.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <StatRow label={t("reports.assets")} value={totalAssets} bold />
              <StatRow label={t("reports.cashInHand")} value={cashInHand} indent negative />
              <StatRow label={t("reports.bankAccounts")} value={bankAccounts} indent negative />
              <StatRow label={t("reports.customerReceivables")} value={customerReceivables} indent />
              {employeeReceivables > 0 && <StatRow label={t("reports.employeeReceivables")} value={employeeReceivables} indent />}
              <StatRow label={t("reports.inventoryValue")} value={inventoryValue} indent />
              <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
              <StatRow label={t("reports.liabilities")} value={totalLiabilities} bold />
              <StatRow label={t("reports.supplierPayables")} value={supplierPayables} indent />
              <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
              <StatRow label={t("reports.capitalEquity")} value={capitalEquity} bold negative />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
