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
  stockQty: number;        // in KG (raw from DB)
  stockInUnit: number;     // in product's display unit
  unitName: string;
  avgCost: number;         // per product unit
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

/**
 * Calculate inventory value using moving average cost stored on each product.
 * inventory_value = (stock_qty / unit.kg_value) × avg_cost
 * avg_cost is per product's display unit (Mun, Bag, etc.), NOT per KG.
 */
export async function calculateInventoryValue(): Promise<InventoryValuation> {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, stock_qty, default_price, avg_cost, unit_id")
    .gt("stock_qty", 0);

  if (!products?.length) return { totalValue: 0, hasValuationGap: false, hasOpeningStock: false, products: [] };

  // Fetch units for kg_value lookup
  const { data: units } = await supabase.from("units").select("id, name, name_ur, kg_value");
  const unitMap = new Map(units?.map(u => [u.id, u]) || []);

  // Fetch purchase aggregates for opening stock detection
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

    // Opening stock detection
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

  // Sort by value descending
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
