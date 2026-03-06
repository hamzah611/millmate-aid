import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

const TopSellingProducts = () => {
  const { t } = useLanguage();

  const { data: chartData } = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: async () => {
      // Get sale invoices
      const { data: saleInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_type", "sale");
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          <TrendingUp className="inline me-2 h-4 w-4 text-primary" />
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <ul className="mt-3 space-y-1 text-sm">
              {chartData.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-medium">₨ {p.revenue.toLocaleString()} · {p.qty.toLocaleString()} KG</span>
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
