import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/components/ui/loading-skeletons";
import { DollarSign, ShoppingCart, Truck, AlertTriangle, Clock, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const { t } = useLanguage();

  const today = new Date().toISOString().split("T")[0];

  const { data: todaySales } = useQuery({
    queryKey: ["dashboard-today-sales", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("total")
        .eq("invoice_type", "sale")
        .eq("invoice_date", today);
      return data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
    },
  });

  const { data: todayPurchases } = useQuery({
    queryKey: ["dashboard-today-purchases", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("total")
        .eq("invoice_type", "purchase")
        .eq("invoice_date", today);
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
      const { data } = await supabase
        .from("invoices")
        .select("balance_due")
        .eq("invoice_type", "sale");
      return data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
    },
  });

  const { data: payables } = useQuery({
    queryKey: ["dashboard-payables"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("balance_due")
        .eq("invoice_type", "purchase");
      return data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("name, stock_qty, min_stock_level")
        .filter("stock_qty", "lte", "min_stock_level" as any);
      // Client-side filter as fallback since column-to-column compare isn't supported
      return data?.filter((p) => p.stock_qty <= p.min_stock_level) || [];
    },
  });

  const { data: overdueCount } = useQuery({
    queryKey: ["dashboard-overdue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_date, payment_status, contacts(payment_terms)")
        .in("payment_status", ["credit", "partial"]);
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

  const summaryCards = [
    { key: "dashboard.todaySales", icon: ShoppingCart, value: `₨ ${(todaySales || 0).toLocaleString()}`, color: "text-primary" },
    { key: "dashboard.todayPurchases", icon: Truck, value: `₨ ${(todayPurchases || 0).toLocaleString()}`, color: "text-primary" },
    { key: "dashboard.totalCash", icon: DollarSign, value: `₨ ${(totalCash || 0).toLocaleString()}`, color: "text-primary" },
    { key: "dashboard.receivables", icon: TrendingUp, value: `₨ ${(receivables || 0).toLocaleString()}`, color: "text-muted-foreground" },
    { key: "dashboard.payables", icon: Clock, value: `₨ ${(payables || 0).toLocaleString()}`, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(card.key)}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              <AlertTriangle className="inline mr-2 h-4 w-4 text-destructive" />
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
              <Clock className="inline mr-2 h-4 w-4 text-destructive" />
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
