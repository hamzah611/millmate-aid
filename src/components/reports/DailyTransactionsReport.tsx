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

interface TransactionRow {
  date: string;
  contact: string;
  category: string;
  type: string;
  debit: number;
  credit: number;
}

export function DailyTransactionsReport() {
  const { language } = useLanguage();
  const [date, setDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["daily-transactions", dateStr],
    queryFn: async () => {
      const rows: TransactionRow[] = [];

      // 1. Invoices (sales & purchases)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("invoice_type, total, invoice_date, contact_id, contacts!invoices_contact_id_fkey(name, account_category)")
        .eq("invoice_date", dateStr);

      for (const inv of invoices || []) {
        const contact = inv.contacts as any;
        rows.push({
          date: inv.invoice_date,
          contact: contact?.name || "—",
          category: contact?.account_category || "—",
          type: inv.invoice_type === "sale" ? "Sale" : "Purchase",
          debit: inv.invoice_type === "sale" ? inv.total : 0,
          credit: inv.invoice_type === "purchase" ? inv.total : 0,
        });
      }

      // 2. Payments (receipts & payments)
      const { data: payments } = await supabase
        .from("payments")
        .select("voucher_type, amount, payment_date, payment_method, contact_id, contacts!payments_contact_id_fkey(name, account_category)")
        .eq("payment_date", dateStr);

      for (const p of payments || []) {
        const contact = p.contacts as any;
        const isReceipt = p.voucher_type === "receipt";
        rows.push({
          date: p.payment_date,
          contact: contact?.name || "—",
          category: contact?.account_category || "—",
          type: isReceipt ? "Payment Received" : "Payment Made",
          debit: isReceipt ? 0 : p.amount,    // Payment made = DR (party account debited)
          credit: isReceipt ? p.amount : 0,   // Receipt = CR (party account credited)
        });
      }

      // 3. Expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, expense_date, notes, category_id, expense_categories!expenses_category_id_fkey(name)")
        .eq("expense_date", dateStr);

      for (const e of expenses || []) {
        const cat = e.expense_categories as any;
        rows.push({
          date: e.expense_date,
          contact: cat?.name || e.notes || "Expense",
          category: "expenses",
          type: "Expense",
          debit: e.amount,
          credit: 0,
        });
      }

      // Sort by category then type
      rows.sort((a, b) => a.category.localeCompare(b.category) || a.type.localeCompare(b.type));
      return rows;
    },
    staleTime: 0,
  });

  // Group by category
  const grouped: Record<string, TransactionRow[]> = {};
  for (const row of transactions) {
    const key = row.category || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const totalDebit = transactions.reduce((s, r) => s + r.debit, 0);
  const totalCredit = transactions.reduce((s, r) => s + r.credit, 0);

  const fmt = (n: number) => n ? `₨ ${n.toLocaleString()}` : "—";

  const handleExport = () => {
    const headers = ["Date", "Contact/Account", "Category", "Type", "Debit (DR)", "Credit (CR)"];
    const rows = transactions.map(r => [r.date, r.contact, r.category, r.type, r.debit, r.credit]);
    rows.push(["", "", "", "TOTAL", totalDebit, totalCredit]);
    exportToCSV(`daily-transactions-${dateStr}`, headers, rows);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg">
          {language === "ur" ? "یومیہ لین دین رپورٹ" : "Daily Transactions Report"}
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
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
        ) : transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {language === "ur" ? "اس تاریخ کے لیے کوئی لین دین نہیں" : "No transactions for this date"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact / Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit (DR)</TableHead>
                <TableHead className="text-right">Credit (CR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(grouped).map(([category, rows]) => {
                const catDebit = rows.reduce((s, r) => s + r.debit, 0);
                const catCredit = rows.reduce((s, r) => s + r.credit, 0);
                return (
                  <> 
                    <TableRow key={`header-${category}`} className="bg-muted/30">
                      <TableCell colSpan={5} className="font-semibold text-sm py-2">
                        {category}
                      </TableCell>
                    </TableRow>
                    {rows.map((row, i) => (
                      <TableRow key={`${category}-${i}`}>
                        <TableCell>{row.contact}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{row.category}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell className="text-right">{fmt(row.debit)}</TableCell>
                        <TableCell className="text-right">{fmt(row.credit)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow key={`subtotal-${category}`} className="border-t-2">
                      <TableCell colSpan={3} className="text-right font-medium text-sm">Subtotal</TableCell>
                      <TableCell className="text-right font-medium">{fmt(catDebit)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(catCredit)}</TableCell>
                    </TableRow>
                  </>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">Daily Total</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalDebit)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalCredit)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
