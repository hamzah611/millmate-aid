import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtQty } from "@/lib/utils";
import {
  calculateCashInHand,
  calculateBankBalances,
  fetchCategoryBalances,
} from "@/lib/financial-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import type { DateRange } from "./DateRangePicker";

interface Props {
  range: DateRange;
  businessUnit?: string;
}

/* ── Format currency with ₨ symbol, thousands separator, parentheses for negative ── */
function fmt(v: number): string {
  if (v === 0) return "₨ 0";
  const abs = Math.abs(v);
  const str = abs.toLocaleString("en-PK", { maximumFractionDigits: 0 });
  return v < 0 ? `(₨ ${str})` : `₨ ${str}`;
}

/* ── Column Headers ── */
function ColumnHeaders() {
  return (
    <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30">
      <span>Account</span>
      <span className="text-right">Debit (₨)</span>
      <span className="text-right">Credit (₨)</span>
    </div>
  );
}

/* ── Account line: always visible, optionally expandable ── */
function AccountLine({
  name,
  debit,
  credit,
  badge,
  children,
}: {
  name: string;
  debit: number;
  credit: number;
  badge?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!children;

  const content = (
    <div className="grid grid-cols-[1fr_120px_120px] gap-2 items-center py-1.5 px-3 hover:bg-muted/30 rounded transition-colors group">
      <span className="flex items-center gap-2 text-sm">
        {hasChildren && (
          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        )}
        {!hasChildren && <span className="w-3.5" />}
        {name}
        {badge && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{badge}</Badge>}
      </span>
      <span className="font-mono text-sm tabular-nums text-right">
        {debit > 0 ? fmt(debit) : ""}
      </span>
      <span className="font-mono text-sm tabular-nums text-right">
        {credit > 0 ? fmt(credit) : ""}
      </span>
    </div>
  );

  if (!hasChildren) return content;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full cursor-pointer">{content}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 pl-3 border-l-2 border-border/30 mb-2 space-y-0.5 py-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Sub-detail line (inside expanded account) ── */
function DetailLine({ label, amount, positive }: { label: string; amount: number; positive?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-xs text-muted-foreground truncate max-w-[70%]">{label}</span>
      <span className={`font-mono text-xs tabular-nums ${positive === true ? "text-green-600" : positive === false ? "text-destructive" : ""}`}>
        {fmt(amount)}
      </span>
    </div>
  );
}

/* ── Section header (ASSETS / LIABILITIES / EQUITY) ── */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-muted/60 rounded px-4 py-2 mt-4 first:mt-0 mb-1">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
    </div>
  );
}

/* ── Sub-section header (Cash Accounts, Bank Accounts, etc.) ── */
function SubSectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
    </div>
  );
}

/* ── Group header within a section ── */
function GroupHeader({ title }: { title: string }) {
  return (
    <div className="px-3 pt-2 pb-0.5">
      <span className="text-[11px] font-medium text-muted-foreground/80 italic">{title}</span>
    </div>
  );
}

/* ── Group subtotal row ── */
function GroupSubtotal({ label, debit, credit }: { label: string; debit: number; credit: number }) {
  return (
    <div className="grid grid-cols-[1fr_120px_120px] gap-2 items-baseline px-3 py-1 border-t border-border/20">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold tabular-nums text-right">{debit > 0 ? fmt(debit) : ""}</span>
      <span className="font-mono text-xs font-semibold tabular-nums text-right">{credit > 0 ? fmt(credit) : ""}</span>
    </div>
  );
}

/* ── Total row ── */
function TotalRow({ label, debit, credit, double }: { label: string; debit: number; credit: number; double?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_120px_120px] gap-2 items-baseline px-3 py-2 mt-2 ${double ? "border-t-4 border-double border-foreground/30" : "border-t-2 border-foreground/20"}`}>
      <span className="font-bold text-sm">{label}</span>
      <span className="font-mono font-bold text-sm tabular-nums text-right">{debit > 0 ? fmt(debit) : ""}</span>
      <span className="font-mono font-bold text-sm tabular-nums text-right">{credit > 0 ? fmt(credit) : ""}</span>
    </div>
  );
}

/* ── Separator line ── */
function DottedLine() {
  return <div className="border-t border-dashed border-border/40 mx-3 my-1" />;
}

/* ── Helper: group items by account_type and render with subtotals ── */
function renderGrouped<T extends { account_type?: string | null }>(
  items: T[],
  renderItem: (item: T, index: number) => React.ReactNode,
  getDebit: (item: T) => number,
  getCredit: (item: T) => number,
) {
  const grouped = new Map<string, T[]>();
  const ungrouped: T[] = [];
  for (const item of items) {
    const grp = (item as any).account_type || "";
    if (grp) {
      if (!grouped.has(grp)) grouped.set(grp, []);
      grouped.get(grp)!.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  const elements: React.ReactNode[] = [];
  for (const [groupName, groupItems] of grouped) {
    elements.push(<GroupHeader key={`gh-${groupName}`} title={groupName} />);
    groupItems.forEach((item, i) => elements.push(renderItem(item, i)));
    const groupDebit = groupItems.reduce((s, item) => s + getDebit(item), 0);
    const groupCredit = groupItems.reduce((s, item) => s + getCredit(item), 0);
    elements.push(<GroupSubtotal key={`gs-${groupName}`} label={`${groupName} Subtotal`} debit={groupDebit} credit={groupCredit} />);
  }
  // Ungrouped at the bottom
  ungrouped.forEach((item, i) => elements.push(renderItem(item, i)));

  return elements;
}

export default function BalanceSheetProfessional({ range, businessUnit }: Props) {
  const { t } = useLanguage();
  const toDate = format(range.to, "yyyy-MM-dd");

  // ═══ DATA FETCHING ═══

  const { data: cashInHandData } = useQuery({
    queryKey: ["bs-cash"],
    queryFn: () => calculateCashInHand(),
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: bankData } = useQuery({
    queryKey: ["bs-banks"],
    queryFn: () => calculateBankBalances(),
    staleTime: 0,
    refetchOnMount: true,
  });

  // ALL customers
  const { data: customerAccounts } = useQuery({
    queryKey: ["bs-ledger-customers", businessUnit],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, account_type")
        .eq("account_category", "customer")
        .order("name");
      let invQuery = supabase
        .from("invoices")
        .select("contact_id, balance_due, total, amount_paid, invoice_number, invoice_date")
        .eq("invoice_type", "sale")
        .order("invoice_date", { ascending: false });
      if (businessUnit) invQuery = invQuery.eq("business_unit", businessUnit);
      const { data: invoices } = await invQuery;
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id, invoice_id")
        .order("payment_date", { ascending: false });

      const invMap = new Map<string, any[]>();
      for (const inv of invoices || []) {
        if (!invMap.has(inv.contact_id)) invMap.set(inv.contact_id, []);
        invMap.get(inv.contact_id)!.push(inv);
      }
      const directVoucherMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (!p.invoice_id && p.contact_id) {
          if (!directVoucherMap.has(p.contact_id)) directVoucherMap.set(p.contact_id, []);
          directVoucherMap.get(p.contact_id)!.push(p);
        }
      }

      return (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const invs = invMap.get(c.id) || [];
        const invoiceBalanceDue = invs.reduce((s: number, i: any) => s + Number(i.balance_due || 0), 0);
        const directVouchers = directVoucherMap.get(c.id) || [];
        const receiptVoucherTotal = directVouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const paymentVoucherTotal = directVouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const closingBalance = opening + invoiceBalanceDue - receiptVoucherTotal + paymentVoucherTotal;
        return { id: c.id, name: c.name, account_type: c.account_type, opening, invoices: invs, directVouchers, invoiceBalanceDue, receiptVoucherTotal, paymentVoucherTotal, closingBalance };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // ALL employees
  const { data: employeeAccounts } = useQuery({
    queryKey: ["bs-ledger-employees"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, account_type")
        .eq("account_category", "employee")
        .order("name");
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id")
        .order("payment_date", { ascending: false });
      const vMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (p.contact_id) {
          if (!vMap.has(p.contact_id)) vMap.set(p.contact_id, []);
          vMap.get(p.contact_id)!.push(p);
        }
      }
      return (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const vouchers = vMap.get(c.id) || [];
        const paidTo = vouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const receivedFrom = vouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        return { id: c.id, name: c.name, account_type: c.account_type, opening, paidTo, receivedFrom, vouchers, closingBalance: opening + paidTo - receivedFrom };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Inventory (ALL products)
  const { data: inventoryProducts } = useQuery({
    queryKey: ["bs-ledger-inventory"],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_qty, default_price, avg_cost, unit_id")
        .order("name");
      const { data: units } = await supabase.from("units").select("id, name, kg_value");
      const unitMap = new Map(units?.map(u => [u.id, u]) || []);
      return (products || []).map(p => {
        const stockQty = Number(p.stock_qty);
        const avgCost = Number(p.avg_cost) || 0;
        const defaultPrice = Number(p.default_price) || 0;
        const unit = unitMap.get(p.unit_id || "");
        const kgValue = unit?.kg_value || 1;
        const unitName = unit?.name || "KG";
        const effectiveCost = avgCost > 0 ? avgCost : defaultPrice;
        const stockInUnit = kgValue > 0 ? stockQty / kgValue : stockQty;
        const value = Math.round(stockInUnit * effectiveCost);
        const costSource = avgCost > 0 ? "Purchases" : defaultPrice > 0 ? "Default" : "No Cost";
        return { id: p.id, name: p.name, stockQty, stockInUnit, unitName, avgCost: effectiveCost, value, costSource };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // ALL suppliers
  const { data: supplierAccounts } = useQuery({
    queryKey: ["bs-ledger-suppliers", businessUnit],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, account_type")
        .eq("account_category", "supplier")
        .order("name");
      let invQuery = supabase
        .from("invoices")
        .select("contact_id, balance_due, total, amount_paid, invoice_number, invoice_date")
        .eq("invoice_type", "purchase")
        .order("invoice_date", { ascending: false });
      if (businessUnit) invQuery = invQuery.eq("business_unit", businessUnit);
      const { data: invoices } = await invQuery;
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id, invoice_id")
        .order("payment_date", { ascending: false });

      const invMap = new Map<string, any[]>();
      for (const inv of invoices || []) {
        if (!invMap.has(inv.contact_id)) invMap.set(inv.contact_id, []);
        invMap.get(inv.contact_id)!.push(inv);
      }
      const directVoucherMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (!p.invoice_id && p.contact_id) {
          if (!directVoucherMap.has(p.contact_id)) directVoucherMap.set(p.contact_id, []);
          directVoucherMap.get(p.contact_id)!.push(p);
        }
      }

      return (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const invs = invMap.get(c.id) || [];
        const invoiceBalanceDue = invs.reduce((s: number, i: any) => s + Number(i.balance_due || 0), 0);
        const directVouchers = directVoucherMap.get(c.id) || [];
        const receiptVoucherTotal = directVouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const paymentVoucherTotal = directVouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        // opening is negative when you owe them (credit balance)
        // invoiceBalanceDue adds to what you owe (make more negative)
        // paymentVoucherTotal reduces what you owe (make less negative)
        // receiptVoucherTotal increases what you owe (make more negative)
        const closingBalance = opening - invoiceBalanceDue + paymentVoucherTotal - receiptVoucherTotal;
        return { id: c.id, name: c.name, account_type: c.account_type, opening, invoices: invs, directVouchers, invoiceBalanceDue, receiptVoucherTotal, paymentVoucherTotal, closingBalance };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Expense accounts (from contacts with account_category = 'expense', balances from vouchers)
  const { data: expenseAccounts } = useQuery({
    queryKey: ["bs-expense-accounts"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, sub_account, account_type")
        .eq("account_category", "expense")
        .order("name");
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, contact_id")
        .order("payment_date", { ascending: false });
      const vMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (p.contact_id) {
          if (!vMap.has(p.contact_id)) vMap.set(p.contact_id, []);
          vMap.get(p.contact_id)!.push(p);
        }
      }
      return (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const vouchers = vMap.get(c.id) || [];
        const paymentTotal = vouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const receiptTotal = vouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const balance = opening + paymentTotal - receiptTotal;
        return { id: c.id, name: c.name, sub_account: c.sub_account, account_type: c.account_type, balance };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Loan accounts (Liability) — opening + receipts − payments
  const { data: loanAccounts } = useQuery({
    queryKey: ["bs-loan-accounts"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, account_type")
        .eq("account_category", "loan")
        .order("name");
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id")
        .order("payment_date", { ascending: false });
      const vMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (p.contact_id) {
          if (!vMap.has(p.contact_id)) vMap.set(p.contact_id, []);
          vMap.get(p.contact_id)!.push(p);
        }
      }
      return (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const vouchers = vMap.get(c.id) || [];
        const receiptVoucherTotal = vouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const paymentVoucherTotal = vouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const closingBalance = opening + receiptVoucherTotal - paymentVoucherTotal;
        return { id: c.id, name: c.name, account_type: c.account_type, opening, vouchers, receiptVoucherTotal, paymentVoucherTotal, closingBalance };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fixed Asset accounts (Asset) — opening + purchase invoices + payment vouchers DR − receipt vouchers (disposals)
  const { data: fixedAssetAccounts } = useQuery({
    queryKey: ["bs-fixed-asset-accounts", businessUnit],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance, account_type")
        .eq("account_category", "fixed_asset")
        .order("name");
      let invQuery = supabase
        .from("invoices")
        .select("contact_id, total, invoice_number, invoice_date")
        .eq("invoice_type", "purchase")
        .order("invoice_date", { ascending: false });
      if (businessUnit) invQuery = invQuery.eq("business_unit", businessUnit);
      const { data: invoices } = await invQuery;
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id, invoice_id")
        .order("payment_date", { ascending: false });

      const invMap = new Map<string, any[]>();
      for (const inv of invoices || []) {
        if (!invMap.has(inv.contact_id)) invMap.set(inv.contact_id, []);
        invMap.get(inv.contact_id)!.push(inv);
      }
      const directVoucherMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (!p.invoice_id && p.contact_id) {
          if (!directVoucherMap.has(p.contact_id)) directVoucherMap.set(p.contact_id, []);
          directVoucherMap.get(p.contact_id)!.push(p);
        }
      }

      return (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const invs = invMap.get(c.id) || [];
        const purchaseInvoiceTotal = invs.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        const directVouchers = directVoucherMap.get(c.id) || [];
        const paymentVoucherTotal = directVouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const receiptVoucherTotal = directVouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const closingBalance = opening + purchaseInvoiceTotal + paymentVoucherTotal - receiptVoucherTotal;
        return { id: c.id, name: c.name, account_type: c.account_type, opening, invoices: invs, directVouchers, purchaseInvoiceTotal, paymentVoucherTotal, receiptVoucherTotal, closingBalance };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Category balances for cross-check
  const { data: catBalances } = useQuery({
    queryKey: ["bs-categories", toDate],
    queryFn: () => fetchCategoryBalances(toDate),
    staleTime: 0,
    refetchOnMount: true,
  });

  // Net Profit / (Loss) - now includes expense accounts from vouchers
  const { data: retainedEarningsData } = useQuery({
    queryKey: ["bs-retained-earnings"],
    queryFn: async () => {
      const { data: sales } = await supabase.from("invoices").select("total").eq("invoice_type", "sale");
      const { data: purchases } = await supabase.from("invoices").select("total").eq("invoice_type", "purchase");
      const { data: expenses } = await supabase.from("expenses").select("amount");
      // Also include expense accounts paid via vouchers
      const { data: expContacts } = await supabase.from("contacts").select("id, opening_balance").eq("account_category", "expense");
      const expContactIds = (expContacts || []).map(c => c.id);
      let expVoucherTotal = (expContacts || []).reduce((s, c) => s + Number(c.opening_balance || 0), 0);
      if (expContactIds.length > 0) {
        const { data: expPayments } = await supabase.from("payments").select("amount, voucher_type, contact_id").in("contact_id", expContactIds);
        for (const p of expPayments || []) {
          if (p.voucher_type === "payment") expVoucherTotal += Number(p.amount);
          if (p.voucher_type === "receipt") expVoucherTotal -= Number(p.amount);
        }
      }
      const salesTotal = sales?.reduce((s, i) => s + Number(i.total), 0) || 0;
      const purchasesTotal = purchases?.reduce((s, i) => s + Number(i.total), 0) || 0;
      const expensesTotal = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
      return salesTotal - purchasesTotal - expensesTotal - expVoucherTotal;
    },
    staleTime: 0,
    refetchOnMount: true,
  });


  // ═══ CALCULATIONS ═══

  const isLoading = !cashInHandData || !bankData || !customerAccounts || !supplierAccounts || !inventoryProducts || !employeeAccounts || !expenseAccounts || !loanAccounts || !fixedAssetAccounts || retainedEarningsData === undefined;
  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  // ASSETS
  const cashInHand = cashInHandData?.total || 0;
  const bankTotal = bankData?.reduce((s, b) => s + b.balance, 0) || 0;
  const customerTotal = customerAccounts.reduce((s, c) => s + c.closingBalance, 0);
  const employeeTotal = employeeAccounts.reduce((s, e) => s + e.closingBalance, 0);
  const inventoryTotal = inventoryProducts.reduce((s, p) => s + p.value, 0);
  const fixedAssetTotal = fixedAssetAccounts.reduce((s, f) => s + f.closingBalance, 0);
  const totalAssets = cashInHand + bankTotal + customerTotal + employeeTotal + inventoryTotal + fixedAssetTotal;

  // LIABILITIES
  const supplierTotal = supplierAccounts.reduce((s, c) => s + c.closingBalance, 0);
  const loanTotal = loanAccounts.reduce((s, l) => s + l.closingBalance, 0);
  const totalLiabilities = supplierTotal + loanTotal;

  // EQUITY
  const equity = retainedEarningsData || 0;
  const totalLiabilitiesAndEquity = supplierTotal + loanTotal + equity;

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

  // Expense accounts total
  const expenseTotal = expenseAccounts.reduce((s, e) => s + e.balance, 0);

  return (
    <div className="space-y-2">
      {/* Balance warning */}
      {!isBalanced && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-3 mb-2">
          <span className="text-destructive text-lg">⚠</span>
          <div>
            <p className="font-semibold text-destructive text-sm">Balance Sheet Not Balanced</p>
            <p className="text-xs text-muted-foreground">
              Assets: {fmt(totalAssets)} ≠ Liabilities + Equity: {fmt(totalLiabilitiesAndEquity)} (Diff: {fmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))})
            </p>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card shadow-sm">
        {/* ═══════════ ASSETS ═══════════ */}
        <SectionHeader title="ASSETS (Debit)" />
        <ColumnHeaders />

        {/* Cash Accounts */}
        <SubSectionHeader title="Cash Accounts" />
        <AccountLine name="Cash in Hand" debit={cashInHand} credit={0}>
          {cashInHandData && (
            <>
              <DetailLine label="Outstanding Balance" amount={cashInHandData.opening} />
              <DetailLine label="Cash Receipts (Vouchers)" amount={cashInHandData.cashReceipts} positive />
              <DetailLine label="Cash Payments (Vouchers)" amount={cashInHandData.cashPayments} positive={false} />
              <DetailLine label="Cash Expenses" amount={cashInHandData.cashExpenses} positive={false} />
              {cashInHandData.untrackedCashIn > 0 && (
                <DetailLine label="Direct Cash Sales (Untracked)" amount={cashInHandData.untrackedCashIn} positive />
              )}
              {cashInHandData.untrackedCashOut > 0 && (
                <DetailLine label="Direct Cash Purchases (Untracked)" amount={cashInHandData.untrackedCashOut} positive={false} />
              )}
            </>
          )}
        </AccountLine>

        <DottedLine />

        {/* Bank Accounts */}
        <SubSectionHeader title="Bank Accounts" />
        {bankData && bankData.length > 0 ? bankData.map(bank => (
          <AccountLine key={bank.id} name={bank.name} debit={bank.balance} credit={0}>
            <DetailLine label="Outstanding Balance" amount={bank.opening} />
            <DetailLine label="Receipts" amount={bank.receipts} positive />
            <DetailLine label="Payments" amount={bank.payments} positive={false} />
            <DetailLine label="Expenses" amount={bank.expenses} positive={false} />
          </AccountLine>
        )) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No bank accounts</div>
        )}

        <DottedLine />

        {/* Customer Receivables — grouped by account_type */}
        <SubSectionHeader title="Customer Receivables" />
        {customerAccounts.length > 0 ? renderGrouped(
          customerAccounts,
          (c) => (
            <AccountLine key={c.id} name={c.name} debit={c.closingBalance > 0 ? c.closingBalance : 0} credit={c.closingBalance < 0 ? Math.abs(c.closingBalance) : 0}>
              <DetailLine label="Outstanding Balance" amount={c.opening} />
              <DetailLine label={`Invoice Balance Due (${c.invoices.length})`} amount={c.invoiceBalanceDue} />
              {c.receiptVoucherTotal > 0 && <DetailLine label="Receipt Vouchers" amount={-c.receiptVoucherTotal} positive={false} />}
              {c.paymentVoucherTotal > 0 && <DetailLine label="Payment Vouchers" amount={c.paymentVoucherTotal} positive />}
              {c.invoices.length > 0 && (
                <div className="mt-1 pt-1 border-t border-border/20">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Invoices</span>
                  {c.invoices.map((inv: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px] text-muted-foreground py-0.5">
                      <span>{inv.invoice_number} ({inv.invoice_date})</span>
                      <span className="font-mono">Due: {fmt(Number(inv.balance_due))}</span>
                    </div>
                  ))}
                </div>
              )}
            </AccountLine>
          ),
          (c) => c.closingBalance > 0 ? c.closingBalance : 0,
          (c) => c.closingBalance < 0 ? Math.abs(c.closingBalance) : 0,
        ) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No customer accounts</div>
        )}

        <DottedLine />

        {/* Employee Receivables — grouped by account_type */}
        <SubSectionHeader title="Employee Receivables" />
        {employeeAccounts.length > 0 ? renderGrouped(
          employeeAccounts,
          (e) => (
            <AccountLine key={e.id} name={e.name} debit={e.closingBalance > 0 ? e.closingBalance : 0} credit={e.closingBalance < 0 ? Math.abs(e.closingBalance) : 0}>
              <DetailLine label="Outstanding Balance" amount={e.opening} />
              {e.paidTo > 0 && <DetailLine label="Payments To" amount={e.paidTo} positive />}
              {e.receivedFrom > 0 && <DetailLine label="Received From" amount={e.receivedFrom} positive={false} />}
            </AccountLine>
          ),
          (e) => e.closingBalance > 0 ? e.closingBalance : 0,
          (e) => e.closingBalance < 0 ? Math.abs(e.closingBalance) : 0,
        ) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No employee accounts</div>
        )}

        <DottedLine />

        {/* Inventory */}
        <SubSectionHeader title="Inventory" />
        {inventoryProducts.map(p => (
          <AccountLine
            key={p.id}
            name={p.name}
            debit={p.value}
            credit={0}
            badge={p.costSource !== "Purchases" ? p.costSource : undefined}
          >
            <DetailLine label={`Stock: ${p.stockInUnit.toFixed(3)} ${p.unitName}`} amount={0} />
            <DetailLine label={`Avg Cost: ${fmt(p.avgCost)} / ${p.unitName}`} amount={0} />
            <DetailLine label="Valuation" amount={p.value} />
          </AccountLine>
        ))}
        {inventoryProducts.length === 0 && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No inventory</div>
        )}

        <DottedLine />

        {/* Fixed Assets — grouped by account_type */}
        <SubSectionHeader title="Fixed Assets" />
        {fixedAssetAccounts.length > 0 ? renderGrouped(
          fixedAssetAccounts,
          (f) => (
            <AccountLine key={f.id} name={f.name} debit={f.closingBalance > 0 ? f.closingBalance : 0} credit={f.closingBalance < 0 ? Math.abs(f.closingBalance) : 0}>
              <DetailLine label="Outstanding Balance" amount={f.opening} />
              {f.purchaseInvoiceTotal > 0 && <DetailLine label={`Purchase Invoices (${f.invoices.length})`} amount={f.purchaseInvoiceTotal} positive />}
              {f.paymentVoucherTotal > 0 && <DetailLine label="Payment Vouchers (Acquisitions)" amount={f.paymentVoucherTotal} positive />}
              {f.receiptVoucherTotal > 0 && <DetailLine label="Receipt Vouchers (Disposals)" amount={-f.receiptVoucherTotal} positive={false} />}
              {f.invoices.length > 0 && (
                <div className="mt-1 pt-1 border-t border-border/20">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Invoices</span>
                  {f.invoices.map((inv: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px] text-muted-foreground py-0.5">
                      <span>{inv.invoice_number} ({inv.invoice_date})</span>
                      <span className="font-mono">{fmt(Number(inv.total))}</span>
                    </div>
                  ))}
                </div>
              )}
            </AccountLine>
          ),
          (f) => f.closingBalance > 0 ? f.closingBalance : 0,
          (f) => f.closingBalance < 0 ? Math.abs(f.closingBalance) : 0,
        ) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No fixed asset accounts</div>
        )}

        <TotalRow label="TOTAL ASSETS" debit={totalAssets} credit={0} double />

        {/* ═══════════ LIABILITIES ═══════════ */}
        <SectionHeader title="LIABILITIES (Credit)" />
        <ColumnHeaders />

        {/* Supplier Payables — grouped by account_type */}
        <SubSectionHeader title="Supplier Payables" />
        {supplierAccounts.length > 0 ? renderGrouped(
          supplierAccounts,
          (c) => (
            <AccountLine key={c.id} name={c.name} debit={c.closingBalance > 0 ? c.closingBalance : 0} credit={c.closingBalance < 0 ? Math.abs(c.closingBalance) : 0}>
              <DetailLine label="Outstanding Balance" amount={c.opening} />
              <DetailLine label={`Invoice Balance Due (${c.invoices.length})`} amount={c.invoiceBalanceDue} />
              {c.paymentVoucherTotal > 0 && <DetailLine label="Payment Vouchers" amount={-c.paymentVoucherTotal} positive={false} />}
              {c.receiptVoucherTotal > 0 && <DetailLine label="Receipt Vouchers" amount={c.receiptVoucherTotal} positive />}
              {c.invoices.length > 0 && (
                <div className="mt-1 pt-1 border-t border-border/20">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Invoices</span>
                  {c.invoices.map((inv: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px] text-muted-foreground py-0.5">
                      <span>{inv.invoice_number} ({inv.invoice_date})</span>
                      <span className="font-mono">Due: {fmt(Number(inv.balance_due))}</span>
                    </div>
                  ))}
                </div>
              )}
            </AccountLine>
          ),
          (c) => c.closingBalance > 0 ? c.closingBalance : 0,
          (c) => c.closingBalance < 0 ? Math.abs(c.closingBalance) : 0,
        ) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No supplier accounts</div>
        )}

        <DottedLine />

        {/* Loans — grouped by account_type */}
        <SubSectionHeader title="Loans" />
        {loanAccounts.length > 0 ? renderGrouped(
          loanAccounts,
          (l) => (
            <AccountLine key={l.id} name={l.name} debit={l.closingBalance < 0 ? Math.abs(l.closingBalance) : 0} credit={l.closingBalance > 0 ? l.closingBalance : 0}>
              <DetailLine label="Outstanding Balance" amount={l.opening} />
              {l.receiptVoucherTotal > 0 && <DetailLine label="Receipt Vouchers (Loan Received)" amount={l.receiptVoucherTotal} positive />}
              {l.paymentVoucherTotal > 0 && <DetailLine label="Payment Vouchers (Repayments)" amount={-l.paymentVoucherTotal} positive={false} />}
            </AccountLine>
          ),
          (l) => l.closingBalance < 0 ? Math.abs(l.closingBalance) : 0,
          (l) => l.closingBalance > 0 ? l.closingBalance : 0,
        ) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No loan accounts</div>
        )}

        <TotalRow label="TOTAL LIABILITIES" debit={0} credit={totalLiabilities} />

        {/* ═══════════ EQUITY ═══════════ */}
        <SectionHeader title="EQUITY (Credit)" />
        <ColumnHeaders />

        {/* Expense Accounts — informational only, already deducted in Net Profit */}
        {expenseAccounts.length > 0 && (
          <>
            <SubSectionHeader title="Expenses charged against profit" />
            {(() => {
              const grouped = new Map<string, typeof expenseAccounts>();
              const ungrouped: typeof expenseAccounts = [];
              for (const exp of expenseAccounts) {
                const grp = exp.sub_account || "";
                if (grp) {
                  if (!grouped.has(grp)) grouped.set(grp, []);
                  grouped.get(grp)!.push(exp);
                } else {
                  ungrouped.push(exp);
                }
              }
              const elements: React.ReactNode[] = [];
              for (const [groupName, items] of grouped) {
                elements.push(<GroupHeader key={`eg-${groupName}`} title={groupName} />);
                items.forEach(exp => elements.push(
                  <AccountLine key={exp.id} name={exp.name} debit={exp.balance} credit={0} />
                ));
                const groupTotal = items.reduce((s, e) => s + e.balance, 0);
                elements.push(<GroupSubtotal key={`egs-${groupName}`} label={`${groupName} Subtotal`} debit={groupTotal} credit={0} />);
              }
              ungrouped.forEach(exp => elements.push(
                <AccountLine key={exp.id} name={exp.name} debit={exp.balance} credit={0} />
              ));
              return elements;
            })()}
            {expenseTotal !== 0 && <GroupSubtotal label="Total Expenses (already in Net Profit)" debit={expenseTotal > 0 ? expenseTotal : 0} credit={expenseTotal < 0 ? Math.abs(expenseTotal) : 0} />}
          </>
        )}

        <DottedLine />
        <AccountLine
          name="Net Profit / (Loss)"
          debit={(retainedEarningsData || 0) < 0 ? Math.abs(retainedEarningsData || 0) : 0}
          credit={(retainedEarningsData || 0) > 0 ? (retainedEarningsData || 0) : 0}
        />

        <TotalRow
          label="TOTAL LIABILITIES & EQUITY"
          debit={totalLiabilitiesAndEquity < 0 ? Math.abs(totalLiabilitiesAndEquity) : 0}
          credit={totalLiabilitiesAndEquity > 0 ? totalLiabilitiesAndEquity : 0}
          double
        />

        {/* ═══════════ FINAL ═══════════ */}
        <div className="bg-muted/40 rounded-b-lg px-3 py-3 mt-2">
          <div className="grid grid-cols-[1fr_120px_120px] gap-2 items-baseline">
            <span className="font-bold text-sm">Verification</span>
            <span className="font-mono font-bold text-xs text-right">Total Assets: {fmt(totalAssets)}</span>
            <span className="font-mono font-bold text-xs text-right">Total L+E: {fmt(totalLiabilitiesAndEquity)}</span>
          </div>
          <div className="flex justify-end mt-1">
            <span className={`font-mono text-xs ${isBalanced ? "text-green-600" : "text-destructive"}`}>
              {isBalanced ? "✓ Balanced" : `Difference: ${fmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}