import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { differenceInDays, parseISO, addDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker, useDefaultDateRange, type DateRange } from "./DateRangePicker";

const PAYMENT_TERMS_DAYS: Record<string, number> = { "7": 7, "15": 15, "30": 30 };

function getBucket(days: number) {
  if (days <= 7) return "0-7";
  if (days <= 15) return "8-15";
  if (days <= 30) return "16-30";
  return "30+";
}

function getBucketColor(bucket: string) {
  switch (bucket) {
    case "0-7": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "8-15": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "16-30": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "30+": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default: return "";
  }
}

export function AgingReport() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"receivables" | "payables">("receivables");
  const [sortBy, setSortBy] = useState<"days" | "amount">("days");
  const [range, setRange] = useState<DateRange>(useDefaultDateRange);

  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["aging-invoices", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_type, invoice_date, balance_due, payment_status, contact_id, contacts!invoices_contact_id_fkey(name, payment_terms)")
        .in("payment_status", ["pending", "partial", "credit"])
        .gt("balance_due", 0)
        .gte("invoice_date", fromDate)
        .lte("invoice_date", toDate);
      return data || [];
    },
  });

  const { data: obContacts } = useQuery({
    queryKey: ["aging-opening-balances", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, opening_balance_date")
        .neq("opening_balance", 0)
        .gte("opening_balance_date", fromDate)
        .lte("opening_balance_date", toDate);
      return data || [];
    },
  });

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    const today = new Date();
    const type = tab === "receivables" ? "sale" : "purchase";

    return invoices
      .filter((inv) => inv.invoice_type === type)
      .map((inv) => {
        const contact = inv.contacts as unknown as { name: string; payment_terms: string | null };
        const termsDays = contact?.payment_terms ? PAYMENT_TERMS_DAYS[contact.payment_terms] || 30 : 30;
        const dueDate = addDays(parseISO(inv.invoice_date), termsDays);
        const daysOverdue = Math.max(0, differenceInDays(today, dueDate));
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          contactName: contact?.name || "",
          invoice_date: inv.invoice_date,
          dueDate,
          daysOverdue,
          bucket: getBucket(daysOverdue),
          balance_due: inv.balance_due,
          isOpeningBalance: false,
        };
      });
  }, [invoices, tab]);

  // Opening balance entries — always included regardless of date range
  const obEntries = useMemo(() => {
    if (!obContacts) return [];
    const today = new Date();
    return obContacts
      .filter((c) => {
        const bal = Number(c.opening_balance);
        if (tab === "receivables") return bal > 0; // DR = they owe us
        return bal < 0; // CR = we owe them
      })
      .map((c) => {
        const obDate = (c as any).opening_balance_date || "2025-12-03";
        const daysOverdue = Math.max(0, differenceInDays(today, parseISO(obDate)));
        return {
          id: `ob-${c.id}`,
          invoice_number: t("ledger.openingBalance"),
          contactName: c.name,
          invoice_date: obDate,
          dueDate: parseISO(obDate),
          daysOverdue,
          bucket: getBucket(daysOverdue),
          balance_due: Math.abs(Number(c.opening_balance)),
          isOpeningBalance: true,
        };
      });
  }, [obContacts, tab, t]);

  const allEntries = useMemo(() => {
    return [...filteredInvoices, ...obEntries]
      .sort((a, b) => sortBy === "days" ? b.daysOverdue - a.daysOverdue : Number(b.balance_due) - Number(a.balance_due));
  }, [filteredInvoices, obEntries, sortBy]);

  const bucketData = useMemo(() => {
    const buckets = { "0-7": 0, "8-15": 0, "16-30": 0, "30+": 0 };
    for (const inv of allEntries) {
      buckets[inv.bucket as keyof typeof buckets] += Number(inv.balance_due);
    }
    return Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount }));
  }, [allEntries]);

  const chartConfig = {
    amount: { label: t("reports.amountDue"), color: "hsl(var(--chart-4))" },
  };

  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <DateRangePicker value={range} onChange={setRange} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "receivables" | "payables")}>
        <TabsList>
          <TabsTrigger value="receivables">{t("reports.receivables")}</TabsTrigger>
          <TabsTrigger value="payables">{t("reports.payables")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>{t("reports.agingDistribution")}</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={bucketData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("reports.overdueInvoices")}</CardTitle>
                <div className="flex gap-2">
                  <Badge
                    variant={sortBy === "days" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSortBy("days")}
                  >
                    {t("reports.byDays")}
                  </Badge>
                  <Badge
                    variant={sortBy === "amount" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSortBy("amount")}
                  >
                    {t("reports.byAmount")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("common.noData")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoice.number")}</TableHead>
                      <TableHead>{t("invoice.contact")}</TableHead>
                      <TableHead>{t("invoice.date")}</TableHead>
                      <TableHead>{t("reports.dueDate")}</TableHead>
                      <TableHead className="text-end">{t("reports.amountDue")}</TableHead>
                      <TableHead className="text-end">{t("reports.daysOverdue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allEntries.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.contactName}</TableCell>
                        <TableCell>{inv.invoice_date}</TableCell>
                        <TableCell>{inv.dueDate.toLocaleDateString()}</TableCell>
                        <TableCell className="text-end">₨{Number(inv.balance_due).toLocaleString()}</TableCell>
                        <TableCell className="text-end">
                          <Badge className={getBucketColor(inv.bucket)} variant="outline">
                            {inv.daysOverdue}d
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
