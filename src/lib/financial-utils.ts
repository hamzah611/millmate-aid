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
