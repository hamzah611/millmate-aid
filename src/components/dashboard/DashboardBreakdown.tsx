import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategoryBalances } from "@/lib/financial-utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";

type BreakdownType = "cash" | "bank" | "receivables" | "payables" | "employee" | null;

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

function CashBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-cash"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const openingCash = balances.cashBalance;

      const { data: allPayments } = await supabase.from("payments").select("amount, payment_method, voucher_type, invoice_id");
      const cashReceipts = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "receipt")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const cashPayments = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "payment")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Untracked initial payments
      const voucherTotalsByInvoice = new Map<string, number>();
      for (const p of allPayments || []) {
        voucherTotalsByInvoice.set(p.invoice_id, (voucherTotalsByInvoice.get(p.invoice_id) || 0) + Number(p.amount));
      }
      const { data: allInvoices } = await supabase.from("invoices").select("id, invoice_type, amount_paid");
      let untrackedSaleCash = 0;
      let untrackedPurchaseCash = 0;
      for (const inv of allInvoices || []) {
        const voucherTotal = voucherTotalsByInvoice.get(inv.id) || 0;
        const untracked = Number(inv.amount_paid) - voucherTotal;
        if (untracked > 0) {
          if (inv.invoice_type === "sale") untrackedSaleCash += untracked;
          else untrackedPurchaseCash += untracked;
        }
      }

      const { data: expenseData } = await supabase.from("expenses").select("amount").eq("payment_method", "cash");
      const totalCashExpenses = expenseData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      const total = openingCash + cashReceipts + untrackedSaleCash - cashPayments - untrackedPurchaseCash - totalCashExpenses;

      return { openingCash, cashReceipts, untrackedSaleCash, cashPayments, untrackedPurchaseCash, totalCashExpenses, total };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <SectionHeader title={t("reports.cashInflows") || "Cash In"} />
      <LineItem label={t("contacts.openingBalance")} value={data.openingCash} sign="+" />
      <LineItem label={t("reports.received") + " (" + t("nav.sales") + ")"} value={data.cashReceipts} sign="+" />
      {data.untrackedSaleCash > 0 && <LineItem label={t("reports.received") + " (initial)"} value={data.untrackedSaleCash} sign="+" />}
      <Separator className="my-2" />
      <SectionHeader title={t("reports.cashOutflows") || "Cash Out"} />
      <LineItem label={t("reports.paid") + " (" + t("nav.purchases") + ")"} value={data.cashPayments} sign="-" />
      {data.untrackedPurchaseCash > 0 && <LineItem label={t("reports.paid") + " (initial)"} value={data.untrackedPurchaseCash} sign="-" />}
      <LineItem label={t("nav.expenses") || "Expenses"} value={data.totalCashExpenses} sign="-" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.totalCash")} value={data.total} sign="=" />
    </div>
  );
}

function BankBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-bank"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const openingBank = balances.bankBalance;

      const { data: bankPayments } = await supabase.from("payments").select("amount, voucher_type").eq("payment_method", "bank");
      const bankIn = bankPayments?.filter(p => p.voucher_type === "receipt")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const bankOut = bankPayments?.filter(p => p.voucher_type === "payment")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const { data: bankExpenses } = await supabase.from("expenses").select("amount").eq("payment_method", "bank");
      const totalBankExpenses = bankExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      const total = openingBank + bankIn - bankOut - totalBankExpenses;
      return { openingBank, bankIn, bankOut, totalBankExpenses, total };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <SectionHeader title={t("reports.cashInflows") || "In"} />
      <LineItem label={t("contacts.openingBalance")} value={data.openingBank} sign="+" />
      <LineItem label={t("reports.received")} value={data.bankIn} sign="+" />
      <Separator className="my-2" />
      <SectionHeader title={t("reports.cashOutflows") || "Out"} />
      <LineItem label={t("reports.paid")} value={data.bankOut} sign="-" />
      <LineItem label={t("nav.expenses") || "Expenses"} value={data.totalBankExpenses} sign="-" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.bankBalance")} value={data.total} sign="=" />
    </div>
  );
}

function ReceivablesBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-receivables"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const openingCustomer = balances.customerReceivables;

      const { data: invoices } = await supabase.from("invoices").select("total, balance_due").eq("invoice_type", "sale");
      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const invoiceReceivables = invoices?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
      const totalReceived = totalSales - invoiceReceivables;

      const total = invoiceReceivables + openingCustomer;
      return { totalSales, totalReceived, openingCustomer, invoiceReceivables, total };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <LineItem label={t("reports.totalSales")} value={data.totalSales} sign="+" />
      <LineItem label={t("reports.received")} value={data.totalReceived} sign="-" />
      <LineItem label={t("contacts.openingBalance") + " (" + t("contacts.customer") + ")"} value={data.openingCustomer} sign="+" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.receivables")} value={data.total} sign="=" />
    </div>
  );
}

function PayablesBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-payables"],
    queryFn: async () => {
      const balances = await fetchCategoryBalances();
      const openingSupplier = Math.abs(balances.supplierPayables);

      const { data: invoices } = await supabase.from("invoices").select("total, balance_due").eq("invoice_type", "purchase");
      const totalPurchases = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const invoicePayables = invoices?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
      const totalPaid = totalPurchases - invoicePayables;

      const total = invoicePayables + openingSupplier;
      return { totalPurchases, totalPaid, openingSupplier, invoicePayables, total };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <LineItem label={t("reports.totalPurchases")} value={data.totalPurchases} sign="+" />
      <LineItem label={t("reports.paid")} value={data.totalPaid} sign="-" />
      <LineItem label={t("contacts.openingBalance") + " (" + t("contacts.supplier") + ")"} value={data.openingSupplier} sign="+" />
      <Separator className="my-2" />
      <LineItem label={t("dashboard.payables")} value={data.total} sign="=" />
    </div>
  );
}

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
  bank: "dashboard.bankBalance",
  receivables: "dashboard.receivables",
  payables: "dashboard.payables",
  employee: "dashboard.employeeAdvances",
};

export default function DashboardBreakdown({ type, onClose }: Props) {
  const { t } = useLanguage();

  if (!type) return null;

  return (
    <Drawer open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{t(titles[type])}</DrawerTitle>
          <DrawerDescription>{t("dashboard.clickToSeeDetails")}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          {type === "cash" && <CashBreakdown />}
          {type === "bank" && <BankBreakdown />}
          {type === "receivables" && <ReceivablesBreakdown />}
          {type === "payables" && <PayablesBreakdown />}
          {type === "employee" && <EmployeeBreakdown />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
