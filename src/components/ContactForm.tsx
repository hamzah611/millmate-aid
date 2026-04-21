import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type PaymentTerms = "7" | "15" | "30";

const ACCOUNT_CATEGORIES = ["customer", "supplier", "both", "broker", "bank", "expense", "employee", "loan", "fixedAsset"] as const;

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
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactData>(initial || emptyForm);
  const isEdit = !!initial?.id;

  useEffect(() => {
    setForm(initial || emptyForm);
  }, [initial]);

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

  const mutation = useMutation({
    mutationFn: async () => {
      const isExpense = form.contact_type === "expense";
      const payload: any = {
        name: form.name,
        phone: form.phone || null,
        city: form.city || null,
        address: form.address || null,
        contact_type: form.contact_type,
        credit_limit: form.credit_limit,
        payment_terms: form.payment_terms,
        account_category: form.account_category || null,
        opening_balance: form.opening_balance,
        opening_balance_date: form.opening_balance_date || null,
        account_type: form.account_type || null,
        sub_account: isExpense ? (form.sub_account || null) : null,
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

  const contactType = form.contact_type;
  const isExpense = contactType === "expense";

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      {/* 1. Account Name */}
      <div className="space-y-1.5">
        <Label>{t("contacts.name")}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>

      {/* 2. Account Category (contact_type) */}
      <div className="space-y-1.5">
        <Label>{t("contacts.accountCategory")}</Label>
        <Select value={contactType} onValueChange={(v) => setForm({ ...form, contact_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACCOUNT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{t(`contacts.${cat}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Account Type (all categories, optional, free text with suggestions) */}
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

      {/* 4. Sub Account (only if expense) */}
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

      {/* Transaction Mode field removed */}

      {/* 6. Opening Balance */}
      <div className="space-y-1.5">
        <Label>{t("contacts.openingBalance")}</Label>
        <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: +e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label>{t("contacts.openingBalanceDate")}</Label>
        <Input type="date" value={form.opening_balance_date} onChange={(e) => setForm({ ...form, opening_balance_date: e.target.value })} />
      </div>

      {/* Other existing fields */}
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
