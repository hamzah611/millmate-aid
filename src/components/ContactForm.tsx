import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ACCOUNT_CATEGORY_UNASSIGNED, getContactAccountCategoryFormOptions, fetchAccountCategories } from "@/lib/account-categories";
import type { DynamicAccountCategory } from "@/lib/account-categories";
import { Plus } from "lucide-react";
import CategoryManager from "@/components/CategoryManager";

type PaymentTerms = "7" | "15" | "30";

const BUILT_IN_TYPES = ["customer", "supplier", "both", "broker", "bank"];

interface ContactData {
  id?: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  contact_type: string;
  credit_limit: number;
  payment_terms: PaymentTerms | null;
  account_category: string | null;
  opening_balance: number;
  opening_balance_date?: string;
  sub_account?: string;
  account_type?: string;
}

interface Props {
  initial?: ContactData;
  onSuccess: () => void;
}

const emptyForm: ContactData = {
  name: "", phone: "", city: "", address: "", contact_type: "customer", credit_limit: 0, payment_terms: null, account_category: null, opening_balance: 0, opening_balance_date: new Date().toISOString().slice(0, 10), sub_account: "", account_type: "",
};

const ContactForm = ({ initial, onSuccess }: Props) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactData>(initial || emptyForm);
  const [acCategory, setAcCategory] = useState(initial?.account_category || ACCOUNT_CATEGORY_UNASSIGNED);
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [showNewAcCategory, setShowNewAcCategory] = useState(false);
  const [newAcCategoryName, setNewAcCategoryName] = useState("");
  const isEdit = !!initial?.id;

  useEffect(() => {
    setForm(initial || emptyForm);
    setAcCategory(initial?.account_category || ACCOUNT_CATEGORY_UNASSIGNED);
  }, [initial]);

  const { data: contactTypes } = useQuery({
    queryKey: ["contact_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_types").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: dynamicCategories } = useQuery({
    queryKey: ["account_categories"],
    queryFn: fetchAccountCategories,
  });

  const { data: accountTypeSuggestions } = useQuery({
    queryKey: ["account-type-suggestions"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("account_type").not("account_type", "is", null);
      const unique = [...new Set((data || []).map(d => d.account_type).filter(Boolean))];
      return unique.sort() as string[];
    },
  });

  const { data: subAccountSuggestions } = useQuery({
    queryKey: ["sub-account-suggestions"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("sub_account").not("sub_account", "is", null);
      const unique = [...new Set((data || []).map(d => d.sub_account).filter(Boolean))];
      return unique.sort() as string[];
    },
  });

  const addTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("contact_types").insert({ name: name.toLowerCase().trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_types"] });
      const typeName = newTypeName.toLowerCase().trim();
      setForm({ ...form, contact_type: typeName });
      setNewTypeName("");
      setShowNewType(false);
      toast.success(t("contacts.typeCreated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAcCategoryMutation = useMutation({
    mutationFn: async (label: string) => {
      const name = label.toLowerCase().trim().replace(/\s+/g, "_");
      const { error } = await supabase.from("account_categories").insert({
        name,
        label: label.trim(),
        is_system: false,
      });
      if (error) throw error;
      return name;
    },
    onSuccess: (name: string) => {
      queryClient.invalidateQueries({ queryKey: ["account_categories"] });
      setAcCategory(name);
      setNewAcCategoryName("");
      setShowNewAcCategory(false);
      toast.success(t("common.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        phone: form.phone || null,
        city: form.city || null,
        address: form.address || null,
        contact_type: form.contact_type,
        credit_limit: form.credit_limit,
        payment_terms: form.payment_terms,
        account_category: acCategory === ACCOUNT_CATEGORY_UNASSIGNED ? null : acCategory || null,
        opening_balance: form.opening_balance,
        opening_balance_date: form.opening_balance_date || null,
        account_type: form.account_type || null,
        sub_account: acCategory === "expense" ? (form.sub_account || null) : null,
      };
      if (isEdit) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(isEdit ? t("common.updated") : t("common.saved"));
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acCategoryOptions = getContactAccountCategoryFormOptions(t, dynamicCategories, language);
  const isCustomerOrSupplier = acCategory === "customer" || acCategory === "supplier";
  const isExpense = acCategory === "expense";

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("contacts.name")}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label>{t("accountCategory.label")}</Label>
          <CategoryManager title={t("accountCategory.label")} tableName="account_categories" referenceCheck={{ table: "contacts", column: "account_category", matchBy: "name" }} queryKey="account_categories" hasLabel />
        </div>
        <Select value={acCategory} onValueChange={(v) => {
          if (v === "__add_new_ac__") {
            setShowNewAcCategory(true);
          } else {
            setAcCategory(v);
            setShowNewAcCategory(false);
          }
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {acCategoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
            <SelectItem value="__add_new_ac__">
              <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" />{t("contacts.addNewType")}</span>
            </SelectItem>
          </SelectContent>
        </Select>
        {showNewAcCategory && (
          <div className="flex gap-2 mt-2">
            <Input
              placeholder={t("contacts.newTypeName")}
              value={newAcCategoryName}
              onChange={(e) => setNewAcCategoryName(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              size="sm"
              disabled={!newAcCategoryName.trim() || addAcCategoryMutation.isPending}
              onClick={() => addAcCategoryMutation.mutate(newAcCategoryName)}
            >
              <Plus className="h-4 w-4 me-1" />{t("common.save")}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t("contacts.accountType")}</Label>
        <Input
          list="account-type-list"
          value={form.account_type || ""}
          onChange={(e) => setForm({ ...form, account_type: e.target.value })}
          placeholder={t("contacts.accountType")}
        />
        <datalist id="account-type-list">
          {(accountTypeSuggestions || []).map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      {isExpense && (
        <div className="space-y-1.5">
          <Label>{t("contacts.subAccount")}</Label>
          <Input
            list="sub-account-list"
            value={form.sub_account || ""}
            onChange={(e) => setForm({ ...form, sub_account: e.target.value })}
            placeholder={t("contacts.subAccount")}
          />
          <datalist id="sub-account-list">
            {(subAccountSuggestions || []).map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      )}

      {isCustomerOrSupplier && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t("contacts.transactionMode")}</Label>
            <CategoryManager title={t("contacts.type")} tableName="contact_types" referenceCheck={{ table: "contacts", column: "contact_type", matchBy: "name" }} queryKey="contact_types" hasUrdu />
          </div>
          <Select value={form.contact_type} onValueChange={(v) => {
            if (v === "__add_new__") {
              setShowNewType(true);
            } else {
              setForm({ ...form, contact_type: v });
            }
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">{t("contacts.sale")}</SelectItem>
              <SelectItem value="supplier">{t("contacts.purchase")}</SelectItem>
              <SelectItem value="both">{t("contacts.both")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t("contacts.openingBalance")}</Label>
        <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: +e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label>{t("contacts.openingBalanceDate")}</Label>
        <Input type="date" value={form.opening_balance_date} onChange={(e) => setForm({ ...form, opening_balance_date: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label>{t("contacts.phone")}</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.city")}</Label>
        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.address")}</Label>
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.creditLimit")}</Label>
        <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: +e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.paymentTerms")}</Label>
        <Select value={form.payment_terms ?? ""} onValueChange={(v) => setForm({ ...form, payment_terms: v as PaymentTerms })}>
          <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7</SelectItem>
            <SelectItem value="15">15</SelectItem>
            <SelectItem value="30">30</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {isEdit ? t("common.edit") : t("common.save")}
      </Button>
    </form>
  );
};

export default ContactForm;
