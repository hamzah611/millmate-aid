import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/components/ui/loading-skeletons";
import { DollarSign, ShoppingCart, Truck, AlertTriangle, Clock, TrendingUp, Package, Landmark, Users } from "lucide-react";
import { fetchCategoryBalances } from "@/lib/financial-utils";
import TopSellingProducts from "@/components/dashboard/TopSellingProducts";
import TopCustomers from "@/components/dashboard/TopCustomers";
import RecentActivity from "@/components/dashboard/RecentActivity";
import InactiveProducts from "@/components/dashboard/InactiveProducts";

const iconBg: Record<string, string> = {
  sales: "bg-primary/10 text-primary",
  purchases: "bg-chart-3/15 text-chart-3",
  cash: "bg-chart-2/15 text-chart-2",
  receivables: "bg-chart-4/15 text-chart-4",
  payables: "bg-destructive/10 text-destructive",
  inventory: "bg-chart-5/15 text-chart-5",
  bank: "bg-chart-1/15 text-chart-1",
};

const Dashboard = () => {
  const { t } = useLanguage();
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
      // Opening cash balances
      const balances = await fetchCategoryBalances();
      const openingCash = balances.cashBalance;
      
      const { data: saleInvoices } = await supabase.from("invoices").select("amount_paid").eq("invoice_type", "sale");
      const salesReceived = saleInvoices?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0;
      const { data: purchaseInvoices } = await supabase.from("invoices").select("amount_paid").eq("invoice_type", "purchase");
      const purchasesPaid = purchaseInvoices?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0;
      const { data: expenseData } = await supabase.from("expenses").select("amount, payment_method").eq("payment_method", "cash");
      const totalCashExpenses = expenseData?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      return openingCash + salesReceived - purchasesPaid - totalCashExpenses;
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

  const { data: bankBalance } = useQuery({
    queryKey: ["dashboard-bank-balance"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      return balances.bankBalance;
    },
  });

  const { data: inventoryValue } = useQuery({
    queryKey: ["dashboard-inventory-value"],
    queryFn: async () => {
      const { data: products } = await supabase.from("products").select("id, stock_qty").gt("stock_qty", 0);
      if (!products?.length) return 0;
      const { data: purchaseInvoices } = await supabase.from("invoices").select("id").eq("invoice_type", "purchase");
      if (!purchaseInvoices?.length) {
        const { data: prods } = await supabase.from("products").select("stock_qty, default_price").gt("stock_qty", 0);
        return prods?.reduce((s, p) => s + p.stock_qty * p.default_price, 0) || 0;
      }
      const pIds = purchaseInvoices.map(i => i.id);
      const { data: items } = await supabase.from("invoice_items").select("product_id, quantity, total").in("invoice_id", pIds);
      const avgPrice: Record<string, number> = {};
      const totals: Record<string, { qty: number; cost: number }> = {};
      items?.forEach(it => {
        if (!totals[it.product_id]) totals[it.product_id] = { qty: 0, cost: 0 };
        totals[it.product_id].qty += it.quantity;
        totals[it.product_id].cost += it.total;
      });
      Object.entries(totals).forEach(([pid, v]) => {
        avgPrice[pid] = v.qty > 0 ? v.cost / v.qty : 0;
      });
      let value = 0;
      for (const p of products) {
        const price = avgPrice[p.id];
        if (price) {
          value += p.stock_qty * price;
        } else {
          const { data: prod } = await supabase.from("products").select("default_price").eq("id", p.id).single();
          value += p.stock_qty * (prod?.default_price || 0);
        }
      }
      return value;
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("name, stock_qty, min_stock_level");
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

  const summaryCards = [
    { key: "dashboard.todaySales", icon: ShoppingCart, value: `₨ ${(todaySales || 0).toLocaleString()}`, colorKey: "sales" },
    { key: "dashboard.todayPurchases", icon: Truck, value: `₨ ${(todayPurchases || 0).toLocaleString()}`, colorKey: "purchases" },
    { key: "dashboard.totalCash", icon: DollarSign, value: `₨ ${(totalCash || 0).toLocaleString()}`, colorKey: "cash" },
    { key: "dashboard.bankBalance", icon: Landmark, value: `₨ ${(bankBalance || 0).toLocaleString()}`, colorKey: "bank" },
    { key: "dashboard.receivables", icon: TrendingUp, value: `₨ ${(receivables || 0).toLocaleString()}`, colorKey: "receivables" },
    { key: "dashboard.payables", icon: Clock, value: `₨ ${(payables || 0).toLocaleString()}`, colorKey: "payables" },
    { key: "dashboard.inventoryValue", icon: Package, value: `₨ ${(inventoryValue || 0).toLocaleString()}`, colorKey: "inventory" },
  ];

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
            <div key={card.key} className={`stat-card animate-fade-in animate-stagger-${i + 1}`} style={{ animationFillMode: 'both' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(card.key)}</span>
                <div className={`stat-card-icon ${iconBg[card.colorKey]}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight">{card.value}</p>
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
                    <span className="text-destructive font-semibold text-xs bg-destructive/10 px-2 py-0.5 rounded-full">{p.stock_qty} KG</span>
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
    </div>
  );
};

export default Dashboard;
