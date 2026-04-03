import { useMemo, useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

export function SalesPurchasesChart() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["sales-purchases-trend", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_type, invoice_date, total")
        .gte("invoice_date", fromDate)
        .lte("invoice_date", toDate);
      return data || [];
    },
  });

  const { chartData, totalSales, totalPurchases } = useMemo(() => {
    if (!invoices?.length) return { chartData: [], totalSales: 0, totalPurchases: 0 };
    const monthMap = new Map<string, { sales: number; purchases: number }>();
    let totalSales = 0;
    let totalPurchases = 0;

    for (const inv of invoices) {
      const month = format(startOfMonth(parseISO(inv.invoice_date)), "yyyy-MM");
      const entry = monthMap.get(month) || { sales: 0, purchases: 0 };
      const total = Number(inv.total);
      if (inv.invoice_type === "sale") {
        entry.sales += total;
        totalSales += total;
      } else {
        entry.purchases += total;
        totalPurchases += total;
      }
      monthMap.set(month, entry);
    }

    const chartData = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: format(parseISO(month + "-01"), "MMM yy"),
        sales: data.sales,
        purchases: data.purchases,
      }));

    return { chartData, totalSales, totalPurchases };
  }, [invoices]);

  const chartConfig = {
    sales: { label: t("reports.totalSales"), color: "hsl(var(--chart-1))" },
    purchases: { label: t("reports.totalPurchases"), color: "hsl(var(--chart-3))" },
  };

  const netDiff = totalSales - totalPurchases;

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-chart-1">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.totalSales")}</p>
            <p className="text-2xl font-bold">{fmtAmount(totalSales)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-3">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.totalPurchases")}</p>
            <p className="text-2xl font-bold">{fmtAmount(totalPurchases)}</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${netDiff >= 0 ? "border-l-green-500" : "border-l-destructive"}`}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("reports.netDifference")}</p>
            <p className={`text-2xl font-bold ${netDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {fmtAmount(netDiff)}
            </p>
          </CardContent>
        </Card>
      </div>

      {chartData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("common.noData")}</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("reports.salesVsPurchases")}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="purchasesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  dot={{ r: 4, fill: "white", strokeWidth: 2, stroke: "hsl(var(--chart-1))" }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  animationDuration={800}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2.5}
                  fill="url(#purchasesGradient)"
                  dot={{ r: 4, fill: "white", strokeWidth: 2, stroke: "hsl(var(--chart-3))" }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  animationDuration={800}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
