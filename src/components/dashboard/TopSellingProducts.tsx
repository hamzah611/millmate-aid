import { useQuery } from "@tanstack/react-query";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

interface Props {
  businessUnit?: string;
}

const TopSellingProducts = ({ businessUnit }: Props) => {
  const { t } = useLanguage();

  const { data: chartData } = useQuery({
    queryKey: ["dashboard-top-products", businessUnit],
    queryFn: async () => {
      let query = supabase.from("invoices").select("id").eq("invoice_type", "sale");
      if (businessUnit) query = query.eq("business_unit", businessUnit);
      const { data: saleInvoices } = await query;
      if (!saleInvoices?.length) return [];

      const ids = saleInvoices.map(i => i.id);
      const { data: items } = await supabase
        .from("invoice_items")
        .select("product_id, total, quantity, products(name)")
        .in("invoice_id", ids);
      if (!items) return [];

      const map: Record<string, { name: string; revenue: number; qty: number }> = {};
      items.forEach(item => {
        const pid = item.product_id;
        if (!map[pid]) map[pid] = { name: (item.products as any)?.name || "?", revenue: 0, qty: 0 };
        map[pid].revenue += item.total || 0;
        map[pid].qty += item.quantity || 0;
      });

      return Object.values(map)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
  });

  const config = { revenue: { label: t("reports.revenue"), color: "hsl(var(--primary))" } };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          {t("dashboard.topProducts")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!chartData?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <>
            <ChartContainer config={config} className="h-[200px] w-full">
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="dashboardBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="revenue"
                  fill="url(#dashboardBarGradient)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={800}
                />
              </BarChart>
            </ChartContainer>
            <ul className="mt-3 space-y-1.5 text-sm">
              {chartData.map((p, i) => (
                <li key={i} className="flex justify-between items-center py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {p.name}
                  </span>
                  <span className="font-medium font-mono text-xs">{fmtAmount(p.revenue)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TopSellingProducts;
