import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/components/ui/loading-skeletons";
import { DollarSign, ShoppingCart, Truck, AlertTriangle, Clock, TrendingUp, Package, Landmark, Users } from "lucide-react";
import { calculateCashInHand, calculateBankBalances, calculateReceivables, calculatePayables, calculateInventoryValue } from "@/lib/financial-utils";
import TopSellingProducts from "@/components/dashboard/TopSellingProducts";
import TopCustomers from "@/components/dashboard/TopCustomers";
import RecentActivity from "@/components/dashboard/RecentActivity";
import InactiveProducts from "@/components/dashboard/InactiveProducts";
import InventoryBreakdown from "@/components/dashboard/InventoryBreakdown";
import DashboardBreakdown from "@/components/dashboard/DashboardBreakdown";

type BreakdownType = "cash" | "receivables" | "payables" | "employee" | `bank-${string}` | null;

const iconBg: Record<string, string> = {
  sales: "bg-primary/10 text-primary",
  purchases: "bg-chart-3/15 text-chart-3",
  cash: "bg-chart-2/15 text-chart-2",
  receivables: "bg-chart-4/15 text-chart-4",
  payables: "bg-destructive/10 text-destructive",
  inventory: "bg-chart-5/15 text-chart-5",
  bank: "bg-chart-1/15 text-chart-1",
  employee: "bg-chart-4/10 text-chart-4",
};

import type { BankBalance } from "@/lib/financial-utils";

const Dashboard = () => {
  const { t, language } = useLanguage();
  const [showInventoryBreakdown, setShowInventoryBreakdown] = useState(false);
  const [breakdownType, setBreakdownType] = useState<BreakdownType>(null);
  const today = new Date().toISOString().split("T")[0];

  const { data: todaySales } = useQuery({
    queryKey: ["dashboard-today-sales", today],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("total").eq("invoice_type", "sale").eq("invoice_date", today);
      return data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
    },
  });

  const { data: todayPurchases } = useQuery({
    queryKey: ["dashboard-today-purchases", today],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("total").eq("invoice_type", "purchase").eq("invoice_date", today);
      return data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
    },
  });

  const { data: totalCash } = useQuery({
    queryKey: ["dashboard-cash-in-hand"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const openingCash = balances.cashBalance;
      
      const { data: allPayments } = await supabase.from("payments").select("amount, payment_method, voucher_type, invoice_id");
      
      const cashReceipts = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "receipt")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const cashPayments = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "payment")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const voucherTotalsByInvoice = new Map<string, number>();
      for (const p of allPayments || []) {
        voucherTotalsByInvoice.set(p.invoice_id, (voucherTotalsByInvoice.get(p.invoice_id) || 0) + Number(p.amount));
      }

      const { data: allInvoices } = await supabase.from("invoices").select("id, invoice_type, amount_paid");
      let untrackedSaleCash = 0;
      let untrackedPurchaseCash = 0;
      for (const inv of allInvoices || []) {
        const voucherTotal = voucherTotalsByInvoice.get(inv.id) || 0;
        const untracked = Number(inv.amount_paid) - voucherTotal;
        if (untracked > 0) {
          if (inv.invoice_type === "sale") untrackedSaleCash += untracked;
          else untrackedPurchaseCash += untracked;
        }
      }

      const { data: expenseData } = await supabase.from("expenses").select("amount").eq("payment_method", "cash");
      const totalCashExpenses = expenseData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      return openingCash + cashReceipts + untrackedSaleCash - cashPayments - untrackedPurchaseCash - totalCashExpenses;
    },
  });

  const { data: receivables } = useQuery({
    queryKey: ["dashboard-receivables"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const { data } = await supabase.from("invoices").select("balance_due").eq("invoice_type", "sale");
      const invoiceReceivables = data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
      return invoiceReceivables + balances.customerReceivables;
    },
  });

  const { data: payables } = useQuery({
    queryKey: ["dashboard-payables"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const { data } = await supabase.from("invoices").select("balance_due").eq("invoice_type", "purchase");
      const invoicePayables = data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
      return invoicePayables + Math.abs(balances.supplierPayables);
    },
  });

  // Per-bank balances
  const { data: bankBalances } = useQuery({
    queryKey: ["dashboard-bank-balances"],
    queryFn: async () => {
      const { data: banks } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "bank")
        .order("name");
      if (!banks?.length) return [];

      const { data: bankPayments } = await supabase
        .from("payments")
        .select("amount, voucher_type, bank_contact_id")
        .eq("payment_method", "bank");

      const { data: bankExpenses } = await supabase
        .from("expenses")
        .select("amount, bank_contact_id")
        .eq("payment_method", "bank");

      return banks.map(bank => {
        const opening = Number(bank.opening_balance || 0);
        const receipts = bankPayments?.filter(p => p.bank_contact_id === bank.id && p.voucher_type === "receipt")
          .reduce((s, p) => s + Number(p.amount), 0) || 0;
        const payments = bankPayments?.filter(p => p.bank_contact_id === bank.id && p.voucher_type === "payment")
          .reduce((s, p) => s + Number(p.amount), 0) || 0;
        const expenses = bankExpenses?.filter(e => e.bank_contact_id === bank.id)
          .reduce((s, e) => s + Number(e.amount), 0) || 0;
        return { id: bank.id, name: bank.name, balance: opening + receipts - payments - expenses } as BankBalance;
      });
    },
  });

  const { data: employeeAdvances } = useQuery({
    queryKey: ["dashboard-employee-advances"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      return balances.employeeReceivables;
    },
  });

  const { data: inventoryData } = useQuery({
    queryKey: ["dashboard-inventory-value"],
    queryFn: () => calculateInventoryValue(),
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name, name_ur, kg_value");
      return data || [];
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("name, stock_qty, min_stock_level, unit_id");
      return data?.filter((p) => Number(p.stock_qty) <= Number(p.min_stock_level)) || [];
    },
  });

  const { data: overdueCount } = useQuery({
    queryKey: ["dashboard-overdue"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_date, payment_status, contacts!invoices_contact_id_fkey(payment_terms)").in("payment_status", ["credit", "partial", "pending"]);;
      if (!data) return 0;
      const now = new Date();
      return data.filter((inv) => {
        const terms = parseInt((inv.contacts as any)?.payment_terms || "30", 10);
        const due = new Date(inv.invoice_date);
        due.setDate(due.getDate() + terms);
        return now > due;
      }).length;
    },
  });

  const isCardsLoading = todaySales === undefined || todayPurchases === undefined || totalCash === undefined;

  const getUnitInfo = (unitId: string | null) => {
    if (!unitId || !units) return { name: "", kgValue: 1 };
    const u = units.find(u => u.id === unitId);
    if (!u) return { name: "", kgValue: 1 };
    return { name: language === "ur" && u.name_ur ? u.name_ur : u.name, kgValue: Number(u.kg_value) || 1 };
  };

  const getUnitName = (unitId: string | null) => getUnitInfo(unitId).name;

  const inventoryValue = inventoryData?.totalValue || 0;
  const hasStockButNoValue = inventoryData?.hasValuationGap;
  const hasOpeningStock = inventoryData?.hasOpeningStock;

  const inventoryHint = hasStockButNoValue
    ? t("dashboard.noCostData")
    : hasOpeningStock
    ? t("dashboard.includesOpeningStock")
    : undefined;

  const summaryCards: any[] = [
    { key: "dashboard.todaySales", icon: ShoppingCart, value: `₨ ${(todaySales || 0).toLocaleString()}`, colorKey: "sales" },
    { key: "dashboard.todayPurchases", icon: Truck, value: `₨ ${(todayPurchases || 0).toLocaleString()}`, colorKey: "purchases" },
    { key: "dashboard.totalCash", icon: DollarSign, value: `₨ ${(totalCash || 0).toLocaleString()}`, colorKey: "cash", clickable: true, breakdownKey: "cash" as BreakdownType },
  ];

  // Add per-bank cards
  if (bankBalances?.length) {
    bankBalances.forEach(bank => {
      summaryCards.push({
        key: bank.name,
        rawLabel: bank.name,
        icon: Landmark,
        value: `₨ ${bank.balance.toLocaleString()}`,
        colorKey: "bank",
        clickable: true,
        breakdownKey: `bank-${bank.id}` as BreakdownType,
      });
    });
  }

  summaryCards.push(
    { key: "dashboard.receivables", icon: TrendingUp, value: `₨ ${(receivables || 0).toLocaleString()}`, colorKey: "receivables", clickable: true, breakdownKey: "receivables" as BreakdownType },
    { key: "dashboard.payables", icon: Clock, value: `₨ ${(payables || 0).toLocaleString()}`, colorKey: "payables", clickable: true, breakdownKey: "payables" as BreakdownType },
    { key: "dashboard.employeeAdvances", icon: Users, value: `₨ ${(employeeAdvances || 0).toLocaleString()}`, colorKey: "employee", clickable: true, breakdownKey: "employee" as BreakdownType },
    { key: "dashboard.inventoryValue", icon: Package, value: `₨ ${inventoryValue.toLocaleString()}`, colorKey: "inventory", hint: inventoryHint, clickable: true, breakdownKey: "inventory" as const },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("nav.dashboard")}</h1>
        <p className="page-subtitle">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {isCardsLoading
          ? Array.from({ length: 6 }).map((_, i) => <DashboardCardSkeleton key={i} />)
          : summaryCards.map((card, i) => (
            <div
              key={card.breakdownKey || card.key}
              className={`stat-card animate-fade-in animate-stagger-${(i % 7) + 1} ${card.clickable ? "cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" : ""}`}
              style={{ animationFillMode: 'both' }}
              onClick={card.clickable ? () => {
                if (card.breakdownKey === "inventory") setShowInventoryBreakdown(true);
                else setBreakdownType(card.breakdownKey);
              } : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.rawLabel || t(card.key)}
                </span>
                <div className={`stat-card-icon ${iconBg[card.colorKey]}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight">{card.value}</p>
              {card.hint && <p className="text-[10px] text-destructive mt-1">{card.hint}</p>}
              {card.clickable && <p className="text-[10px] text-muted-foreground mt-1">{t("dashboard.clickToSeeDetails")}</p>}
            </div>
          ))}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopSellingProducts />
        <TopCustomers />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity />
        <InactiveProducts />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              {t("dashboard.lowStock")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!lowStockProducts?.length ? (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {lowStockProducts.map((p, i) => (
                  <li key={i} className="flex justify-between items-center py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-destructive font-semibold text-xs bg-destructive/10 px-2 py-0.5 rounded-full">{(() => { const info = getUnitInfo((p as any).unit_id); return `${Math.round((Number(p.stock_qty) / info.kgValue) * 100) / 100} ${info.name}`; })()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10">
                <Clock className="h-3.5 w-3.5 text-destructive" />
              </div>
              {t("dashboard.overdueInvoices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueCount === 0 ? (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            ) : (
              <p className="text-3xl font-bold text-destructive">{overdueCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <InventoryBreakdown
        open={showInventoryBreakdown}
        onOpenChange={setShowInventoryBreakdown}
        products={inventoryData?.products || []}
        totalValue={inventoryValue}
      />

      <DashboardBreakdown
        type={breakdownType}
        onClose={() => setBreakdownType(null)}
      />
    </div>
  );
};

export default Dashboard;
