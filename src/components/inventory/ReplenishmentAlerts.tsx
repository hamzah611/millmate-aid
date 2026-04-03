import { useMemo } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { subDays, format, parseISO, differenceInDays } from "date-fns";

export function ReplenishmentAlerts() {
  const { t, language } = useLanguage();

  const { data: products, isLoading: lp } = useQuery({
    queryKey: ["replenishment-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, name_ur, stock_qty, min_stock_level, default_price, is_tradeable, unit_id, units(kg_value)");
      return data || [];
    },
  });

  const { data: unitsList } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name, name_ur");
      return data || [];
    },
  });

  const getUnitName = (unitId: string | null) => {
    if (!unitId || !unitsList) return "";
    const u = unitsList.find(u => u.id === unitId);
    return u ? (language === "ur" && u.name_ur ? u.name_ur : u.name) : "";
  };

  // Get sales velocity from last 30 days
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data: recentSales, isLoading: ls } = useQuery({
    queryKey: ["replenishment-sales", thirtyDaysAgo],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, invoices!inner(invoice_type, invoice_date)")
        .eq("invoices.invoice_type", "sale")
        .gte("invoices.invoice_date", thirtyDaysAgo);
      return data || [];
    },
  });

  const alerts = useMemo(() => {
    if (!products || !recentSales) return [];

    // Calculate velocity per product (units per day over 30 days)
    const velocityMap = new Map<string, number>();
    for (const item of recentSales) {
      const prev = velocityMap.get(item.product_id) || 0;
      velocityMap.set(item.product_id, prev + Number(item.quantity));
    }

    return products
      .filter((p) => p.is_tradeable)
      .map((p) => {
        const kgValue = Number((p as any).units?.kg_value) || 1;
        const totalSold30d = velocityMap.get(p.id) || 0;
        const dailyVelocity = totalSold30d / 30;
        const stock = Number(p.stock_qty);
        const displayStock = stock / kgValue;
        const minStock = Number(p.min_stock_level) / kgValue;
        const daysLeft = dailyVelocity > 0 ? Math.floor(stock / dailyVelocity) : stock > 0 ? 999 : 0;
        const reorderQty = dailyVelocity > 0 ? Math.ceil((dailyVelocity * 30 - stock) / kgValue) : 0;

        let status: "critical" | "warning" | "ok" = "ok";
        if (stock <= 0) status = "critical";
        else if (stock <= minStock || daysLeft <= 7) status = "critical";
        else if (daysLeft <= 14) status = "warning";

        return {
          ...p,
          displayStock: Math.round(displayStock * 100) / 100,
          displayMinStock: Math.round(minStock * 100) / 100,
          totalSold30d,
          dailyVelocity: Math.round(dailyVelocity * 10) / 10,
          daysLeft: daysLeft > 999 ? "∞" : daysLeft,
          daysLeftNum: daysLeft,
          reorderQty: Math.max(0, reorderQty),
          status,
        };
      })
      .sort((a, b) => {
        const statusOrder = { critical: 0, warning: 1, ok: 2 };
        return statusOrder[a.status] - statusOrder[b.status] || a.daysLeftNum - b.daysLeftNum;
      });
  }, [products, recentSales]);

  const chartData = useMemo(() => {
    return alerts
      .filter((a) => a.status !== "ok")
      .slice(0, 10)
      .map((a) => ({
        name: a.name,
        stock: a.displayStock,
        minStock: a.displayMinStock,
      }));
  }, [alerts]);

  const criticalCount = alerts.filter((a) => a.status === "critical").length;
  const warningCount = alerts.filter((a) => a.status === "warning").length;

  const chartConfig = {
    stock: { label: t("inventory.currentStock"), color: "hsl(var(--chart-1))" },
    minStock: { label: t("inventory.minLevel"), color: "hsl(var(--destructive))" },
  };

  if (lp || ls) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">{t("inventory.criticalItems")}</p>
              <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">{t("inventory.warningItems")}</p>
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">{t("inventory.totalTracked")}</p>
              <p className="text-2xl font-bold">{alerts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("inventory.lowStockChart")}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="stock" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="minStock" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("inventory.replenishmentTable")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.name")}</TableHead>
                <TableHead className="text-end">{t("products.stock")}</TableHead>
                <TableHead className="text-end">{t("inventory.velocity")}</TableHead>
                <TableHead className="text-end">{t("inventory.daysLeft")}</TableHead>
                <TableHead className="text-end">{t("inventory.reorderQty")}</TableHead>
                <TableHead>{t("invoice.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-end">{fmtQty(item.displayStock)} {getUnitName((item as any).unit_id)}</TableCell>
                  <TableCell className="text-end">{item.dailyVelocity}/day</TableCell>
                  <TableCell className="text-end">{item.daysLeft} {typeof item.daysLeft === "number" ? "d" : ""}</TableCell>
                  <TableCell className="text-end">{item.reorderQty > 0 ? item.reorderQty.toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "critical" ? "destructive" : item.status === "warning" ? "outline" : "secondary"}>
                      {item.status === "critical" ? t("inventory.critical") : item.status === "warning" ? t("inventory.warning") : t("inventory.ok")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
