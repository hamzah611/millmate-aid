import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
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

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

      {chartData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("common.noData")}</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("reports.salesVsPurchases")}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="purchases" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
