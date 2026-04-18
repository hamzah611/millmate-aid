import { useMemo, useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { exportToCSV } from "@/lib/export-csv";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

export function TopProductsChart() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [filter, setFilter] = useState<"sale" | "purchase">("sale");

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");

  const prevRange = useMemo(() => {
    const diff = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - diff), to: new Date(range.from.getTime() - 1) };
  }, [range]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const { data: invoiceItems, isLoading } = useQuery({
    queryKey: ["top-products-items", filter, fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select("quantity, total, product_id, invoice_id, invoices!inner(invoice_type, invoice_date)")
        .gte("invoices.invoice_date", fromDate)
        .lte("invoices.invoice_date", toDate)
        .eq("invoices.invoice_type", filter);
      return data || [];
    },
  });

  const { data: prevItems } = useQuery({
    queryKey: ["top-products-prev", filter, format(prevRange.from, "yyyy-MM-dd"), format(prevRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select("quantity, total, product_id, invoices!inner(invoice_type, invoice_date)")
        .gte("invoices.invoice_date", format(prevRange.from, "yyyy-MM-dd"))
        .lte("invoices.invoice_date", format(prevRange.to, "yyyy-MM-dd"))
        .eq("invoices.invoice_type", filter);
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

  const chartData = useMemo(() => {
    if (!invoiceItems?.length || !products?.length) return [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    const revenueMap = new Map<string, { revenue: number; qty: number }>();

    for (const item of invoiceItems) {
      const prod = productMap.get(item.product_id);
      if (!prod) continue;
      if (categoryFilter !== "all" && prod.category_id !== categoryFilter) continue;
      const existing = revenueMap.get(item.product_id) || { revenue: 0, qty: 0 };
      existing.revenue += Number(item.total);
      existing.qty += Number(item.quantity);
      revenueMap.set(item.product_id, existing);
    }

    const prevRevenueMap = new Map<string, number>();
    for (const item of prevItems || []) {
      const prev = prevRevenueMap.get(item.product_id) || 0;
      prevRevenueMap.set(item.product_id, prev + Number(item.total));
    }

    return Array.from(revenueMap.entries())
      .map(([productId, { revenue, qty }]) => {
        const prod = productMap.get(productId)!;
        const prevRev = prevRevenueMap.get(productId) || 0;
        const pctChange = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : revenue > 0 ? 100 : 0;
        return { productId, name: prod.name, nameUr: prod.name_ur, revenue, qty, pctChange };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [invoiceItems, prevItems, products, categoryFilter]);

  const chartConfig = {
    revenue: { label: t("reports.revenue"), color: "hsl(var(--chart-1))" },
  };

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />

      <div className="flex flex-wrap gap-3 items-center">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as "sale" | "purchase")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="sale">{t("nav.sales")}</ToggleGroupItem>
          <ToggleGroupItem value="purchase">{t("nav.purchases")}</ToggleGroupItem>
        </ToggleGroup>
        {chartData.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => {
            exportToCSV(`top-products-${filter}`, ["Product", "Units", "Amount", "% Change"],
              chartData.map((r) => [r.name, r.qty, r.revenue, `${r.pctChange.toFixed(1)}%`])
            );
          }}>
            <Download className="h-4 w-4 mr-1" />{t("reports.exportCSV")}
          </Button>
        )}
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
        <>
          <Card>
            <CardHeader><CardTitle>{t("reports.topProducts")}</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                  <defs>
                    <linearGradient id="topProductGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}k`}
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
                  <Bar
                    dataKey="revenue"
                    fill="url(#topProductGradient)"
                    radius={[0, 8, 8, 0]}
                    animationDuration={800}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("products.name")}</TableHead>
                    <TableHead className="text-end">{t("reports.unitsSold")}</TableHead>
                    <TableHead className="text-end">{t("reports.revenue")}</TableHead>
                    <TableHead className="text-end">{t("reports.change")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-end">{fmtQty(row.qty)}</TableCell>
                      <TableCell className="text-end">{fmtAmount(row.revenue)}</TableCell>
                      <TableCell className="text-end">
                        <span className={`inline-flex items-center gap-1 ${row.pctChange > 0 ? "text-green-600 dark:text-green-400" : row.pctChange < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {row.pctChange > 0 ? <TrendingUp className="h-3 w-3" /> : row.pctChange < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {Math.abs(row.pctChange).toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
