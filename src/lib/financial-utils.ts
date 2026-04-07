import { supabase } from "@/integrations/supabase/client";

export interface CategoryBalances {
  cashBalance: number;
  bankBalance: number;
  customerReceivables: number;
  supplierPayables: number;
  employeeReceivables: number;
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
  cashExpenses: number;
}

export async function calculateCashInHand(): Promise<CashInHandResult> {
  const balances = await fetchCategoryBalances();
  const opening = balances.cashBalance;

  const { data: allPayments } = await supabase.from("payments").select("amount, payment_method, voucher_type");

  const cashReceipts = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "receipt")
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const cashPayments = allPayments?.filter(p => p.payment_method === "cash" && p.voucher_type === "payment")
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const { data: expenseData } = await supabase.from("expenses").select("amount").eq("payment_method", "cash");
  const cashExpenses = expenseData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

  const total = opening + cashReceipts - cashPayments - cashExpenses;

  return { total, opening, cashReceipts, cashPayments, cashExpenses };
}

// === Employee Advances ===
export interface EmployeeAdvancesResult {
  total: number;
  opening: number;
  paymentsToEmployees: number;
  receiptsFromEmployees: number;
}

export async function calculateEmployeeAdvances(): Promise<EmployeeAdvancesResult> {
  const { data: employeeContacts } = await supabase
    .from("contacts")
    .select("id, opening_balance")
    .eq("account_category", "employee");

  if (!employeeContacts?.length) return { total: 0, opening: 0, paymentsToEmployees: 0, receiptsFromEmployees: 0 };

  const opening = employeeContacts.reduce((sum, c) => sum + Number(c.opening_balance || 0), 0);
  const employeeIds = employeeContacts.map(c => c.id);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, voucher_type, contact_id")
    .in("contact_id", employeeIds);

  let paymentsToEmployees = 0;
  let receiptsFromEmployees = 0;
  for (const p of payments || []) {
    if (p.voucher_type === "payment") paymentsToEmployees += Number(p.amount);
    else if (p.voucher_type === "receipt") receiptsFromEmployees += Number(p.amount);
  }

  const total = opening + paymentsToEmployees - receiptsFromEmployees;
  return { total, opening, paymentsToEmployees, receiptsFromEmployees };
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

export async function calculateReceivables(businessUnit?: string): Promise<ReceivablesResult> {
  const balances = await fetchCategoryBalances();
  const openingBalance = balances.customerReceivables;
  let query = supabase.from("invoices").select("balance_due").eq("invoice_type", "sale");
  if (businessUnit) query = query.eq("business_unit", businessUnit);
  const { data } = await query;
  const invoiceBalance = data?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
  return { total: invoiceBalance + openingBalance, openingBalance, invoiceBalance };
}

// === Payables ===
export interface PayablesResult {
  total: number;
  openingBalance: number;
  invoiceBalance: number;
}

export async function calculatePayables(businessUnit?: string): Promise<PayablesResult> {
  const balances = await fetchCategoryBalances();
  const openingBalance = Math.abs(balances.supplierPayables);
  let query = supabase.from("invoices").select("balance_due").eq("invoice_type", "purchase");
  if (businessUnit) query = query.eq("business_unit", businessUnit);
  const { data } = await query;
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
    }
  }

  return result;
}

export async function recalculateAllAvgCosts() {
  const { data: items } = await supabase
    .from("invoice_items")
    .select("product_id, quantity, total, unit_id, invoices!inner(invoice_date, invoice_type)")
    .eq("invoices.invoice_type", "purchase")
    .order("invoice_date", { referencedTable: "invoices", ascending: true });

  const { data: units } = await supabase
    .from("units")
    .select("id, kg_value");

  const unitMap = new Map(units?.map(u => [u.id, u]) || []);

  const productAvgCost = new Map<string, { avgCost: number; totalQty: number }>();

  for (const item of items || []) {
    const unit = unitMap.get(item.unit_id || "");
    const kgValue = (unit?.kg_value ?? 0) > 0 ? unit!.kg_value : 1;
    const itemQtyInUnits = Number(item.quantity);
    const purchaseUnitCost = Number(item.total) / itemQtyInUnits;

    const existing = productAvgCost.get(item.product_id) || { avgCost: 0, totalQty: 0 };
    const newTotalQty = existing.totalQty + itemQtyInUnits;
    const newAvgCost = newTotalQty > 0
      ? ((existing.totalQty * existing.avgCost) + (itemQtyInUnits * purchaseUnitCost)) / newTotalQty
      : purchaseUnitCost;

    productAvgCost.set(item.product_id, { avgCost: newAvgCost, totalQty: newTotalQty });
  }

  for (const [productId, { avgCost }] of productAvgCost) {
    await supabase
      .from("products")
      .update({ avg_cost: avgCost })
      .eq("id", productId);
  }

  return productAvgCost.size;
}
