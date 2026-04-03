import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtQty } from "@/lib/utils";
import {
  fetchCategoryBalances,
  calculateInventoryValue,
  calculateCashInHand,
  calculateBankBalances,
  calculateReceivables,
  calculatePayables,
} from "@/lib/financial-utils";
import type { BankBalance } from "@/lib/financial-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  bsFmt,
  BSLineItem,
  BSCollapsibleItem,
  BSSubLine,
  BSSectionHeader,
  BSTotalRow,
} from "./FinancialReports";
import { format } from "date-fns";
import type { DateRange } from "./DateRangePicker";

interface Props {
  range: DateRange;
}

/* ── Small helper: a detail transaction line ── */
function TxLine({ label, amount, positive }: { label: string; amount: number; positive?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-0.5 pl-2">
      <span className="text-[11px] text-muted-foreground truncate max-w-[70%]">{label}</span>
      <span className={`font-mono text-[11px] tabular-nums ${positive ? "text-green-600" : "text-destructive"}`}>
        {positive ? "+" : "-"}{bsFmt(Math.abs(amount))}
      </span>
    </div>
  );
}

function TxSection({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  const [expanded, setExpanded] = useState(false);
  if (count === 0) return null;
  return (
    <div className="mt-2 border-t border-border/20 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-muted-foreground mb-1 hover:text-foreground transition-colors flex items-center gap-1"
      >
        <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
        {title} ({count})
      </button>
      {expanded && children}
    </div>
  );
}

export default function BalanceSheetProfessional({ range }: Props) {
  const { t } = useLanguage();
  const toDate = format(range.to, "yyyy-MM-dd");

  // ── Core data ──
  const { data: cashData, isLoading: lCash } = useQuery({
    queryKey: ["bs-cash"],
    queryFn: () => calculateCashInHand(),
  });
  const { data: bankData, isLoading: lBank } = useQuery({
    queryKey: ["bs-banks"],
    queryFn: () => calculateBankBalances(),
  });
  const { data: recvData, isLoading: lRecv } = useQuery({
    queryKey: ["bs-receivables"],
    queryFn: () => calculateReceivables(),
  });
  const { data: payData, isLoading: lPay } = useQuery({
    queryKey: ["bs-payables"],
    queryFn: () => calculatePayables(),
  });
  const { data: inventoryData, isLoading: lInv } = useQuery({
    queryKey: ["bs-inventory-all"],
    queryFn: async () => {
      // Fetch ALL products (including zero stock) for professional view
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_qty, default_price, avg_cost, unit_id")
        .order("name");
      const { data: units } = await supabase.from("units").select("id, name, kg_value");
      const unitMap = new Map(units?.map(u => [u.id, u]) || []);

      let totalValue = 0;
      let hasValuationGap = false;
      const items = (products || []).map(p => {
        const stockQty = Number(p.stock_qty);
        const avgCost = Number(p.avg_cost) || 0;
        const defaultPrice = Number(p.default_price) || 0;
        const unit = unitMap.get(p.unit_id || "");
        const kgValue = unit?.kg_value || 1;
        const unitName = unit?.name || "KG";
        const effectiveCost = avgCost > 0 ? avgCost : defaultPrice;
        const stockInUnit = kgValue > 0 ? stockQty / kgValue : stockQty;
        const value = stockInUnit * effectiveCost;
        const costSource = avgCost > 0 ? "purchase" : defaultPrice > 0 ? "default" : "missing";
        if (costSource === "missing" && stockQty > 0) hasValuationGap = true;
        totalValue += value;
        return { id: p.id, name: p.name, stockQty, stockInUnit, unitName, avgCost: effectiveCost, value: Math.round(value), costSource };
      });
      return { totalValue: Math.round(totalValue), hasValuationGap, items };
    },
  });
  const { data: catBalances, isLoading: lCat } = useQuery({
    queryKey: ["bs-categories", toDate],
    queryFn: () => fetchCategoryBalances(toDate),
  });

  // ── Lazy drill-down data ──

  // Customers with ALL invoices + payments
  const [showCustomers, setShowCustomers] = useState(false);
  const { data: customerList } = useQuery({
    queryKey: ["bs-pro-customers-full"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "customer");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, balance_due, total, amount_paid, invoice_number, invoice_date")
        .eq("invoice_type", "sale")
        .order("invoice_date", { ascending: false });
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id, invoice_id")
        .order("payment_date", { ascending: false });

      const invMap = new Map<string, any[]>();
      for (const inv of invoices || []) {
        if (!invMap.has(inv.contact_id)) invMap.set(inv.contact_id, []);
        invMap.get(inv.contact_id)!.push(inv);
      }
      // Direct vouchers per contact
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
        const directVoucherTotal = directVouchers.reduce((s: number, v: any) => s + Number(v.amount || 0), 0);
        const total = opening + invoiceBalanceDue;
        return { id: c.id, name: c.name, opening, invoices: invs, invoiceBalanceDue, directVouchers, directVoucherTotal, total };
      }).sort((a, b) => b.total - a.total);
    },
    enabled: showCustomers,
  });

  // Suppliers with ALL invoices + payments
  const [showSuppliers, setShowSuppliers] = useState(false);
  const { data: supplierList } = useQuery({
    queryKey: ["bs-pro-suppliers-full"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "supplier");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, balance_due, total, amount_paid, invoice_number, invoice_date")
        .eq("invoice_type", "purchase")
        .order("invoice_date", { ascending: false });
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
        const directVoucherTotal = directVouchers.reduce((s: number, v: any) => s + Number(v.amount || 0), 0);
        const total = opening + invoiceBalanceDue;
        return { id: c.id, name: c.name, opening, invoices: invs, invoiceBalanceDue, directVouchers, directVoucherTotal, total };
      }).sort((a, b) => b.total - a.total);
    },
    enabled: showSuppliers,
  });

  // Employees - ALL (including zero balance)
  const [showEmployees, setShowEmployees] = useState(false);
  const { data: employeeList } = useQuery({
    queryKey: ["bs-pro-employees-full"],
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
      const voucherMap = new Map<string, any[]>();
      for (const p of payments || []) {
        if (p.contact_id) {
          if (!voucherMap.has(p.contact_id)) voucherMap.set(p.contact_id, []);
          voucherMap.get(p.contact_id)!.push(p);
        }
      }
      return (contacts || []).map(c => ({
        id: c.id,
        name: c.name,
        opening: Number(c.opening_balance || 0),
        vouchers: voucherMap.get(c.id) || [],
      }));
    },
    enabled: showEmployees,
  });

  // Capital/Closing accounts - ALL
  const [showCapital, setShowCapital] = useState(false);
  const { data: capitalList } = useQuery({
    queryKey: ["bs-pro-capital-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "closing")
        .order("name");
      return (data || []).map(c => ({ name: c.name, balance: Number(c.opening_balance || 0) }));
    },
    enabled: showCapital,
  });

  // Bank vouchers + expenses (lazy)
  const [showBankDetail, setShowBankDetail] = useState(false);
  const { data: bankVouchers } = useQuery({
    queryKey: ["bs-pro-bank-vouchers-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, bank_contact_id, contact_id, contacts!payments_contact_id_fkey(name)")
        .eq("payment_method", "bank")
        .order("payment_date", { ascending: false });
      return data || [];
    },
    enabled: showBankDetail,
  });
  const { data: bankExpensesList } = useQuery({
    queryKey: ["bs-pro-bank-expenses-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, expense_date, notes, bank_contact_id, expense_categories(name)")
        .eq("payment_method", "bank")
        .order("expense_date", { ascending: false });
      return data || [];
    },
    enabled: showBankDetail,
  });

  // Cash vouchers + expenses (lazy)
  const [showCashDetail, setShowCashDetail] = useState(false);
  const { data: cashVouchers } = useQuery({
    queryKey: ["bs-pro-cash-vouchers-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, voucher_type, voucher_number, payment_date, contact_id, contacts!payments_contact_id_fkey(name)")
        .eq("payment_method", "cash")
        .order("payment_date", { ascending: false });
      return data || [];
    },
    enabled: showCashDetail,
  });
  const { data: cashExpensesList } = useQuery({
    queryKey: ["bs-pro-cash-expenses-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, expense_date, notes, expense_categories(name)")
        .eq("payment_method", "cash")
        .order("expense_date", { ascending: false });
      return data || [];
    },
    enabled: showCashDetail,
  });

  const isLoading = lCash || lBank || lRecv || lPay || lInv || lCat;
  if (isLoading) return <div className="text-muted-foreground p-8 text-center">{t("common.loading")}</div>;

  const bal = catBalances || { cashBalance: 0, bankBalance: 0, customerReceivables: 0, supplierPayables: 0, employeeReceivables: 0, capitalEquity: 0 };

  const cashInHand = cashData?.total || 0;
  const bankTotal = bankData?.reduce((s, b) => s + b.balance, 0) || 0;
  const customerReceivables = recvData?.total || 0;
  const employeeReceivables = bal.employeeReceivables;
  const inventoryValue = inventoryData?.totalValue || 0;
  const totalAssets = cashInHand + bankTotal + customerReceivables + employeeReceivables + inventoryValue;

  const supplierPayables = payData?.total || 0;
  const totalLiabilities = supplierPayables;

  const capitalEquity = bal.capitalEquity;
  const retainedEarnings = totalAssets - totalLiabilities - capitalEquity;
  const totalEquity = capitalEquity + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

  const invProducts = inventoryData?.items || [];
  const cashReceipts = cashVouchers?.filter(v => v.voucher_type === "receipt") || [];
  const cashPaymentsList = cashVouchers?.filter(v => v.voucher_type === "payment") || [];

  return (
    <>
      {!isBalanced && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <span className="text-destructive text-lg">⚠</span>
          <div>
            <p className="font-semibold text-destructive text-sm">Balance Sheet Not Balanced</p>
            <p className="text-xs text-muted-foreground">
              Assets: {bsFmt(totalAssets)} ≠ Liabilities + Equity: {bsFmt(totalLiabilitiesAndEquity)}
              {" "}(Difference: {bsFmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))})
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ═══ LEFT: ASSETS (Debit) ═══ */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 bg-primary/5 rounded-t-lg border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-chart-2" />
              {t("reports.assets")} <span className="text-sm text-muted-foreground font-normal">(Debit)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-6 space-y-1 px-5">
            <BSSectionHeader title={t("reports.currentAssets") || "Current Assets"} />

            {/* ── Cash in Hand ── */}
            <BSCollapsibleItem
              label={t("reports.cashInHand")}
              value={cashInHand}
              defaultOpen
              onOpen={() => setShowCashDetail(true)}
            >
              {cashData && (
                <>
                  <BSSubLine label={t("contacts.openingBalance")} value={cashData.opening} sign="+" />
                  <BSSubLine label={t("reports.received") + " (vouchers)"} value={cashData.cashReceipts} sign="+" />
                  {cashData.untrackedSaleCash > 0 && (
                    <BSSubLine label={t("reports.received") + " (initial)"} value={cashData.untrackedSaleCash} sign="+" />
                  )}
                  <BSSubLine label={t("reports.paid") + " (vouchers)"} value={cashData.cashPayments} sign="-" />
                  {cashData.untrackedPurchaseCash > 0 && (
                    <BSSubLine label={t("reports.paid") + " (initial)"} value={cashData.untrackedPurchaseCash} sign="-" />
                  )}
                  <BSSubLine label={t("nav.expenses")} value={cashData.cashExpenses} sign="-" />
                </>
              )}

              <TxSection title="Receipt Vouchers" count={cashReceipts.length}>
                {cashReceipts.map((v, i) => (
                  <TxLine key={i} label={`${v.voucher_number} — ${(v.contacts as any)?.name || "—"} (${v.payment_date})`} amount={Number(v.amount)} positive />
                ))}
              </TxSection>

              <TxSection title="Payment Vouchers" count={cashPaymentsList.length}>
                {cashPaymentsList.map((v, i) => (
                  <TxLine key={i} label={`${v.voucher_number} — ${(v.contacts as any)?.name || "—"} (${v.payment_date})`} amount={Number(v.amount)} />
                ))}
              </TxSection>

              <TxSection title="Cash Expenses" count={cashExpensesList?.length || 0}>
                {(cashExpensesList || []).map((e, i) => (
                  <TxLine key={i} label={`${(e.expense_categories as any)?.name || "Uncategorized"} — ${e.expense_date}${e.notes ? ` (${e.notes})` : ""}`} amount={Number(e.amount)} />
                ))}
              </TxSection>
            </BSCollapsibleItem>

            {/* ── Bank Accounts ── */}
            <BSCollapsibleItem
              label={t("reports.bankAccounts")}
              value={bankTotal}
              defaultOpen
              onOpen={() => setShowBankDetail(true)}
            >
              {bankData && bankData.length > 0 ? bankData.map((bank: BankBalance) => {
                const bReceipts = bankVouchers?.filter(v => v.bank_contact_id === bank.id && v.voucher_type === "receipt") || [];
                const bPayments = bankVouchers?.filter(v => v.bank_contact_id === bank.id && v.voucher_type === "payment") || [];
                const bExpenses = bankExpensesList?.filter(e => e.bank_contact_id === bank.id) || [];

                return (
                  <div key={bank.id} className="mb-3 pb-2 border-b border-border/10 last:border-b-0">
                    <div className="flex justify-between items-baseline py-1">
                      <span className="text-sm font-semibold">{bank.name}</span>
                      <span className="font-mono text-sm font-semibold tabular-nums">{bsFmt(bank.balance)}</span>
                    </div>
                    <div className="pl-3 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between"><span>Opening</span><span>{bsFmt(bank.opening)}</span></div>
                      <div className="flex justify-between"><span>+ Receipts</span><span>{bsFmt(bank.receipts)}</span></div>
                      <div className="flex justify-between"><span>- Payments</span><span>{bsFmt(bank.payments)}</span></div>
                      <div className="flex justify-between"><span>- Expenses</span><span>{bsFmt(bank.expenses)}</span></div>
                    </div>

                    <TxSection title="Receipts" count={bReceipts.length}>
                      {bReceipts.map((v, i) => (
                        <TxLine key={i} label={`${v.voucher_number} — ${(v.contacts as any)?.name || "—"} (${v.payment_date})`} amount={Number(v.amount)} positive />
                      ))}
                    </TxSection>
                    <TxSection title="Payments" count={bPayments.length}>
                      {bPayments.map((v, i) => (
                        <TxLine key={i} label={`${v.voucher_number} — ${(v.contacts as any)?.name || "—"} (${v.payment_date})`} amount={Number(v.amount)} />
                      ))}
                    </TxSection>
                    <TxSection title="Expenses" count={bExpenses.length}>
                      {bExpenses.map((e, i) => (
                        <TxLine key={i} label={`${(e.expense_categories as any)?.name || "Uncategorized"} — ${e.expense_date}${e.notes ? ` (${e.notes})` : ""}`} amount={Number(e.amount)} />
                      ))}
                    </TxSection>
                  </div>
                );
              }) : (
                <p className="text-xs text-muted-foreground py-1">No bank accounts</p>
              )}
            </BSCollapsibleItem>

            {/* ── Customer Receivables ── */}
            <BSCollapsibleItem
              label={t("reports.customerReceivables")}
              value={customerReceivables}
              defaultOpen
              onOpen={() => setShowCustomers(true)}
            >
              {recvData && (
                <>
                  <BSSubLine label={t("contacts.openingBalance") + " (total)"} value={recvData.openingBalance} sign="+" />
                  <BSSubLine label="Invoice Balances (total)" value={recvData.invoiceBalance} sign="+" />
                </>
              )}
              {customerList && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">All Customers ({customerList.length})</p>
                  {customerList.length === 0 && <p className="text-xs text-muted-foreground py-1">No customers</p>}
                  {customerList.map(c => (
                    <BSCollapsibleItem key={c.id} label={c.name} value={c.total}>
                      {c.opening !== 0 && <BSSubLine label="Opening Balance" value={c.opening} />}
                      {c.invoices.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Invoices ({c.invoices.length}):</p>
                          {c.invoices.map((inv: any, i: number) => (
                            <div key={i} className="flex justify-between items-baseline py-0.5 pl-2">
                              <span className="text-[11px] text-muted-foreground">
                                {inv.invoice_number} ({inv.invoice_date}) — Total: {bsFmt(Number(inv.total))}, Paid: {bsFmt(Number(inv.amount_paid))}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums">Due: {bsFmt(Number(inv.balance_due))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.directVouchers.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Direct Vouchers ({c.directVouchers.length}):</p>
                          {c.directVouchers.map((v: any, i: number) => (
                            <TxLine key={i} label={`${v.voucher_number} — ${v.payment_date} (${v.voucher_type})`} amount={Number(v.amount)} positive={v.voucher_type === "payment"} />
                          ))}
                        </div>
                      )}
                      {c.invoices.length === 0 && c.opening === 0 && (
                        <p className="text-xs text-muted-foreground py-1">No outstanding balance</p>
                      )}
                    </BSCollapsibleItem>
                  ))}
                </div>
              )}
            </BSCollapsibleItem>

            {/* ── Employee Receivables ── */}
            <BSCollapsibleItem
              label={t("reports.employeeReceivables")}
              value={employeeReceivables}
              defaultOpen
              onOpen={() => setShowEmployees(true)}
            >
              {employeeList ? (
                employeeList.length > 0 ? employeeList.map(e => (
                  <BSCollapsibleItem key={e.id} label={e.name} value={e.opening}>
                    <BSSubLine label="Opening Balance" value={e.opening} />
                    {e.vouchers.length > 0 && (
                      <div className="mt-1">
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Vouchers ({e.vouchers.length}):</p>
                        {e.vouchers.map((v: any, i: number) => (
                          <TxLine key={i} label={`${v.voucher_number} — ${v.payment_date} (${v.voucher_type})`} amount={Number(v.amount)} positive={v.voucher_type === "receipt"} />
                        ))}
                      </div>
                    )}
                  </BSCollapsibleItem>
                )) : (
                  <p className="text-xs text-muted-foreground py-1">No employees</p>
                )
              ) : (
                <BSSubLine label="Total" value={employeeReceivables} />
              )}
            </BSCollapsibleItem>

            <BSSectionHeader title={t("reports.inventoryValue") || "Inventory"} />

            {/* ── Inventory — ALL products ── */}
            <BSCollapsibleItem
              label={t("reports.inventoryValue")}
              value={inventoryValue}
              defaultOpen
            >
              {invProducts.length > 0 ? invProducts.map(p => (
                <div key={p.id} className="flex justify-between items-baseline py-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {p.name}
                    <span className="text-[10px]">
                      ({p.stockInUnit.toFixed(3)} {p.unitName} × {bsFmt(p.avgCost)})
                    </span>
                    {p.costSource === "default" && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-amber-500 text-amber-600">Default</Badge>}
                    {p.costSource === "missing" && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5">No Cost</Badge>}
                  </span>
                  <span className="font-mono text-xs tabular-nums">{bsFmt(p.value)}</span>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground py-1">No products</p>
              )}
            </BSCollapsibleItem>

            <BSTotalRow label={t("reports.totalAssets")} value={totalAssets} />
          </CardContent>
        </Card>

        {/* ═══ RIGHT: LIABILITIES + EQUITY (Credit) ═══ */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 bg-destructive/5 rounded-t-lg border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-destructive" />
              {t("reports.liabilities")} + {t("reports.capitalEquity")} <span className="text-sm text-muted-foreground font-normal">(Credit)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-6 space-y-1 px-5">
            <BSSectionHeader title={t("reports.currentLiabilities") || "Current Liabilities"} />

            {/* ── Supplier Payables ── */}
            <BSCollapsibleItem
              label={t("reports.supplierPayables")}
              value={supplierPayables}
              defaultOpen
              onOpen={() => setShowSuppliers(true)}
            >
              {payData && (
                <>
                  <BSSubLine label={t("contacts.openingBalance") + " (total)"} value={payData.openingBalance} sign="+" />
                  <BSSubLine label="Invoice Balances (total)" value={payData.invoiceBalance} sign="+" />
                </>
              )}
              {supplierList && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">All Suppliers ({supplierList.length})</p>
                  {supplierList.length === 0 && <p className="text-xs text-muted-foreground py-1">No suppliers</p>}
                  {supplierList.map(c => (
                    <BSCollapsibleItem key={c.id} label={c.name} value={c.total}>
                      {c.opening !== 0 && <BSSubLine label="Opening Balance" value={c.opening} />}
                      {c.invoices.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Invoices ({c.invoices.length}):</p>
                          {c.invoices.map((inv: any, i: number) => (
                            <div key={i} className="flex justify-between items-baseline py-0.5 pl-2">
                              <span className="text-[11px] text-muted-foreground">
                                {inv.invoice_number} ({inv.invoice_date}) — Total: {bsFmt(Number(inv.total))}, Paid: {bsFmt(Number(inv.amount_paid))}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums">Due: {bsFmt(Number(inv.balance_due))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.directVouchers.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Direct Vouchers ({c.directVouchers.length}):</p>
                          {c.directVouchers.map((v: any, i: number) => (
                            <TxLine key={i} label={`${v.voucher_number} — ${v.payment_date} (${v.voucher_type})`} amount={Number(v.amount)} positive={v.voucher_type === "receipt"} />
                          ))}
                        </div>
                      )}
                      {c.invoices.length === 0 && c.opening === 0 && (
                        <p className="text-xs text-muted-foreground py-1">No outstanding balance</p>
                      )}
                    </BSCollapsibleItem>
                  ))}
                </div>
              )}
            </BSCollapsibleItem>

            <div className="flex justify-between items-baseline py-2.5 mt-2 border-t border-border/50">
              <span className="font-semibold text-base pl-2">{t("reports.totalLiabilities") || "Total Liabilities"}</span>
              <span className="font-mono font-semibold text-base tabular-nums">{bsFmt(totalLiabilities)}</span>
            </div>

            <BSSectionHeader title={t("reports.capitalEquity") || "Equity / Capital"} />

            {/* ── Capital / Closing accounts ── */}
            <BSCollapsibleItem
              label={t("reports.closingAccounts")}
              value={capitalEquity}
              defaultOpen
              onOpen={() => setShowCapital(true)}
            >
              {capitalList ? (
                capitalList.length > 0 ? capitalList.map((c, i) => (
                  <BSSubLine key={i} label={c.name} value={c.balance} />
                )) : (
                  <p className="text-xs text-muted-foreground py-1">No capital accounts</p>
                )
              ) : (
                <BSSubLine label="Total" value={capitalEquity} />
              )}
            </BSCollapsibleItem>

            {/* ── Retained Earnings ── */}
            <BSCollapsibleItem label={t("reports.retainedEarnings")} value={retainedEarnings} defaultOpen>
              <BSSubLine label={t("reports.totalAssets")} value={totalAssets} />
              <BSSubLine label={t("reports.totalLiabilities") || "Total Liabilities"} value={totalLiabilities} sign="-" />
              <BSSubLine label={t("reports.closingAccounts") + " (Capital)"} value={capitalEquity} sign="-" />
              <div className="border-t border-border/30 mt-1 pt-1">
                <BSSubLine label="= Retained Earnings" value={retainedEarnings} />
              </div>
            </BSCollapsibleItem>

            <div className="flex justify-between items-baseline py-2.5 mt-2 border-t border-border/50">
              <span className="font-semibold text-base pl-2">{t("reports.capitalEquity")}</span>
              <span className={`font-mono font-semibold text-base tabular-nums ${totalEquity < 0 ? "text-destructive" : ""}`}>
                {bsFmt(totalEquity)}
              </span>
            </div>

            <BSTotalRow label={`${t("reports.totalLiabilities") || "Total Liabilities"} + ${t("reports.capitalEquity")}`} value={totalLiabilitiesAndEquity} />
          </CardContent>
        </Card>
      </div>

      {/* Balance confirmation footer */}
      <div className={`rounded-lg p-5 text-center text-base font-medium ${isBalanced ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}>
        {isBalanced
          ? `✓ Balance Sheet is balanced — Total Assets = Total Liabilities + Equity = ${bsFmt(totalAssets)}`
          : `✗ Balance Sheet is NOT balanced — Assets: ${bsFmt(totalAssets)} ≠ L+E: ${bsFmt(totalLiabilitiesAndEquity)}`
        }
      </div>
    </>
  );
}
