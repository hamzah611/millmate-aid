import { supabase } from "@/integrations/supabase/client";

export const ACCOUNT_CATEGORY_UNASSIGNED = "___unassigned___";

export const ACCOUNT_CATEGORIES = [
  { value: "cash", labelKey: "accountCategory.cash" },
  { value: "bank", labelKey: "accountCategory.bank" },
  { value: "closing", labelKey: "accountCategory.closing" },
  { value: "customer", labelKey: "accountCategory.customer" },
  { value: "supplier", labelKey: "accountCategory.supplier" },
  { value: "employee", labelKey: "accountCategory.employee" },
  { value: "sales_income", labelKey: "accountCategory.salesIncome" },
  { value: "purchase", labelKey: "accountCategory.purchase" },
  { value: "direct_expense", labelKey: "accountCategory.directExpense" },
  { value: "loan", labelKey: "accountCategory.loan" },
  { value: "fixed_asset", labelKey: "accountCategory.fixedAsset" },
] as const;

export type AccountCategoryValue = typeof ACCOUNT_CATEGORIES[number]["value"] | null;

/** Dynamic category row from DB */
export interface DynamicAccountCategory {
  id: string;
  name: string;
  label: string;
  label_ur: string | null;
  is_system: boolean;
}

/** Fetch all account categories from DB */
export async function fetchAccountCategories(): Promise<DynamicAccountCategory[]> {
  const { data, error } = await supabase
    .from("account_categories")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as DynamicAccountCategory[];
}

/** Subset relevant for contacts */
export const CONTACT_ACCOUNT_CATEGORIES = ["customer", "supplier", "employee", "closing"] as const;

/** Subset relevant for expenses */
export const EXPENSE_ACCOUNT_CATEGORIES = ["direct_expense", "employee", "bank", "cash"] as const;

/** Get extra (non-system or not in hardcoded list) categories as form options */
function extraOptions(
  dynamicCategories: DynamicAccountCategory[] | undefined,
  subset: readonly string[],
  language?: string
): { value: string; label: string }[] {
  if (!dynamicCategories) return [];
  return dynamicCategories
    .filter((dc) => !subset.includes(dc.name) && !ACCOUNT_CATEGORIES.find((c) => c.value === dc.name))
    .map((dc) => ({
      value: dc.name,
      label: language === "ur" && dc.label_ur ? dc.label_ur : dc.label,
    }));
}

/** For contact forms — includes unassigned as default */
export function getContactAccountCategoryFormOptions(
  t: (key: string) => string,
  dynamicCategories?: DynamicAccountCategory[],
  language?: string
) {
  const base = [
    { value: ACCOUNT_CATEGORY_UNASSIGNED, label: t("accountCategory.unassigned") },
    ...CONTACT_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
  ];
  return [...base, ...extraOptions(dynamicCategories, CONTACT_ACCOUNT_CATEGORIES as unknown as string[], language)];
}

/** For expense forms — includes unassigned as default */
export function getExpenseAccountCategoryFormOptions(
  t: (key: string) => string,
  dynamicCategories?: DynamicAccountCategory[],
  language?: string
) {
  return [
    { value: ACCOUNT_CATEGORY_UNASSIGNED, label: t("accountCategory.unassigned") },
    ...EXPENSE_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
    ...extraOptions(dynamicCategories, EXPENSE_ACCOUNT_CATEGORIES as unknown as string[], language),
  ];
}

/** For contact list filters */
export function getContactAccountCategoryFilterOptions(
  t: (key: string) => string,
  dynamicCategories?: DynamicAccountCategory[],
  language?: string
) {
  return [
    { value: "all", label: t("filter.all") },
    ...CONTACT_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
    ...extraOptions(dynamicCategories, CONTACT_ACCOUNT_CATEGORIES as unknown as string[], language),
    { value: "unassigned", label: t("accountCategory.unassigned") },
  ];
}

/** For expense list filters */
export function getExpenseAccountCategoryFilterOptions(
  t: (key: string) => string,
  dynamicCategories?: DynamicAccountCategory[],
  language?: string
) {
  return [
    { value: "all", label: t("filter.all") },
    ...EXPENSE_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
    ...extraOptions(dynamicCategories, EXPENSE_ACCOUNT_CATEGORIES as unknown as string[], language),
    { value: "unassigned", label: t("accountCategory.unassigned") },
  ];
}

/** Get display label for an account_category value */
export function getAccountCategoryLabel(
  value: string | null | undefined,
  t: (key: string) => string,
  dynamicCategories?: DynamicAccountCategory[],
  language?: string
): string {
  if (!value) return t("accountCategory.unassigned");
  const found = ACCOUNT_CATEGORIES.find((c) => c.value === value);
  if (found) return t(found.labelKey);
  // Check dynamic categories
  if (dynamicCategories) {
    const dc = dynamicCategories.find((c) => c.name === value);
    if (dc) return language === "ur" && dc.label_ur ? dc.label_ur : dc.label;
  }
  // Fallback: display the raw value (never show "unassigned" for a valid custom category)
  return value;
}

/** Filter predicate for account category */
export function matchesAccountCategory(recordValue: string | null | undefined, filterValue: string): boolean {
  if (filterValue === "all") return true;
  if (filterValue === "unassigned") return !recordValue;
  return recordValue === filterValue;
}
