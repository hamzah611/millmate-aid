import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Truck, AlertTriangle, Clock, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const { t } = useLanguage();

  const summaryCards = [
    { key: "dashboard.todaySales", icon: ShoppingCart, value: "₨ 0", color: "text-primary" },
    { key: "dashboard.todayPurchases", icon: Truck, value: "₨ 0", color: "text-primary" },
    { key: "dashboard.totalCash", icon: DollarSign, value: "₨ 0", color: "text-primary" },
    { key: "dashboard.receivables", icon: TrendingUp, value: "₨ 0", color: "text-muted-foreground" },
    { key: "dashboard.payables", icon: Clock, value: "₨ 0", color: "text-destructive" },
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
            <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
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
            <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
