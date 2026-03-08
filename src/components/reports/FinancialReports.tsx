import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

type Period = "this_month" | "last_month" | "last_3" | "last_6" | "last_12";

function usePeriodRange(period: Period) {
  return useMemo(() => {
    const now = new Date();
    switch (period) {
      case "this_month":
        return { from: startOfMonth(now), to: now, label: format(startOfMonth(now), "MMM yyyy") };
      case "last_month": {
        const lm = subMonths(now, 1);
        return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(startOfMonth(lm), "MMM yyyy") };
      }
      case "last_3":
        return { from: startOfMonth(subMonths(now, 2)), to: now, label: `${format(startOfMonth(subMonths(now, 2)), "MMM")} – ${format(now, "MMM yyyy")}` };
      case "last_6":
        return { from: startOfMonth(subMonths(now, 5)), to: now, label: `${format(startOfMonth(subMonths(now, 5)), "MMM")} – ${format(now, "MMM yyyy")}` };
      case "last_12":
        return { from: startOfMonth(subMonths(now, 11)), to: now, label: `${format(startOfMonth(subMonths(now, 11)), "MMM yy")} – ${format(now, "MMM yyyy")}` };
    }
  }, [period]);
}

function PeriodSelector({ period, setPeriod, t }: { period: Period; setPeriod: (p: Period) => void; t: (k: string) => string }) {
  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="this_month">{t("reports.thisMonth")}</SelectItem>
        <SelectItem value="last_month">{t("reports.lastMonth")}</SelectItem>
        <SelectItem value="last_3">{t("reports.last3Months")}</SelectItem>
        <SelectItem value="last_6">{t("reports.last6Months")}</SelectItem>
        <SelectItem value="last_12">{t("reports.last12Months")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

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

// === Profit & Loss ===
export function ProfitLossReport() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("this_month");
  const range = usePeriodRange(period);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["financial-invoices", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_type, total, discount, transport_charges")
        .gte("invoice_date", format(range.from, "yyyy-MM-dd"))
        .lte("invoice_date", format(range.to, "yyyy-MM-dd"));
      return data || [];
    },
  });

  const { data: expensesTotal, isLoading: loadingExpenses } = useQuery({
    queryKey: ["financial-expenses", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", format(range.from, "yyyy-MM-dd"))
        .lte("expense_date", format(range.to, "yyyy-MM-dd"));
      return data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    },
  });

  const pnl = useMemo(() => {
    if (!invoices || expensesTotal === undefined) return null;
    let saleRevenue = 0, purchaseCost = 0, totalDiscount = 0, totalTransport = 0;
    for (const inv of invoices) {
      const total = Number(inv.total);
      if (inv.invoice_type === "sale") {
        saleRevenue += total;
      } else {
        purchaseCost += total;
      }
      totalDiscount += Number(inv.discount);
      totalTransport += Number(inv.transport_charges);
    }
    const grossProfit = saleRevenue - purchaseCost;
    const operatingExpenses = expensesTotal || 0;
    const netProfit = grossProfit - totalTransport - operatingExpenses;
    const marginPct = saleRevenue > 0 ? (netProfit / saleRevenue) * 100 : 0;
    return { saleRevenue, purchaseCost, grossProfit, totalDiscount, totalTransport, operatingExpenses, netProfit, marginPct };
  }, [invoices, expensesTotal]);

  if (isLoading || loadingExpenses) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t("reports.profitLoss")} — {range.label}</h2>
        <PeriodSelector period={period} setPeriod={setPeriod} t={t} />
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
                <StatRow label={t("reports.discountsGiven")} value={pnl.totalDiscount} indent />
                <StatRow label={t("reports.transportExpenses")} value={pnl.totalTransport} indent />
                <StatRow label={t("reports.operatingExpenses")} value={pnl.operatingExpenses} indent />
                <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
                <StatRow label={t("reports.netProfit")} value={pnl.netProfit} bold negative />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// === Cash Flow ===
export function CashFlowReport() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("this_month");
  const range = usePeriodRange(period);

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["cashflow-payments", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, invoice_id, payment_date, invoices!inner(invoice_type)")
        .gte("payment_date", format(range.from, "yyyy-MM-dd"))
        .lte("payment_date", format(range.to, "yyyy-MM-dd"));
      return data || [];
    },
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["cashflow-invoices", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_type, amount_paid, invoice_date")
        .gte("invoice_date", format(range.from, "yyyy-MM-dd"))
        .lte("invoice_date", format(range.to, "yyyy-MM-dd"));
      return data || [];
    },
  });

  const flow = useMemo(() => {
    if (!payments || !invoices) return null;

    // Cash inflows: payments received on sale invoices + amount_paid on new sale invoices
    let cashInSalePayments = 0;
    let cashOutPurchasePayments = 0;

    for (const p of payments) {
      const inv = p.invoices as unknown as { invoice_type: string };
      if (inv.invoice_type === "sale") cashInSalePayments += Number(p.amount);
      else cashOutPurchasePayments += Number(p.amount);
    }

    // Also count initial amount_paid on invoices created in this period
    let initialSalePayments = 0;
    let initialPurchasePayments = 0;
    for (const inv of invoices) {
      const paid = Number(inv.amount_paid);
      if (paid > 0) {
        if (inv.invoice_type === "sale") initialSalePayments += paid;
        else initialPurchasePayments += paid;
      }
    }

    const totalInflow = cashInSalePayments + initialSalePayments;
    const totalOutflow = cashOutPurchasePayments + initialPurchasePayments;
    const netCashFlow = totalInflow - totalOutflow;

    return { cashInSalePayments, cashOutPurchasePayments, initialSalePayments, initialPurchasePayments, totalInflow, totalOutflow, netCashFlow };
  }, [payments, invoices]);

  if (loadingPayments || loadingInvoices) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t("reports.cashFlow")} — {range.label}</h2>
        <PeriodSelector period={period} setPeriod={setPeriod} t={t} />
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
                <StatRow label={t("reports.salePaymentsReceived")} value={flow.cashInSalePayments + flow.initialSalePayments} indent />
                <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
                <StatRow label={t("reports.cashOutflows")} value={flow.totalOutflow} bold />
                <StatRow label={t("reports.purchasePaymentsMade")} value={flow.cashOutPurchasePayments + flow.initialPurchasePayments} indent />
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

  const { data: receivables, isLoading: lr } = useQuery({
    queryKey: ["balance-receivables"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("balance_due")
        .eq("invoice_type", "sale")
        .gt("balance_due", 0);
      return data?.reduce((sum, inv) => sum + Number(inv.balance_due), 0) || 0;
    },
  });

  const { data: payables, isLoading: lp } = useQuery({
    queryKey: ["balance-payables"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("balance_due")
        .eq("invoice_type", "purchase")
        .gt("balance_due", 0);
      return data?.reduce((sum, inv) => sum + Number(inv.balance_due), 0) || 0;
    },
  });

  const { data: inventory, isLoading: li } = useQuery({
    queryKey: ["balance-inventory"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("stock_qty, default_price");
      return data?.reduce((sum, p) => sum + Number(p.stock_qty) * Number(p.default_price), 0) || 0;
    },
  });

  if (lr || lp || li) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  const totalAssets = (receivables || 0) + (inventory || 0);
  const totalLiabilities = payables || 0;
  const equity = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("reports.balanceSheet")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.totalAssets")}</p>
            <p className="text-2xl font-bold">₨{totalAssets.toLocaleString()}</p>
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
            <p className="text-sm text-muted-foreground">{t("reports.equity")}</p>
            <p className={`text-2xl font-bold ${equity >= 0 ? "text-green-600" : "text-destructive"}`}>
              ₨{equity.toLocaleString()}
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
                <TableHead className="text-right">{t("payment.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <StatRow label={t("reports.assets")} value={totalAssets} bold />
              <StatRow label={t("reports.accountsReceivable")} value={receivables || 0} indent />
              <StatRow label={t("reports.inventoryValue")} value={inventory || 0} indent />
              <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
              <StatRow label={t("reports.liabilities")} value={totalLiabilities} bold />
              <StatRow label={t("reports.accountsPayable")} value={payables || 0} indent />
              <TableRow><TableCell colSpan={2}><Separator /></TableCell></TableRow>
              <StatRow label={t("reports.equity")} value={equity} bold negative />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
