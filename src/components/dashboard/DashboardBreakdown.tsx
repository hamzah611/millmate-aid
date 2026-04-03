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

function CashBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-cash"],
    queryFn: () => calculateCashInHand(),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

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
    </div>
  );
}

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
    </div>
  );
}

function ReceivablesBreakdown() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["breakdown-receivables"],
    queryFn: async () => {
      const result = await calculateReceivables();
      const { data: invoices } = await supabase.from("invoices").select("total").eq("invoice_type", "sale");
      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalReceived = totalSales - result.invoiceBalance;
      return { ...result, totalSales, totalReceived };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <LineItem label={t("reports.totalSales")} value={data.totalSales} sign="+" />
      <LineItem label={t("reports.received")} value={data.totalReceived} sign="-" />
      <LineItem label={t("contacts.openingBalance") + " (" + t("contacts.customer") + ")"} value={data.openingBalance} sign="+" />
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
      const result = await calculatePayables();
      const { data: invoices } = await supabase.from("invoices").select("total").eq("invoice_type", "purchase");
      const totalPurchases = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalPaid = totalPurchases - result.invoiceBalance;
      return { ...result, totalPurchases, totalPaid };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-4">{t("common.loading")}</p>;

  return (
    <div className="space-y-1">
      <LineItem label={t("reports.totalPurchases")} value={data.totalPurchases} sign="+" />
      <LineItem label={t("reports.paid")} value={data.totalPaid} sign="-" />
      <LineItem label={t("contacts.openingBalance") + " (" + t("contacts.supplier") + ")"} value={data.openingBalance} sign="+" />
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
