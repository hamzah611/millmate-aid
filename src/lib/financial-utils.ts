import { supabase } from "@/integrations/supabase/client";

export interface CategoryBalances {
  cashBalance: number;
  bankBalance: number;
  customerReceivables: number;
  supplierPayables: number;
  employeeReceivables: number;
  capitalEquity: number;
}

/**
 * Fetch opening balance sums grouped by account_category.
 * All values are RAW sums — caller decides display formatting.
 * 
 * Sign convention:
 *   cash/bank: raw sum (negative = deficit)
 *   customer: raw sum (positive = they owe us)
 *   supplier: raw sum (negative = we owe them) — caller uses abs() for display
 *   employee: raw sum (positive = advances given)
 *   closing: raw sum as Capital/Equity
 *
 * @param toDate optional — only include where opening_balance_date <= toDate
 */
export interface InventoryValuation {
  totalValue: number;
  hasValuationGap: boolean;
  hasOpeningStock: boolean;
}

/**
 * Calculate inventory value using weighted average purchase cost.
 * Handles opening stock detection and fallback to default_price.
 */
export async function calculateInventoryValue(): Promise<InventoryValuation> {
  const { data: products } = await supabase
    .from("products")
    .select("id, stock_qty, default_price")
    .gt("stock_qty", 0);

  if (!products?.length) return { totalValue: 0, hasValuationGap: false, hasOpeningStock: false };

  // Fetch all purchase invoice IDs
  const { data: purchaseInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("invoice_type", "purchase");

  // Build per-product purchase aggregates
  const purchaseAgg = new Map<string, { qty: number; cost: number }>();
  if (purchaseInvoices?.length) {
    const pIds = purchaseInvoices.map(i => i.id);
    const { data: items } = await supabase
      .from("invoice_items")
      .select("product_id, quantity, total")
      .in("invoice_id", pIds);
    items?.forEach(it => {
      const e = purchaseAgg.get(it.product_id) || { qty: 0, cost: 0 };
      e.qty += Number(it.quantity);
      e.cost += Number(it.total);
      purchaseAgg.set(it.product_id, e);
    });
  }

  let totalValue = 0;
  let hasValuationGap = false;
  let hasOpeningStock = false;

  for (const p of products) {
    const stockQty = Number(p.stock_qty);
    const defaultPrice = Number(p.default_price);
    const purchase = purchaseAgg.get(p.id);
    const totalPurchasedQty = purchase?.qty || 0;
    const totalPurchasedCost = purchase?.cost || 0;

    // Weighted average cost
    const avgCost = totalPurchasedQty > 0 ? totalPurchasedCost / totalPurchasedQty : 0;

    // Opening stock detection
    const openingStock = Math.max(0, stockQty - totalPurchasedQty);
    const purchasedStock = Math.min(stockQty, totalPurchasedQty);

    if (openingStock > 0) hasOpeningStock = true;

    // Valuation
    const purchasedValue = purchasedStock * avgCost;
    const openingCost = avgCost > 0 ? avgCost : defaultPrice;
    const openingValue = openingStock * openingCost;

    const productValue = purchasedValue + openingValue;

    if (productValue === 0 && stockQty > 0) {
      hasValuationGap = true;
    }

    totalValue += productValue;
  }

  return { totalValue, hasValuationGap, hasOpeningStock };
}

/**
 * Fetch opening balance sums grouped by account_category.
 * All values are RAW sums — caller decides display formatting.
 * 
 * Sign convention:
 *   cash/bank: raw sum (negative = deficit)
 *   customer: raw sum (positive = they owe us)
 *   supplier: raw sum (negative = we owe them) — caller uses abs() for display
 *   employee: raw sum (positive = advances given)
 *   closing: raw sum as Capital/Equity
 *
 * @param toDate optional — only include where opening_balance_date <= toDate
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
        result.supplierPayables += bal; // raw negative
        break;
      case "employee":
        result.employeeReceivables += bal;
        break;
      case "closing":
        result.capitalEquity += bal;
        break;
      // unassigned or other categories — skip for now
    }
  }

  return result;
}
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
        result.supplierPayables += bal; // raw negative
        break;
      case "employee":
        result.employeeReceivables += bal;
        break;
      case "closing":
        result.capitalEquity += bal;
        break;
      // unassigned or other categories — skip for now
    }
  }

  return result;
}
