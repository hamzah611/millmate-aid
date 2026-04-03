import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import {
  calculateCashInHand,
  calculateBankBalances,
  calculateReceivables,
  calculatePayables,
  fetchCategoryBalances,
} from "@/lib/financial-utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

type BreakdownType = "cash" | "receivables" | "payables" | "employee" | `bank-${string}` | null;

interface Props {
  type: BreakdownType;
  onClose: () => void;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const formatted = `₨ ${abs.toLocaleString()}`;
  return n < 0 ? `(${formatted})` : formatted;
};

function LineItem({ label, value, sign }: { label: string; value: number; sign?: "+" | "-" | "=" }) {
  const isTotal = sign === "=";
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-md ${isTotal ? "bg-muted font-bold text-base" : "hover:bg-muted/30"}`}>
      <span className="flex items-center gap-2">
        {sign && <span className={`text-xs font-mono w-4 ${sign === "+" ? "text-green-600" : sign === "-" ? "text-red-500" : "text-primary"}`}>{sign}</span>}
        <span className={isTotal ? "" : "text-sm text-muted-foreground"}>{label}</span>
      </span>
      <span className={`font-mono text-sm ${isTotal ? "text-base" : ""} ${value < 0 ? "text-red-500" : ""}`}>{fmt(value)}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-1 px-3">{title}</h3>;
}

// === Transaction list for Cash / Bank ===
interface TxRow {
  date: string;
  contact: string;
  ref: string;
  amount: number;
  type: "in" | "out";
}

function TransactionList({ transactions }: { transactions: TxRow[] }) {
  const { t } = useLanguage();
  if (!transactions.length) return <p className="text-sm text-muted-foreground px-3 py-2">{t("common.noData")}</p>;

  let running = 0;
  const rows = transactions.map((tx) => {
    running += tx.type === "in" ? tx.amount : -tx.amount;
    return { ...tx, running };
  });

  return (
    <div className="max-h-[300px] overflow-y-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">{t("dashboard.date")}</th>
            <th className="text-left px-2 py-1.5 font-medium">{t("dashboard.contact")}</th>
            <th className="text-right px-2 py-1.5 font-medium">{t("dashboard.amount")}</th>
            <th className="text-right px-2 py-1.5 font-medium">{t("dashboard.runningBalance")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              <td className="px-2 py-1.5">{r.date}</td>
              <td className="px-2 py-1.5 truncate max-w-[120px]" title={r.contact}>{r.contact}</td>
              <td className={`px-2 py-1.5 text-right font-mono ${r.type === "in" ? "text-green-600" : "text-red-500"}`}>
                {r.type === "in" ? "+" : "-"}{fmt(r.amount)}
              </td>
              <td className={`px-2 py-1.5 text-right font-mono ${r.running < 0 ? "text-red-500" : ""}`}>{fmt(r.running)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LazyTransactions({ queryKey, queryFn }: { queryKey: string[]; queryFn: () => Promise<TxRow[]> }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn,
    enabled: false,
  });

  const handleToggle = (open: boolean) => {
    setExpanded(open);
    if (open && !data) refetch();
  };

  return (
    <Collapsible open={expanded} onOpenChange={handleToggle}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-primary hover:underline px-3 py-2 w-full">
        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        {t("dashboard.viewTransactions")}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground px-3 py-2">{t("common.loading")}</p>
        ) : (
          <TransactionList transactions={data || []} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// === Cash Breakdown ===
function CashBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-cash"],
    queryFn: () => calculateCashInHand(),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  const fetchCashTx = async (): Promise<TxRow[]> => {
    const [{ data: payments }, { data: expenses }] = await Promise.all([
      supabase.from("payments").select("amount, voucher_type, payment_date, voucher_number, contact_id").eq("payment_method", "cash"),
      supabase.from("expenses").select("amount, expense_date, notes").eq("payment_method", "cash"),
    ]);

    const contactIds = [...new Set((payments || []).map(p => p.contact_id).filter(Boolean))];
    const contactMap = new Map<string, string>();
    if (contactIds.length) {
      const { data: contacts } = await supabase.from("contacts").select("id, name").in("id", contactIds);
      contacts?.forEach(c => contactMap.set(c.id, c.name));
    }

    const txRows: TxRow[] = [];
    for (const p of payments || []) {
      txRows.push({
        date: p.payment_date,
        contact: contactMap.get(p.contact_id || "") || "-",
        ref: p.voucher_number || "",
        amount: Number(p.amount),
        type: p.voucher_type === "receipt" ? "in" : "out",
      });
    }
    for (const e of expenses || []) {
      txRows.push({
        date: e.expense_date,
        contact: e.notes || t("dashboard.expense"),
        ref: "",
        amount: Number(e.amount),
        type: "out",
      });
    }
    txRows.sort((a, b) => a.date.localeCompare(b.date));
    return txRows;
  };

  return (
    <div className="space-y-1">
      <SectionHeader title={t("reports.cashInflows") || "Cash In"} />
      <LineItem label={t("contacts.openingBalance")} value={data.opening} sign="+" />
      <LineItem label={t("reports.received") + " (" + t("nav.sales") + ")"} value={data.cashReceipts} sign="+" />
      {data.untrackedSaleCash > 0 && <LineItem label={t("reports.received") + " (initial)"} value={data.untrackedSaleCash} sign="+" />}
      <Separator className="my-2" />
      <SectionHeader title={t("reports.cashOutflows") || "Cash Out"} />
      <LineItem label={t("reports.paid") + " (" + t("nav.purchases") + ")"} value={data.cashPayments} sign="-" />
      {data.untrackedPurchaseCash > 0 && <LineItem label={t("reports.paid") + " (initial)"} value={data.untrackedPurchaseCash} sign="-" />}
      <LineItem label={t("nav.expenses") || "Expenses"} value={data.cashExpenses} sign="-" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.totalCash")} value={data.total} sign="=" />
      <Separator className="my-2" />
      <LazyTransactions queryKey={["cash-transactions"]} queryFn={fetchCashTx} />
    </div>
  );
}

// === Bank Breakdown ===
function BankBreakdown({ bankId }: { bankId: string }) {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-bank", bankId],
    queryFn: async () => {
      const banks = await calculateBankBalances();
      return banks.find(b => b.id === bankId) || null;
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  const fetchBankTx = async (): Promise<TxRow[]> => {
    const [{ data: payments }, { data: expenses }] = await Promise.all([
      supabase.from("payments").select("amount, voucher_type, payment_date, voucher_number, contact_id").eq("payment_method", "bank").eq("bank_contact_id", bankId),
      supabase.from("expenses").select("amount, expense_date, notes").eq("payment_method", "bank").eq("bank_contact_id", bankId),
    ]);

    const contactIds = [...new Set((payments || []).map(p => p.contact_id).filter(Boolean))];
    const contactMap = new Map<string, string>();
    if (contactIds.length) {
      const { data: contacts } = await supabase.from("contacts").select("id, name").in("id", contactIds);
      contacts?.forEach(c => contactMap.set(c.id, c.name));
    }

    const txRows: TxRow[] = [];
    for (const p of payments || []) {
      txRows.push({
        date: p.payment_date,
        contact: contactMap.get(p.contact_id || "") || "-",
        ref: p.voucher_number || "",
        amount: Number(p.amount),
        type: p.voucher_type === "receipt" ? "in" : "out",
      });
    }
    for (const e of expenses || []) {
      txRows.push({
        date: e.expense_date,
        contact: e.notes || t("dashboard.expense"),
        ref: "",
        amount: Number(e.amount),
        type: "out",
      });
    }
    txRows.sort((a, b) => a.date.localeCompare(b.date));
    return txRows;
  };

  return (
    <div className="space-y-1">
      <SectionHeader title={t("reports.cashInflows") || "In"} />
      <LineItem label={t("contacts.openingBalance")} value={data.opening} sign="+" />
      <LineItem label={t("reports.received")} value={data.receipts} sign="+" />
      <Separator className="my-2" />
      <SectionHeader title={t("reports.cashOutflows") || "Out"} />
      <LineItem label={t("reports.paid")} value={data.payments} sign="-" />
      <LineItem label={t("nav.expenses") || "Expenses"} value={data.expenses} sign="-" />
      <Separator className="my-2" />
      <LineItem label={data.name} value={data.balance} sign="=" />
      <Separator className="my-2" />
      <LazyTransactions queryKey={["bank-transactions", bankId]} queryFn={fetchBankTx} />
    </div>
  );
}

// === Receivables with per-customer drill-down ===
interface CustomerBalance {
  id: string;
  name: string;
  openingBalance: number;
  invoiceBalance: number;
  total: number;
  invoices: { number: string; date: string; total: number; balance_due: number }[];
}

function ReceivablesBreakdown() {
  const { t } = useLanguage();
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["breakdown-receivables"],
    queryFn: async () => {
      const result = await calculateReceivables();
      const { data: invoices } = await supabase.from("invoices").select("total").eq("invoice_type", "sale");
      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalReceived = totalSales - result.invoiceBalance;
      return { ...result, totalSales, totalReceived };
    },
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["breakdown-receivables-customers"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .in("account_category", ["customer"]);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, invoice_number, invoice_date, total, balance_due")
        .eq("invoice_type", "sale")
        .gt("balance_due", 0);

      const invoicesByContact = new Map<string, typeof invoices>();
      for (const inv of invoices || []) {
        const list = invoicesByContact.get(inv.contact_id) || [];
        list.push(inv);
        invoicesByContact.set(inv.contact_id, list);
      }

      const results: CustomerBalance[] = [];
      for (const c of contacts || []) {
        const ob = Number(c.opening_balance || 0);
        const custInvoices = invoicesByContact.get(c.id) || [];
        const invBal = custInvoices.reduce((s, i) => s + Number(i.balance_due), 0);
        const total = ob + invBal;
        if (total <= 0 && custInvoices.length === 0) continue;
        results.push({
          id: c.id,
          name: c.name,
          openingBalance: ob,
          invoiceBalance: invBal,
          total,
          invoices: custInvoices.map(i => ({
            number: i.invoice_number,
            date: i.invoice_date,
            total: Number(i.total),
            balance_due: Number(i.balance_due),
          })),
        });
      }
      results.sort((a, b) => b.total - a.total);
      return results;
    },
  });

  if (summaryLoading || !summary) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <LineItem label={t("reports.totalSales")} value={summary.totalSales} sign="+" />
      <LineItem label={t("reports.received")} value={summary.totalReceived} sign="-" />
      <LineItem label={t("contacts.openingBalance") + " (" + t("contacts.customer") + ")"} value={summary.openingBalance} sign="+" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.receivables")} value={summary.total} sign="=" />
      <Separator className="my-2" />
      <SectionHeader title={t("dashboard.topCustomers")} />
      {customersLoading ? (
        <p className="text-sm text-muted-foreground px-3">{t("common.loading")}</p>
      ) : !customers?.length ? (
        <p className="text-sm text-muted-foreground px-3">{t("common.noData")}</p>
      ) : (
        <ContactDrillDown contacts={customers} />
      )}
    </div>
  );
}

// === Payables with per-supplier drill-down ===
function PayablesBreakdown() {
  const { t } = useLanguage();
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["breakdown-payables"],
    queryFn: async () => {
      const result = await calculatePayables();
      const { data: invoices } = await supabase.from("invoices").select("total").eq("invoice_type", "purchase");
      const totalPurchases = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalPaid = totalPurchases - result.invoiceBalance;
      return { ...result, totalPurchases, totalPaid };
    },
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["breakdown-payables-suppliers"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .in("account_category", ["supplier"]);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, invoice_number, invoice_date, total, balance_due")
        .eq("invoice_type", "purchase")
        .gt("balance_due", 0);

      const invoicesByContact = new Map<string, typeof invoices>();
      for (const inv of invoices || []) {
        const list = invoicesByContact.get(inv.contact_id) || [];
        list.push(inv);
        invoicesByContact.set(inv.contact_id, list);
      }

      const results: CustomerBalance[] = [];
      for (const c of contacts || []) {
        const ob = Math.abs(Number(c.opening_balance || 0));
        const custInvoices = invoicesByContact.get(c.id) || [];
        const invBal = custInvoices.reduce((s, i) => s + Number(i.balance_due), 0);
        const total = ob + invBal;
        if (total <= 0 && custInvoices.length === 0) continue;
        results.push({
          id: c.id,
          name: c.name,
          openingBalance: ob,
          invoiceBalance: invBal,
          total,
          invoices: custInvoices.map(i => ({
            number: i.invoice_number,
            date: i.invoice_date,
            total: Number(i.total),
            balance_due: Number(i.balance_due),
          })),
        });
      }
      results.sort((a, b) => b.total - a.total);
      return results;
    },
  });

  if (summaryLoading || !summary) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <LineItem label={t("reports.totalPurchases")} value={summary.totalPurchases} sign="+" />
      <LineItem label={t("reports.paid")} value={summary.totalPaid} sign="-" />
      <LineItem label={t("contacts.openingBalance") + " (" + t("contacts.supplier") + ")"} value={summary.openingBalance} sign="+" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.payables")} value={summary.total} sign="=" />
      <Separator className="my-2" />
      <SectionHeader title={t("dashboard.topSuppliers")} />
      {suppliersLoading ? (
        <p className="text-sm text-muted-foreground px-3">{t("common.loading")}</p>
      ) : !suppliers?.length ? (
        <p className="text-sm text-muted-foreground px-3">{t("common.noData")}</p>
      ) : (
        <ContactDrillDown contacts={suppliers} />
      )}
    </div>
  );
}

// === Shared collapsible contact list with invoice drill-down ===
function ContactDrillDown({ contacts }: { contacts: CustomerBalance[] }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-1">
      {contacts.map((c) => (
        <Collapsible key={c.id}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-muted/30 text-sm">
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 transition-transform [&[data-state=open]]:rotate-90" />
              {c.name}
            </span>
            <span className="font-mono">{fmt(c.total)}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-6 space-y-0.5">
            {c.openingBalance > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground px-3 py-1">
                <span>{t("contacts.openingBalance")}</span>
                <span className="font-mono">{fmt(c.openingBalance)}</span>
              </div>
            )}
            {c.invoices.map((inv, i) => (
              <div key={i} className="flex justify-between text-xs px-3 py-1 hover:bg-muted/20 rounded">
                <span className="flex gap-2">
                  <span className="text-muted-foreground">{inv.number}</span>
                  <span className="text-muted-foreground">{inv.date}</span>
                </span>
                <span className="font-mono">{fmt(inv.balance_due)}</span>
              </div>
            ))}
            {!c.invoices.length && c.openingBalance <= 0 && (
              <p className="text-xs text-muted-foreground px-3 py-1">{t("common.noData")}</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

// === Employee Breakdown (unchanged) ===
function EmployeeBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-employee"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("name, opening_balance")
        .eq("account_category", "employee")
        .neq("opening_balance", 0);

      const items = (contacts || []).map(c => ({ name: c.name, balance: Number(c.opening_balance) }));
      const total = items.reduce((sum, i) => sum + i.balance, 0);
      return { items, total };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;
  if (!data.items.length) return <p className="text-sm text-muted-foreground p-4">{t("common.noData")}</p>;

  return (
    <div className="space-y-1">
      {data.items.map((item, i) => (
        <LineItem key={i} label={item.name} value={item.balance} sign="+" />
      ))}
      <Separator className="my-2" />
      <LineItem label={t("dashboard.employeeAdvances")} value={data.total} sign="=" />
    </div>
  );
}

const titles: Record<string, string> = {
  cash: "dashboard.totalCash",
  receivables: "dashboard.receivables",
  payables: "dashboard.payables",
  employee: "dashboard.employeeAdvances",
};

export default function DashboardBreakdown({ type, onClose }: Props) {
  const { t } = useLanguage();

  if (!type) return null;

  const isBankType = type?.startsWith("bank-");
  const bankId = isBankType ? type.slice(5) : "";
  const titleKey = isBankType ? "dashboard.bankBalance" : titles[type] || type;

  return (
    <Drawer open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{t(titleKey)}</DrawerTitle>
          <DrawerDescription>{t("dashboard.clickToSeeDetails")}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          {type === "cash" && <CashBreakdown />}
          {isBankType && <BankBreakdown bankId={bankId} />}
          {type === "receivables" && <ReceivablesBreakdown />}
          {type === "payables" && <PayablesBreakdown />}
          {type === "employee" && <EmployeeBreakdown />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
