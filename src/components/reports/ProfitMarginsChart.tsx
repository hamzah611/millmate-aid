import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { format } from "date-fns";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

export function ProfitMarginsChart() {
  const { t } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, name_ur, category_id");
      return data || [];
    },
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["profit-margin-items", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select("product_id, total, invoices!inner(invoice_type, invoice_date)")
        .gte("invoices.invoice_date", fromDate)
        .lte("invoices.invoice_date", toDate);
      return data || [];
    },
  });

  const { chartData, overallMargin } = useMemo(() => {
    if (!items?.length || !products?.length) return { chartData: [], overallMargin: 0 };
    const productMap = new Map(products.map((p) => [p.id, p]));
    const margins = new Map<string, { saleRevenue: number; purchaseCost: number }>();

    for (const item of items) {
      const prod = productMap.get(item.product_id);
      if (!prod) continue;
      if (categoryFilter !== "all" && prod.category_id !== categoryFilter) continue;
      const entry = margins.get(item.product_id) || { saleRevenue: 0, purchaseCost: 0 };
      const inv = item.invoices as unknown as { invoice_type: string };
      if (inv.invoice_type === "sale") {
        entry.saleRevenue += Number(item.total);
      } else {
        entry.purchaseCost += Number(item.total);
      }
      margins.set(item.product_id, entry);
    }

    let totalRevenue = 0;
    let totalCost = 0;
    const chartData = Array.from(margins.entries())
      .filter(([, v]) => v.saleRevenue > 0)
      .map(([productId, { saleRevenue, purchaseCost }]) => {
        totalRevenue += saleRevenue;
        totalCost += purchaseCost;
        const margin = saleRevenue > 0 ? ((saleRevenue - purchaseCost) / saleRevenue) * 100 : 0;
        return { name: productMap.get(productId)?.name || "", margin: Math.round(margin * 10) / 10, revenue: saleRevenue, cost: purchaseCost };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 15);

    const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    return { chartData, overallMargin: Math.round(overallMargin * 10) / 10 };
  }, [items, products, categoryFilter]);

  const chartConfig = {
    margin: { label: t("reports.marginPct"), color: "hsl(var(--chart-2))" },
  };

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />

      <div className="flex flex-wrap items-center gap-4">
        <Card className={`flex-1 min-w-[200px] border-l-4 ${overallMargin >= 0 ? "border-l-green-500" : "border-l-destructive"}`}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.overallMargin")}</p>
            <p className={`text-3xl font-bold ${overallMargin >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {overallMargin}%
            </p>
          </CardContent>
        </Card>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.all")}</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("common.noData")}</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("reports.profitMargins")}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis
                  type="number"
                  unit="%"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="margin" radius={[0, 8, 8, 0]} animationDuration={800}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.margin >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
