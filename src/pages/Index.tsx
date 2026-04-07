import { useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/components/ui/loading-skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ShoppingCart, Truck, AlertTriangle, Clock, TrendingUp, Package, Landmark, Users } from "lucide-react";
import { calculateCashInHand, calculateBankBalances, calculateReceivables, calculatePayables, calculateInventoryValue } from "@/lib/financial-utils";
import { getBusinessUnitFilterOptions } from "@/lib/business-units";
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
  const [selectedBU, setSelectedBU] = useState("all");
  const today = new Date().toISOString().split("T")[0];

  const buFilter = selectedBU !== "all" && selectedBU !== "unassigned" ? selectedBU : undefined;

  const { data: todaySales } = useQuery({
    queryKey: ["dashboard-today-sales", today, selectedBU],
    queryFn: async () => {
      let query = supabase.from("invoices").select("total").eq("invoice_type", "sale").eq("invoice_date", today);
      if (selectedBU === "unassigned") query = query.is("business_unit", null);
      else if (buFilter) query = query.eq("business_unit", buFilter);
      const { data } = await query;
      return data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
    },
  });

  const { data: todayPurchases } = useQuery({
    queryKey: ["dashboard-today-purchases", today, selectedBU],
    queryFn: async () => {
      let query = supabase.from("invoices").select("total").eq("invoice_type", "purchase").eq("invoice_date", today);
      if (selectedBU === "unassigned") query = query.is("business_unit", null);
      else if (buFilter) query = query.eq("business_unit", buFilter);
      const { data } = await query;
      return data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
    },
  });

  const { data: cashData } = useQuery({
    queryKey: ["dashboard-cash-in-hand"],
    queryFn: () => calculateCashInHand(),
  });
  const totalCash = cashData?.total;

  const { data: receivablesData } = useQuery({
    queryKey: ["dashboard-receivables", selectedBU],
    queryFn: () => calculateReceivables(buFilter),
  });
  const receivables = receivablesData?.total;

  const { data: payablesData } = useQuery({
    queryKey: ["dashboard-payables", selectedBU],
    queryFn: () => calculatePayables(buFilter),
  });
  const payables = payablesData?.total;

  const { data: bankBalances } = useQuery({
    queryKey: ["dashboard-bank-balances"],
    queryFn: () => calculateBankBalances(),
  });

  const { data: employeeAdvances } = useQuery({
    queryKey: ["dashboard-employee-advances"],
    queryFn: async () => {
      const { calculateEmployeeAdvances } = await import("@/lib/financial-utils");
      const result = await calculateEmployeeAdvances();
      return result.total;
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
    { key: "dashboard.todaySales", icon: ShoppingCart, value: `${fmtAmount((todaySales || 0))}`, colorKey: "sales" },
    { key: "dashboard.todayPurchases", icon: Truck, value: `${fmtAmount((todayPurchases || 0))}`, colorKey: "purchases" },
    { key: "dashboard.totalCash", icon: DollarSign, value: `${fmtAmount((totalCash || 0))}`, colorKey: "cash", clickable: true, breakdownKey: "cash" as BreakdownType },
  ];

  // Add per-bank cards
  if (bankBalances?.length) {
    bankBalances.forEach(bank => {
      summaryCards.push({
        key: bank.name,
        rawLabel: bank.name,
        icon: Landmark,
        value: `${fmtAmount(bank.balance)}`,
        colorKey: "bank",
        clickable: true,
        breakdownKey: `bank-${bank.id}` as BreakdownType,
      });
    });
  }

  summaryCards.push(
    { key: "dashboard.receivables", icon: TrendingUp, value: `${fmtAmount((receivables || 0))}`, colorKey: "receivables", clickable: true, breakdownKey: "receivables" as BreakdownType },
    { key: "dashboard.payables", icon: Clock, value: `${fmtAmount((payables || 0))}`, colorKey: "payables", clickable: true, breakdownKey: "payables" as BreakdownType },
    { key: "dashboard.employeeAdvances", icon: Users, value: `${fmtAmount((employeeAdvances || 0))}`, colorKey: "employee", clickable: true, breakdownKey: "employee" as BreakdownType },
    { key: "dashboard.inventoryValue", icon: Package, value: `${fmtAmount(inventoryValue)}`, colorKey: "inventory", hint: inventoryHint, clickable: true, breakdownKey: "inventory" as const },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("nav.dashboard")}</h1>
          <p className="page-subtitle">{t("dashboard.subtitle")}</p>
        </div>
        <Select value={selectedBU} onValueChange={setSelectedBU}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getBusinessUnitFilterOptions(t).map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <TopSellingProducts businessUnit={buFilter} />
        <TopCustomers businessUnit={buFilter} />
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
                    <span className="text-destructive font-semibold text-xs bg-destructive/10 px-2 py-0.5 rounded-full">{(() => { const info = getUnitInfo((p as any).unit_id); return `${fmtQty(Number(p.stock_qty) / info.kgValue)} ${info.name}`; })()}</span>
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
