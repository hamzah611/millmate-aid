import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/components/ui/loading-skeletons";
import { DollarSign, ShoppingCart, Truck, AlertTriangle, Clock, TrendingUp, Package } from "lucide-react";
import TopSellingProducts from "@/components/dashboard/TopSellingProducts";
import TopCustomers from "@/components/dashboard/TopCustomers";
import RecentActivity from "@/components/dashboard/RecentActivity";
import InactiveProducts from "@/components/dashboard/InactiveProducts";

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
    queryKey: ["dashboard-total-cash"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("amount_paid");
      return data?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0;
    },
  });

  const { data: receivables } = useQuery({
    queryKey: ["dashboard-receivables"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("balance_due").eq("invoice_type", "sale");
      return data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
    },
  });

  const { data: payables } = useQuery({
    queryKey: ["dashboard-payables"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("balance_due").eq("invoice_type", "purchase");
      return data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
    },
  });

  const { data: inventoryValue } = useQuery({
    queryKey: ["dashboard-inventory-value"],
    queryFn: async () => {
      // Get all products with stock
      const { data: products } = await supabase.from("products").select("id, stock_qty").gt("stock_qty", 0);
      if (!products?.length) return 0;

      // Get purchase invoice IDs
      const { data: purchaseInvoices } = await supabase.from("invoices").select("id").eq("invoice_type", "purchase");
      if (!purchaseInvoices?.length) {
        // Fall back to default_price
        const { data: prods } = await supabase.from("products").select("stock_qty, default_price").gt("stock_qty", 0);
        return prods?.reduce((s, p) => s + p.stock_qty * p.default_price, 0) || 0;
      }

      const pIds = purchaseInvoices.map(i => i.id);
      const { data: items } = await supabase.from("invoice_items").select("product_id, quantity, total").in("invoice_id", pIds);

      // Calculate weighted average purchase price per product
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
          // Fall back to default_price
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
      const { data } = await supabase.from("products").select("name, stock_qty, min_stock_level").filter("stock_qty", "lte", "min_stock_level" as any);
      return data?.filter((p) => p.stock_qty <= p.min_stock_level) || [];
    },
  });

  const { data: overdueCount } = useQuery({
    queryKey: ["dashboard-overdue"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_date, payment_status, contacts(payment_terms)").in("payment_status", ["credit", "partial"]);
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
    { key: "dashboard.todaySales", icon: ShoppingCart, value: `₨ ${(todaySales || 0).toLocaleString()}`, color: "text-primary" },
    { key: "dashboard.todayPurchases", icon: Truck, value: `₨ ${(todayPurchases || 0).toLocaleString()}`, color: "text-primary" },
    { key: "dashboard.totalCash", icon: DollarSign, value: `₨ ${(totalCash || 0).toLocaleString()}`, color: "text-primary" },
    { key: "dashboard.receivables", icon: TrendingUp, value: `₨ ${(receivables || 0).toLocaleString()}`, color: "text-muted-foreground" },
    { key: "dashboard.payables", icon: Clock, value: `₨ ${(payables || 0).toLocaleString()}`, color: "text-destructive" },
    { key: "dashboard.inventoryValue", icon: Package, value: `₨ ${(inventoryValue || 0).toLocaleString()}`, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isCardsLoading
          ? Array.from({ length: 6 }).map((_, i) => <DashboardCardSkeleton key={i} />)
          : summaryCards.map((card) => (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t(card.key)}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{card.value}</p></CardContent>
            </Card>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <AlertTriangle className="inline me-2 h-4 w-4 text-destructive" />
              {t("dashboard.lowStock")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!lowStockProducts?.length ? (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {lowStockProducts.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-destructive font-medium">{p.stock_qty} KG</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <Clock className="inline me-2 h-4 w-4 text-destructive" />
              {t("dashboard.overdueInvoices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueCount === 0 ? (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            ) : (
              <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
