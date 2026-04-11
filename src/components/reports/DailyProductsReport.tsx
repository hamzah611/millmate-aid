import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportToCSV } from "@/lib/export-csv";

interface ProductRow {
  product: string;
  quantity: number;
  rate: number;
  total: number;
}

export function DailyProductsReport() {
  const { language } = useLanguage();
  const [date, setDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const dateStr = format(date, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["daily-products", dateStr],
    queryFn: async () => {
      // Get invoice items with invoice type and product name for the date
      const { data: items } = await supabase
        .from("invoice_items")
        .select("quantity, price_per_unit, total, product_id, products!invoice_items_product_id_fkey(name), invoice_id, invoices!invoice_items_invoice_id_fkey(invoice_type, invoice_date)")
        .eq("invoices.invoice_date", dateStr);

      const sales: ProductRow[] = [];
      const purchases: ProductRow[] = [];

      for (const item of items || []) {
        const inv = item.invoices as any;
        const prod = item.products as any;
        if (!inv || inv.invoice_date !== dateStr) continue;

        const row: ProductRow = {
          product: prod?.name || "—",
          quantity: item.quantity,
          rate: item.price_per_unit,
          total: item.total,
        };

        if (inv.invoice_type === "sale") {
          sales.push(row);
        } else {
          purchases.push(row);
        }
      }

      // Expenses for the date
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, notes, category_id, expense_categories!expenses_category_id_fkey(name)")
        .eq("expense_date", dateStr);

      const expenseRows = (expenses || []).map(e => ({
        category: (e.expense_categories as any)?.name || e.notes || "Expense",
        amount: e.amount,
      }));

      return { sales, purchases, expenses: expenseRows };
    },
    staleTime: 0,
  });

  const sales = data?.sales || [];
  const purchases = data?.purchases || [];
  const expenses = data?.expenses || [];

  const salesTotal = sales.reduce((s, r) => s + r.total, 0);
  const purchasesTotal = purchases.reduce((s, r) => s + r.total, 0);
  const expensesTotal = expenses.reduce((s, r) => s + r.amount, 0);

  const fmt = (n: number) => `₨ ${n.toLocaleString()}`;

  const handleExport = () => {
    const headers = ["Section", "Product/Category", "Quantity", "Rate", "Total"];
    const rows: (string | number)[][] = [];
    sales.forEach(r => rows.push(["Sale", r.product, r.quantity, r.rate, r.total]));
    rows.push(["", "Sales Total", "", "", salesTotal]);
    purchases.forEach(r => rows.push(["Purchase", r.product, r.quantity, r.rate, r.total]));
    rows.push(["", "Purchases Total", "", "", purchasesTotal]);
    expenses.forEach(r => rows.push(["Expense", r.category, "", "", r.amount]));
    rows.push(["", "Expenses Total", "", "", expensesTotal]);
    exportToCSV(`daily-products-${dateStr}`, headers, rows);
  };

  const renderProductTable = (title: string, rows: ProductRow[], total: number) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-base">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm pl-2">No records</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.product}</TableCell>
                <TableCell className="text-right">{r.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right">{fmt(r.rate)}</TableCell>
                <TableCell className="text-right">{fmt(r.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">{fmt(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg">
          {language === "ur" ? "یومیہ مصنوعات رپورٹ" : "Daily Products Report"}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-[160px] justify-start">
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {format(date, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> {language === "ur" ? "پرنٹ" : "Print"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
        ) : (
          <>
            {renderProductTable(language === "ur" ? "فروخت" : "Sales", sales, salesTotal)}
            {renderProductTable(language === "ur" ? "خریداری" : "Purchases", purchases, purchasesTotal)}

            <div className="space-y-2">
              <h3 className="font-semibold text-base">{language === "ur" ? "اخراجات" : "Expenses"}</h3>
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-sm pl-2">No records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.category}</TableCell>
                        <TableCell className="text-right">{fmt(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="text-right font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{fmt(expensesTotal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
