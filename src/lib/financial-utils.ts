import { supabase } from "@/integrations/supabase/client";

export interface CategoryBalances {
  cashBalance: number;
  bankBalance: number;
  customerReceivables: number;
  supplierPayables: number;
  employeeReceivables: number;
  capitalEquity: number;
}

export interface ProductValuation {
  id: string;
  name: string;
  stockQty: number;
  stockInUnit: number;
  unitName: string;
  avgCost: number;
  inventoryValue: number;
  costSource: "purchase_history" | "default_price" | "missing";
  hasOpeningStock: boolean;
}

export interface InventoryValuation {
  totalValue: number;
  hasValuationGap: boolean;
  hasOpeningStock: boolean;
  products: ProductValuation[];
}

// === Cash In Hand ===
export interface CashInHandResult {
  total: number;
  opening: number;
  cashReceipts: number;
  cashPayments: number;
  untrackedSaleCash: number;
  untrackedPurchaseCash: number;
  cashExpenses: number;
}

export async function calculateCashInHand(): Promise<CashInHandResult> {
  const balances = await fetchCategoryBalances();
  const opening = balances.cashBalance;

  const { data: allPayments } = await supabase.from("payments").select("amount, payment_method, voucher_type, invoice_id");

  const cashReceipts = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "receipt")
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const cashPayments = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "payment")
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const voucherTotalsByInvoice = new Map<string, number>();
  for (const p of allPayments || []) {
    if (p.invoice_id) {
      voucherTotalsByInvoice.set(p.invoice_id, (voucherTotalsByInvoice.get(p.invoice_id) || 0) + Number(p.amount));
    }
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
  const cashExpenses = expenseData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

  const total = opening + cashReceipts + untrackedSaleCash - cashPayments - untrackedPurchaseCash - cashExpenses;

  return { total, opening, cashReceipts, cashPayments, untrackedSaleCash, untrackedPurchaseCash, cashExpenses };
}

// === Per-Bank Balances ===
export interface BankBalance {
  id: string;
  name: string;
  balance: number;
  opening: number;
  receipts: number;
  payments: number;
  expenses: number;
}

export async function calculateBankBalances(): Promise<BankBalance[]> {
  const { data: banks } = await supabase
    .from("contacts")
    .select("id, name, opening_balance")
    .eq("account_category", "bank")
    .order("name");
  if (!banks?.length) return [];

  const { data: bankPayments } = await supabase
    .from("payments")
    .select("amount, voucher_type, bank_contact_id")
    .eq("payment_method", "bank");

  const { data: bankExpenses } = await supabase
    .from("expenses")
    .select("amount, bank_contact_id")
    .eq("payment_method", "bank");

  return banks.map(bank => {
    const opening = Number(bank.opening_balance || 0);
    const receipts = bankPayments?.filter(p => p.bank_contact_id === bank.id && p.voucher_type === "receipt")
      .reduce((s, p) => s + Number(p.amount), 0) || 0;
    const payments = bankPayments?.filter(p => p.bank_contact_id === bank.id && p.voucher_type === "payment")
      .reduce((s, p) => s + Number(p.amount), 0) || 0;
    const expenses = bankExpenses?.filter(e => e.bank_contact_id === bank.id)
      .reduce((s, e) => s + Number(e.amount), 0) || 0;
    const balance = opening + receipts - payments - expenses;
    return { id: bank.id, name: bank.name, balance, opening, receipts, payments, expenses };
  });
}

// === Receivables ===
export interface ReceivablesResult {
  total: number;
  openingBalance: number;
  invoiceBalance: number;
}

export async function calculateReceivables(): Promise<ReceivablesResult> {
  const balances = await fetchCategoryBalances();
  const openingBalance = balances.customerReceivables;
  const { data } = await supabase.from("invoices").select("balance_due").eq("invoice_type", "sale");
  const invoiceBalance = data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
  return { total: invoiceBalance + openingBalance, openingBalance, invoiceBalance };
}

// === Payables ===
export interface PayablesResult {
  total: number;
  openingBalance: number;
  invoiceBalance: number;
}

export async function calculatePayables(): Promise<PayablesResult> {
  const balances = await fetchCategoryBalances();
  const openingBalance = Math.abs(balances.supplierPayables);
  const { data } = await supabase.from("invoices").select("balance_due").eq("invoice_type", "purchase");
  const invoiceBalance = data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
  return { total: invoiceBalance + openingBalance, openingBalance, invoiceBalance };
}

/**
 * Calculate inventory value using moving average cost stored on each product.
 */
export async function calculateInventoryValue(): Promise<InventoryValuation> {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, stock_qty, default_price, avg_cost, unit_id")
    .gt("stock_qty", 0);

  if (!products?.length) return { totalValue: 0, hasValuationGap: false, hasOpeningStock: false, products: [] };

  const { data: units } = await supabase.from("units").select("id, name, name_ur, kg_value");
  const unitMap = new Map(units?.map(u => [u.id, u]) || []);

  const { data: purchaseInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("invoice_type", "purchase");

  const purchaseAgg = new Map<string, number>();
  if (purchaseInvoices?.length) {
    const pIds = purchaseInvoices.map(i => i.id);
    const { data: items } = await supabase
      .from("invoice_items")
      .select("product_id, quantity, unit_id")
      .in("invoice_id", pIds);
    items?.forEach(it => {
      const itUnit = unitMap.get(it.unit_id || "");
      const kgQty = Number(it.quantity) * (itUnit?.kg_value || 1);
      purchaseAgg.set(it.product_id, (purchaseAgg.get(it.product_id) || 0) + kgQty);
    });
  }

  const productValuations: ProductValuation[] = [];
  let totalValue = 0;
  let hasValuationGap = false;
  let hasOpeningStock = false;

  for (const p of products) {
    const stockQty = Number(p.stock_qty);
    const avgCost = Number(p.avg_cost) || 0;
    const defaultPrice = Number(p.default_price) || 0;
    const unit = unitMap.get(p.unit_id || "");
    const kgValue = unit?.kg_value || 1;
    const unitName = unit?.name || "KG";

    const effectiveCost = avgCost > 0 ? avgCost : defaultPrice;
    const stockInUnit = kgValue > 0 ? stockQty / kgValue : stockQty;
    const value = stockInUnit * effectiveCost;

    const costSource: ProductValuation["costSource"] =
      avgCost > 0 ? "purchase_history" : defaultPrice > 0 ? "default_price" : "missing";

    if (costSource === "missing") hasValuationGap = true;

    const totalPurchasedKg = purchaseAgg.get(p.id) || 0;
    const productHasOpeningStock = stockQty > totalPurchasedKg && totalPurchasedKg >= 0;
    if (productHasOpeningStock) hasOpeningStock = true;

    totalValue += value;
    productValuations.push({
      id: p.id,
      name: p.name,
      stockQty,
      stockInUnit: Math.round(stockInUnit * 100) / 100,
      unitName,
      avgCost: effectiveCost,
      inventoryValue: Math.round(value),
      costSource,
      hasOpeningStock: productHasOpeningStock,
    });
  }

  productValuations.sort((a, b) => b.inventoryValue - a.inventoryValue);

  return { totalValue: Math.round(totalValue), hasValuationGap, hasOpeningStock, products: productValuations };
}

/**
 * Fetch opening balance sums grouped by account_category.
 */
export async function fetchCategoryBalances(toDate?: string): Promise<CategoryBalances> {
  let query = supabase
    .from("contacts")
    .select("opening_balance, account_category")
    .neq("opening_balance", 0);

  if (toDate) {
    query = query.lte("opening_balance_date", toDate);
  }

  const { data } = await query;

  const result: CategoryBalances = {
    cashBalance: 0,
    bankBalance: 0,
    customerReceivables: 0,
    supplierPayables: 0,
    employeeReceivables: 0,
    capitalEquity: 0,
  };

  for (const c of data || []) {
    const bal = Number(c.opening_balance);
    switch (c.account_category) {
      case "cash":
        result.cashBalance += bal;
        break;
      case "bank":
        result.bankBalance += bal;
        break;
      case "customer":
        result.customerReceivables += bal;
        break;
      case "supplier":
        result.supplierPayables += bal;
        break;
      case "employee":
        result.employeeReceivables += bal;
        break;
      case "closing":
        result.capitalEquity += bal;
        break;
    }
  }

  return result;
}
