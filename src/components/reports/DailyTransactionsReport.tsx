import { useState } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon, Download, Printer, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn, fmtAmount } from "@/lib/utils";
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
  invoiceId?: string | null;
  isCashPayment?: boolean;
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
        .select("id, invoice_type, total, invoice_date, contact_id, contacts!invoices_contact_id_fkey(name, account_category)")
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
          invoiceId: inv.id,
        });
      }

      // 2. Payments (receipts & payments)
      const { data: payments } = await supabase
        .from("payments")
        .select("voucher_type, amount, payment_date, payment_method, invoice_id, contact_id, contacts!payments_contact_id_fkey(name, account_category)")
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
          invoiceId: p.invoice_id,
          isCashPayment: p.payment_method === "cash" && !!p.invoice_id,
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

  // Cash in Hand: opening (yesterday's closing), today's flow, today's closing
  const { data: cashSummary } = useQuery({
    queryKey: ["daily-cash-summary", dateStr],
    queryFn: async () => {
      // Cash accounts opening balances (only those dated <= dateStr count toward opening)
      const { data: cashContacts } = await supabase
        .from("contacts")
        .select("opening_balance, opening_balance_date")
        .eq("account_category", "cash");

      const openingFromContacts = (cashContacts || []).reduce((s, c) => {
        const d = c.opening_balance_date || "1900-01-01";
        // Opening for today includes contact opening if its date is strictly before today
        return d < dateStr ? s + Number(c.opening_balance || 0) : s;
      }, 0);

      // All cash payments (receipts/payments) before today
      const { data: priorPayments } = await supabase
        .from("payments")
        .select("amount, voucher_type")
        .eq("payment_method", "cash")
        .lt("payment_date", dateStr);

      const priorReceipts = (priorPayments || [])
        .filter(p => p.voucher_type === "receipt")
        .reduce((s, p) => s + Number(p.amount), 0);
      const priorPaymentsOut = (priorPayments || [])
        .filter(p => p.voucher_type === "payment")
        .reduce((s, p) => s + Number(p.amount), 0);

      // All cash expenses before today
      const { data: priorExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .eq("payment_method", "cash")
        .lt("expense_date", dateStr);
      const priorExpenseTotal = (priorExpenses || []).reduce((s, e) => s + Number(e.amount), 0);

      // Untracked invoice cash (invoices with amount_paid > 0 but no linked payment row)
      const { data: priorInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_type, amount_paid")
        .lt("invoice_date", dateStr)
        .gt("amount_paid", 0);

      const priorInvoiceIds = (priorInvoices || []).map(i => i.id);
      let untrackedCashIn = 0;
      let untrackedCashOut = 0;

      if (priorInvoiceIds.length > 0) {
        const { data: linkedPayments } = await supabase
          .from("payments")
          .select("invoice_id, amount")
          .in("invoice_id", priorInvoiceIds);

        const linkedMap = new Map<string, number>();
        for (const p of linkedPayments || []) {
          if (p.invoice_id) {
            linkedMap.set(p.invoice_id, (linkedMap.get(p.invoice_id) || 0) + Number(p.amount));
          }
        }

        for (const inv of priorInvoices || []) {
          const untracked = Number(inv.amount_paid) - (linkedMap.get(inv.id) || 0);
          if (untracked > 0) {
            if (inv.invoice_type === "sale") untrackedCashIn += untracked;
            else untrackedCashOut += untracked;
          }
        }
      }

      const opening = Math.round(
        openingFromContacts + priorReceipts + untrackedCashIn - priorPaymentsOut - untrackedCashOut - priorExpenseTotal
      );

      // Today's cash flow
      const { data: todayPayments } = await supabase
        .from("payments")
        .select("amount, voucher_type")
        .eq("payment_method", "cash")
        .eq("payment_date", dateStr);

      const todayReceipts = (todayPayments || [])
        .filter(p => p.voucher_type === "receipt")
        .reduce((s, p) => s + Number(p.amount), 0);
      const todayPaymentsOut = (todayPayments || [])
        .filter(p => p.voucher_type === "payment")
        .reduce((s, p) => s + Number(p.amount), 0);

      const { data: todayExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .eq("payment_method", "cash")
        .eq("expense_date", dateStr);
      const todayExpenseTotal = (todayExpenses || []).reduce((s, e) => s + Number(e.amount), 0);

      const received = Math.round(todayReceipts);
      const paid = Math.round(todayPaymentsOut + todayExpenseTotal);
      const closing = opening + received - paid;

      return { opening, received, paid, closing };
    },
    staleTime: 0,
  });

  // Collapse cash sale/purchase duplicates for DISPLAY only.
  // When a payment is cash and linked to an invoice, the invoice row and the
  // payment row both show the same amount. We hide the invoice row and rename
  // the payment row to "Cash Sale" / "Cash Purchase".
  // Cash in Hand summary above uses its own dedicated queries — unaffected.
  const paidInvoiceIds = new Set(
    transactions.filter(r => r.isCashPayment && r.invoiceId).map(r => r.invoiceId as string)
  );
  const displayTransactions: TransactionRow[] = transactions
    .filter(r => {
      // Drop invoice-side rows whose cash payment is also in today's data
      if (r.invoiceId && !r.isCashPayment && paidInvoiceIds.has(r.invoiceId)) {
        // This is the invoice row (Sale/Purchase) — its payment counterpart will represent it
        if (r.type === "Sale" || r.type === "Purchase") return false;
      }
      return true;
    })
    .map(r => {
      if (r.isCashPayment) {
        // Receipt against sale invoice → Cash Sale (CR side)
        // Payment against purchase invoice → Cash Purchase (DR side)
        return { ...r, type: r.credit > 0 ? "Cash Sale" : "Cash Purchase" };
      }
      return r;
    });

  // Group by category using the merged display rows
  const grouped: Record<string, TransactionRow[]> = {};
  for (const row of displayTransactions) {
    const key = row.category || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const totalDebit = displayTransactions.reduce((s, r) => s + r.debit, 0);
  const totalCredit = displayTransactions.reduce((s, r) => s + r.credit, 0);

  const fmt = (n: number) => n ? `₨ ${n.toLocaleString()}` : "—";

  const handleExport = () => {
    const headers = ["Date", "Contact/Account", "Category", "Type", "Debit (DR)", "Credit (CR)"];
    const rows = displayTransactions.map(r => [r.date, r.contact, r.category, r.type, r.debit, r.credit]);
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
      <CardContent className="space-y-4">
        {cashSummary && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {language === "ur" ? "نقد رقم" : "Cash in Hand"}
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "ur" ? "ابتدائی بیلنس" : "Opening Balance"}
                  <span className="ms-1 opacity-70">({format(addDays(date, -1), "dd MMM")})</span>
                </p>
                <p className="font-semibold tabular-nums" dir="ltr">{fmtAmount(cashSummary.opening)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "ur" ? "آج وصول" : "+ Received Today"}
                </p>
                <p className="font-semibold tabular-nums text-primary" dir="ltr">{fmtAmount(cashSummary.received)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "ur" ? "آج ادا" : "− Paid Today"}
                </p>
                <p className="font-semibold tabular-nums text-destructive" dir="ltr">{fmtAmount(cashSummary.paid)}</p>
              </div>
              <div className="border-s ps-3">
                <p className="text-xs text-muted-foreground">
                  {language === "ur" ? "اختتامی بیلنس" : "Closing Balance"}
                  <span className="ms-1 opacity-70">({format(date, "dd MMM")})</span>
                </p>
                <p className="font-bold tabular-nums" dir="ltr">{fmtAmount(cashSummary.closing)}</p>
              </div>
            </div>
          </div>
        )}
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
        ) : displayTransactions.length === 0 ? (
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
