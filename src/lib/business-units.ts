import { useLanguage } from "@/contexts/LanguageContext";

export const BUSINESS_UNITS = [
  { value: "flour_mill", labelKey: "businessUnit.flourMill" },
  { value: "rice_hullar", labelKey: "businessUnit.riceHullar" },
] as const;

export type BusinessUnitValue = typeof BUSINESS_UNITS[number]["value"] | null;

/** For use in filters — includes "all" and "unassigned" options */
export function getBusinessUnitFilterOptions(t: (key: string) => string) {
  return [
    { value: "all", label: t("filter.all") },
    ...BUSINESS_UNITS.map((bu) => ({ value: bu.value, label: t(bu.labelKey) })),
    { value: "unassigned", label: t("businessUnit.unassigned") },
  ];
}

/** For use in forms — includes unassigned as default */
export function getBusinessUnitFormOptions(t: (key: string) => string) {
  return [
    { value: "", label: t("businessUnit.unassigned") },
    ...BUSINESS_UNITS.map((bu) => ({ value: bu.value, label: t(bu.labelKey) })),
  ];
}

/** Get display label for a business_unit value */
export function getBusinessUnitLabel(value: string | null | undefined, t: (key: string) => string): string {
  if (!value) return t("businessUnit.unassigned");
  const found = BUSINESS_UNITS.find((bu) => bu.value === value);
  return found ? t(found.labelKey) : t("businessUnit.unassigned");
}

/** Filter predicate for business unit */
export function matchesBusinessUnit(recordValue: string | null | undefined, filterValue: string): boolean {
  if (filterValue === "all") return true;
  if (filterValue === "unassigned") return !recordValue;
  return recordValue === filterValue;
}
