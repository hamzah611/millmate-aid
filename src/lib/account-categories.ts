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
] as const;

export type AccountCategoryValue = typeof ACCOUNT_CATEGORIES[number]["value"] | null;

/** Subset relevant for contacts */
export const CONTACT_ACCOUNT_CATEGORIES = ["customer", "supplier", "employee", "closing"] as const;

/** Subset relevant for expenses */
export const EXPENSE_ACCOUNT_CATEGORIES = ["direct_expense", "employee", "bank", "cash"] as const;

/** For contact forms — includes unassigned as default */
export function getContactAccountCategoryFormOptions(t: (key: string) => string) {
  return [
    { value: ACCOUNT_CATEGORY_UNASSIGNED, label: t("accountCategory.unassigned") },
    ...CONTACT_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
  ];
}

/** For expense forms — includes unassigned as default */
export function getExpenseAccountCategoryFormOptions(t: (key: string) => string) {
  return [
    { value: ACCOUNT_CATEGORY_UNASSIGNED, label: t("accountCategory.unassigned") },
    ...EXPENSE_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
  ];
}

/** For contact list filters */
export function getContactAccountCategoryFilterOptions(t: (key: string) => string) {
  return [
    { value: "all", label: t("filter.all") },
    ...CONTACT_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
    { value: "unassigned", label: t("accountCategory.unassigned") },
  ];
}

/** For expense list filters */
export function getExpenseAccountCategoryFilterOptions(t: (key: string) => string) {
  return [
    { value: "all", label: t("filter.all") },
    ...EXPENSE_ACCOUNT_CATEGORIES.map((v) => {
      const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v)!;
      return { value: cat.value, label: t(cat.labelKey) };
    }),
    { value: "unassigned", label: t("accountCategory.unassigned") },
  ];
}

/** Get display label for an account_category value */
export function getAccountCategoryLabel(value: string | null | undefined, t: (key: string) => string): string {
  if (!value) return t("accountCategory.unassigned");
  const found = ACCOUNT_CATEGORIES.find((c) => c.value === value);
  return found ? t(found.labelKey) : t("accountCategory.unassigned");
}

/** Filter predicate for account category */
export function matchesAccountCategory(recordValue: string | null | undefined, filterValue: string): boolean {
  if (filterValue === "all") return true;
  if (filterValue === "unassigned") return !recordValue;
  return recordValue === filterValue;
}
