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

export default function BalanceSheetProfessional({ range }: Props) {
  const { t } = useLanguage();
  const toDate = format(range.to, "yyyy-MM-dd");

  // ── Core data (same queries as summary) ──
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
    queryKey: ["bs-inventory"],
    queryFn: () => calculateInventoryValue(),
  });
  const { data: catBalances, isLoading: lCat } = useQuery({
    queryKey: ["bs-categories", toDate],
    queryFn: () => fetchCategoryBalances(toDate),
  });

  // ── Detailed drill-downs (lazy) ──

  // All customers with balances
  const [showCustomers, setShowCustomers] = useState(false);
  const { data: customerList } = useQuery({
    queryKey: ["bs-pro-customers"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "customer");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, balance_due, invoice_number")
        .eq("invoice_type", "sale")
        .gt("balance_due", 0);
      const invMap = new Map<string, { balance_due: number; invoice_number: string }[]>();
      for (const inv of invoices || []) {
        if (!invMap.has(inv.contact_id)) invMap.set(inv.contact_id, []);
        invMap.get(inv.contact_id)!.push({ balance_due: Number(inv.balance_due), invoice_number: inv.invoice_number });
      }
      const result = (contacts || []).map(c => {
        const opening = Number(c.opening_balance || 0);
        const invs = invMap.get(c.id) || [];
        const invoiceTotal = invs.reduce((s, i) => s + i.balance_due, 0);
        return { id: c.id, name: c.name, opening, invoices: invs, invoiceTotal, total: opening + invoiceTotal };
      }).filter(c => Math.abs(c.total) > 0);
      result.sort((a, b) => b.total - a.total);
      return result;
    },
    enabled: showCustomers,
  });

  // All suppliers with balances
  const [showSuppliers, setShowSuppliers] = useState(false);
  const { data: supplierList } = useQuery({
    queryKey: ["bs-pro-suppliers"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, opening_balance")
        .eq("account_category", "supplier");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("contact_id, balance_due, invoice_number")
        .eq("invoice_type", "purchase")
        .gt("balance_due", 0);
      const invMap = new Map<string, { balance_due: number; invoice_number: string }[]>();
      for (const inv of invoices || []) {
        if (!invMap.has(inv.contact_id)) invMap.set(inv.contact_id, []);
        invMap.get(inv.contact_id)!.push({ balance_due: Number(inv.balance_due), invoice_number: inv.invoice_number });
      }
      const result = (contacts || []).map(c => {
        const opening = Math.abs(Number(c.opening_balance || 0));
        const invs = invMap.get(c.id) || [];
        const invoiceTotal = invs.reduce((s, i) => s + i.balance_due, 0);
        return { id: c.id, name: c.name, opening, invoices: invs, invoiceTotal, total: opening + invoiceTotal };
      }).filter(c => Math.abs(c.total) > 0);
      result.sort((a, b) => b.total - a.total);
      return result;
    },
    enabled: showSuppliers,
  });

  // Employee list
  const [showEmployees, setShowEmployees] = useState(false);
  const { data: employeeList } = useQuery({
    queryKey: ["bs-pro-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("name, opening_balance")
        .eq("account_category", "employee")
        .neq("opening_balance", 0)
        .order("opening_balance", { ascending: false });
      return data || [];
    },
    enabled: showEmployees,
  });

  // Capital accounts
  const [showCapital, setShowCapital] = useState(false);
  const { data: capitalList } = useQuery({
    queryKey: ["bs-pro-capital"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("name, opening_balance")
        .eq("account_category", "closing")
        .neq("opening_balance", 0)
        .order("opening_balance", { ascending: false });
      return data || [];
    },
    enabled: showCapital,
  });

  // Bank vouchers grouped by bank (lazy)
  const [showBankDetail, setShowBankDetail] = useState(false);
  const { data: bankVouchers } = useQuery({
    queryKey: ["bs-pro-bank-vouchers"],
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

  // Cash vouchers (lazy)
  const [showCashDetail, setShowCashDetail] = useState(false);
  const { data: cashVouchers } = useQuery({
    queryKey: ["bs-pro-cash-vouchers"],
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

  // Cash expenses (lazy)
  const { data: cashExpensesList } = useQuery({
    queryKey: ["bs-pro-cash-expenses"],
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

  const inventoryProducts = inventoryData?.products || [];

  // Cash voucher summaries
  const cashReceipts = cashVouchers?.filter(v => v.voucher_type === "receipt") || [];
  const cashPayments = cashVouchers?.filter(v => v.voucher_type === "payment") || [];

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

              {/* Detailed cash receipt vouchers */}
              {cashReceipts.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Receipt Vouchers ({cashReceipts.length})</p>
                  {cashReceipts.slice(0, 20).map((v, i) => (
                    <div key={i} className="flex justify-between items-baseline py-0.5">
                      <span className="text-xs text-muted-foreground">
                        {v.voucher_number} — {(v.contacts as any)?.name || "—"} ({v.payment_date})
                      </span>
                      <span className="font-mono text-xs tabular-nums text-green-600">+{bsFmt(Number(v.amount))}</span>
                    </div>
                  ))}
                  {cashReceipts.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-1">...and {cashReceipts.length - 20} more</p>
                  )}
                </div>
              )}

              {/* Detailed cash payment vouchers */}
              {cashPayments.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Payment Vouchers ({cashPayments.length})</p>
                  {cashPayments.slice(0, 20).map((v, i) => (
                    <div key={i} className="flex justify-between items-baseline py-0.5">
                      <span className="text-xs text-muted-foreground">
                        {v.voucher_number} — {(v.contacts as any)?.name || "—"} ({v.payment_date})
                      </span>
                      <span className="font-mono text-xs tabular-nums text-destructive">-{bsFmt(Number(v.amount))}</span>
                    </div>
                  ))}
                  {cashPayments.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-1">...and {cashPayments.length - 20} more</p>
                  )}
                </div>
              )}

              {/* Detailed cash expenses */}
              {cashExpensesList && cashExpensesList.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Cash Expenses ({cashExpensesList.length})</p>
                  {cashExpensesList.slice(0, 20).map((e, i) => (
                    <div key={i} className="flex justify-between items-baseline py-0.5">
                      <span className="text-xs text-muted-foreground">
                        {(e.expense_categories as any)?.name || "Uncategorized"} — {e.expense_date}
                        {e.notes ? ` (${e.notes})` : ""}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-destructive">-{bsFmt(Number(e.amount))}</span>
                    </div>
                  ))}
                  {cashExpensesList.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-1">...and {cashExpensesList.length - 20} more</p>
                  )}
                </div>
              )}
            </BSCollapsibleItem>

            {/* ── Bank Accounts — each bank individually ── */}
            {bankData && bankData.length > 0 && (
              <BSCollapsibleItem
                label={t("reports.bankAccounts")}
                value={bankTotal}
                defaultOpen
                onOpen={() => setShowBankDetail(true)}
              >
                {bankData.map((bank: BankBalance) => {
                  const bankReceipts = bankVouchers?.filter(v => v.bank_contact_id === bank.id && v.voucher_type === "receipt") || [];
                  const bankPaymentVouchers = bankVouchers?.filter(v => v.bank_contact_id === bank.id && v.voucher_type === "payment") || [];

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
                      {/* Individual bank vouchers */}
                      {bankReceipts.length > 0 && (
                        <div className="pl-3 mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground">Receipts:</p>
                          {bankReceipts.slice(0, 10).map((v, i) => (
                            <div key={i} className="flex justify-between items-baseline py-0.5 pl-2">
                              <span className="text-[11px] text-muted-foreground">{v.voucher_number} — {(v.contacts as any)?.name || "—"}</span>
                              <span className="font-mono text-[11px] tabular-nums text-green-600">+{bsFmt(Number(v.amount))}</span>
                            </div>
                          ))}
                          {bankReceipts.length > 10 && <p className="text-[10px] text-muted-foreground pl-2">+{bankReceipts.length - 10} more</p>}
                        </div>
                      )}
                      {bankPaymentVouchers.length > 0 && (
                        <div className="pl-3 mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground">Payments:</p>
                          {bankPaymentVouchers.slice(0, 10).map((v, i) => (
                            <div key={i} className="flex justify-between items-baseline py-0.5 pl-2">
                              <span className="text-[11px] text-muted-foreground">{v.voucher_number} — {(v.contacts as any)?.name || "—"}</span>
                              <span className="font-mono text-[11px] tabular-nums text-destructive">-{bsFmt(Number(v.amount))}</span>
                            </div>
                          ))}
                          {bankPaymentVouchers.length > 10 && <p className="text-[10px] text-muted-foreground pl-2">+{bankPaymentVouchers.length - 10} more</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </BSCollapsibleItem>
            )}
            {(!bankData || bankData.length === 0) && (
              <BSLineItem label={t("reports.bankAccounts")} value={0} indent />
            )}

            {/* ── Customer Receivables — every customer ── */}
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
              {customerList && customerList.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">All Customers ({customerList.length})</p>
                  {customerList.map((c) => (
                    <BSCollapsibleItem key={c.id} label={c.name} value={c.total}>
                      {c.opening !== 0 && <BSSubLine label="Opening Balance" value={c.opening} />}
                      {c.invoices.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Unpaid Invoices:</p>
                          {c.invoices.map((inv, i) => (
                            <div key={i} className="flex justify-between items-baseline py-0.5 pl-2">
                              <span className="text-[11px] text-muted-foreground">{inv.invoice_number}</span>
                              <span className="font-mono text-[11px] tabular-nums">{bsFmt(inv.balance_due)}</span>
                            </div>
                          ))}
                        </div>
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
              {employeeList && employeeList.length > 0 ? (
                employeeList.map((e, i) => (
                  <BSSubLine key={i} label={e.name} value={Number(e.opening_balance)} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-1">No employee balances</p>
              )}
            </BSCollapsibleItem>

            <BSSectionHeader title={t("reports.inventoryValue") || "Inventory"} />

            {/* ── Inventory — all products ── */}
            <BSCollapsibleItem
              label={`${t("reports.inventoryValue")}${inventoryData?.hasValuationGap ? " ⚠" : ""}${inventoryData?.hasOpeningStock ? " *" : ""}`}
              value={inventoryValue}
              defaultOpen
            >
              {inventoryProducts.map(p => (
                <div key={p.id} className="flex justify-between items-baseline py-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {p.name}
                    <span className="text-[10px]">({fmtQty(p.stockInUnit)} {p.unitName} × {bsFmt(p.avgCost)})</span>
                    {p.costSource === "default_price" && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-amber-500 text-amber-600">Default</Badge>}
                    {p.costSource === "missing" && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5">No Cost</Badge>}
                  </span>
                  <span className="font-mono text-xs tabular-nums">{bsFmt(p.inventoryValue)}</span>
                </div>
              ))}
              {inventoryProducts.length === 0 && (
                <p className="text-xs text-muted-foreground py-1">No inventory</p>
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

            {/* ── Supplier Payables — every supplier ── */}
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
              {supplierList && supplierList.length > 0 && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">All Suppliers ({supplierList.length})</p>
                  {supplierList.map((c) => (
                    <BSCollapsibleItem key={c.id} label={c.name} value={c.total}>
                      {c.opening !== 0 && <BSSubLine label="Opening Balance" value={c.opening} />}
                      {c.invoices.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Unpaid Invoices:</p>
                          {c.invoices.map((inv, i) => (
                            <div key={i} className="flex justify-between items-baseline py-0.5 pl-2">
                              <span className="text-[11px] text-muted-foreground">{inv.invoice_number}</span>
                              <span className="font-mono text-[11px] tabular-nums">{bsFmt(inv.balance_due)}</span>
                            </div>
                          ))}
                        </div>
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

            {/* ── Capital — all closing accounts ── */}
            <BSCollapsibleItem
              label={t("reports.closingAccounts")}
              value={capitalEquity}
              defaultOpen
              onOpen={() => setShowCapital(true)}
            >
              {capitalList && capitalList.length > 0 ? (
                capitalList.map((c, i) => (
                  <BSSubLine key={i} label={c.name} value={Number(c.opening_balance)} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-1">No capital accounts</p>
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
