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

/* ── Total row ── */
function TotalRow({ label, value, double }: { label: string; value: number; double?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline px-3 py-2 mt-2 ${double ? "border-t-4 border-double border-foreground/30" : "border-t-2 border-foreground/20"}`}>
      <span className="font-bold text-sm">{label}</span>
      <span className={`font-mono font-bold text-sm tabular-nums ${value < 0 ? "text-destructive" : ""}`}>{fmt(value)}</span>
    </div>
  );
}

/* ── Separator line ── */
function DottedLine() {
  return <div className="border-t border-dashed border-border/40 mx-3 my-1" />;
}

export default function BalanceSheetProfessional({ range, businessUnit }: Props) {
  const { t } = useLanguage();
  const toDate = format(range.to, "yyyy-MM-dd");

  // ═══ DATA FETCHING ═══

  // (Cash contacts query removed — already included in calculateCashInHand)

  // Computed cash in hand (for the calculated cash account balance)
  const { data: cashInHandData } = useQuery({
    queryKey: ["bs-cash"],
    queryFn: () => calculateCashInHand(),
    staleTime: 0,
    refetchOnMount: true,
  });

  // Bank accounts
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
        .select("id, name, opening_balance")
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
        return { id: c.id, name: c.name, opening, invoices: invs, directVouchers, invoiceBalanceDue, receiptVoucherTotal, paymentVoucherTotal, closingBalance };
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
        .select("id, name, opening_balance")
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
        return { name: c.name, opening, paidTo, receivedFrom, vouchers, closingBalance: opening + paidTo - receivedFrom };
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
        .select("id, name, opening_balance")
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
        const opening = Math.abs(Number(c.opening_balance || 0));
        const invs = invMap.get(c.id) || [];
        const invoiceBalanceDue = invs.reduce((s: number, i: any) => s + Number(i.balance_due || 0), 0);
        const directVouchers = directVoucherMap.get(c.id) || [];
        const receiptVoucherTotal = directVouchers.filter(v => v.voucher_type === "receipt").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const paymentVoucherTotal = directVouchers.filter(v => v.voucher_type === "payment").reduce((s: number, v: any) => s + Number(v.amount), 0);
        const closingBalance = opening + invoiceBalanceDue - paymentVoucherTotal + receiptVoucherTotal;
        return { id: c.id, name: c.name, opening, invoices: invs, directVouchers, invoiceBalanceDue, receiptVoucherTotal, paymentVoucherTotal, closingBalance };
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

  // Net Profit / (Loss)
  const { data: retainedEarningsData } = useQuery({
    queryKey: ["bs-retained-earnings"],
    queryFn: async () => {
      const { data: sales } = await supabase.from("invoices").select("total").eq("invoice_type", "sale");
      const { data: purchases } = await supabase.from("invoices").select("total").eq("invoice_type", "purchase");
      const { data: expenses } = await supabase.from("expenses").select("amount");
      const salesTotal = sales?.reduce((s, i) => s + Number(i.total), 0) || 0;
      const purchasesTotal = purchases?.reduce((s, i) => s + Number(i.total), 0) || 0;
      const expensesTotal = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
      return salesTotal - purchasesTotal - expensesTotal;
    },
    staleTime: 0,
    refetchOnMount: true,
  });


  // ═══ CALCULATIONS ═══

  const isLoading = !cashInHandData || !bankData || !customerAccounts || !supplierAccounts || !inventoryProducts || !employeeAccounts || retainedEarningsData === undefined;
  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  // ASSETS
  const cashInHand = cashInHandData?.total || 0;
  const bankTotal = bankData?.reduce((s, b) => s + b.balance, 0) || 0;
  const customerTotal = customerAccounts.reduce((s, c) => s + c.closingBalance, 0);
  const employeeTotal = employeeAccounts.reduce((s, e) => s + e.closingBalance, 0);
  const inventoryTotal = inventoryProducts.reduce((s, p) => s + p.value, 0);
  const totalAssets = cashInHand + bankTotal + customerTotal + employeeTotal + inventoryTotal;

  // LIABILITIES
  const supplierTotal = supplierAccounts.reduce((s, c) => s + c.closingBalance, 0);
  const totalLiabilities = supplierTotal;

  const isBalanced = Math.abs(totalAssets - totalLiabilities) < 1;

  return (
    <div className="space-y-2">
      {/* Balance warning */}
      {!isBalanced && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-3 mb-2">
          <span className="text-destructive text-lg">⚠</span>
          <div>
            <p className="font-semibold text-destructive text-sm">Balance Sheet Not Balanced</p>
            <p className="text-xs text-muted-foreground">
              Assets: {fmt(totalAssets)} ≠ Liabilities: {fmt(totalLiabilities)} (Diff: {fmt(Math.abs(totalAssets - totalLiabilities))})
            </p>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card shadow-sm">
        {/* ═══════════ ASSETS ═══════════ */}
        <SectionHeader title="ASSETS (Debit)" />

        {/* Cash Accounts */}
        <SubSectionHeader title="Cash Accounts" />
        <AccountLine name="Cash in Hand" balance={cashInHand}>
          {cashInHandData && (
            <>
              <DetailLine label="Outstanding Balance" amount={cashInHandData.opening} />
              <DetailLine label="Cash Receipts (Vouchers)" amount={cashInHandData.cashReceipts} positive />
              <DetailLine label="Cash Payments (Vouchers)" amount={cashInHandData.cashPayments} positive={false} />
              <DetailLine label="Cash Expenses" amount={cashInHandData.cashExpenses} positive={false} />
            </>
          )}
        </AccountLine>

        <DottedLine />

        {/* Bank Accounts */}
        <SubSectionHeader title="Bank Accounts" />
        {bankData && bankData.length > 0 ? bankData.map(bank => (
          <AccountLine key={bank.id} name={bank.name} balance={bank.balance}>
            <DetailLine label="Outstanding Balance" amount={bank.opening} />
            <DetailLine label="Receipts" amount={bank.receipts} positive />
            <DetailLine label="Payments" amount={bank.payments} positive={false} />
            <DetailLine label="Expenses" amount={bank.expenses} positive={false} />
          </AccountLine>
        )) : (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No bank accounts</div>
        )}

        <DottedLine />

        {/* Customer Receivables - each customer individually */}
        <SubSectionHeader title="Customer Receivables" />
        {customerAccounts.map(c => (
          <AccountLine key={c.id} name={c.name} balance={c.closingBalance}>
            <DetailLine label="Outstanding Balance" amount={c.opening} />
            <DetailLine label={`Invoice Balance Due (${c.invoices.length})`} amount={c.invoiceBalanceDue} />
            {c.receiptVoucherTotal > 0 && <DetailLine label={`Receipt Vouchers`} amount={-c.receiptVoucherTotal} positive={false} />}
            {c.paymentVoucherTotal > 0 && <DetailLine label={`Payment Vouchers`} amount={c.paymentVoucherTotal} positive />}
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
        ))}
        {customerAccounts.length === 0 && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No customer accounts</div>
        )}

        <DottedLine />

        {/* Employee Receivables */}
        <SubSectionHeader title="Employee Receivables" />
        {employeeAccounts.map((e, i) => (
          <AccountLine key={i} name={e.name} balance={e.closingBalance}>
            <DetailLine label="Outstanding Balance" amount={e.opening} />
            {e.paidTo > 0 && <DetailLine label="Payments To" amount={e.paidTo} positive />}
            {e.receivedFrom > 0 && <DetailLine label="Received From" amount={e.receivedFrom} positive={false} />}
          </AccountLine>
        ))}
        {employeeAccounts.length === 0 && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No employee accounts</div>
        )}

        <DottedLine />

        {/* Inventory */}
        <SubSectionHeader title="Inventory" />
        {inventoryProducts.map(p => (
          <AccountLine
            key={p.id}
            name={p.name}
            balance={p.value}
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

        <TotalRow label="TOTAL ASSETS" value={totalAssets} double />

        {/* ═══════════ LIABILITIES ═══════════ */}
        <SectionHeader title="LIABILITIES (Credit)" />

        <SubSectionHeader title="Supplier Payables" />
        {supplierAccounts.map(c => (
          <AccountLine key={c.id} name={c.name} balance={c.closingBalance}>
            <DetailLine label="Outstanding Balance" amount={c.opening} />
            <DetailLine label={`Invoice Balance Due (${c.invoices.length})`} amount={c.invoiceBalanceDue} />
            {c.paymentVoucherTotal > 0 && <DetailLine label={`Payment Vouchers`} amount={-c.paymentVoucherTotal} positive={false} />}
            {c.receiptVoucherTotal > 0 && <DetailLine label={`Receipt Vouchers`} amount={c.receiptVoucherTotal} positive />}
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
        ))}
        {supplierAccounts.length === 0 && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground">No supplier accounts</div>
        )}

        <DottedLine />
        <AccountLine name="Net Profit / (Loss)" balance={retainedEarningsData || 0} />

        <TotalRow label="TOTAL LIABILITIES" value={totalLiabilities} />

        {/* ═══════════ FINAL ═══════════ */}
        <div className="bg-muted/40 rounded-b-lg px-3 py-3 mt-2">
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-sm">TOTAL LIABILITIES</span>
            <span className="font-mono font-bold text-sm tabular-nums">{fmt(totalLiabilities)}</span>
          </div>
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-xs text-muted-foreground">Verification: Assets − Liabilities</span>
            <span className={`font-mono text-xs ${isBalanced ? "text-green-600" : "text-destructive"}`}>
              {isBalanced ? "✓ Balanced" : fmt(totalAssets - totalLiabilities)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
