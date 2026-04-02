import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ACCOUNT_CATEGORY_UNASSIGNED, getContactAccountCategoryFormOptions } from "@/lib/account-categories";

type ContactType = "customer" | "supplier" | "both" | "broker" | "bank";
type PaymentTerms = "7" | "15" | "30";

interface ContactData {
  id?: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  contact_type: ContactType;
  credit_limit: number;
  payment_terms: PaymentTerms | null;
  account_category: string | null;
  opening_balance: number;
  opening_balance_date?: string;
}

interface Props {
  initial?: ContactData;
  onSuccess: () => void;
}

const emptyForm: ContactData = {
  name: "", phone: "", city: "", address: "", contact_type: "customer", credit_limit: 0, payment_terms: null, account_category: null, opening_balance: 0, opening_balance_date: new Date().toISOString().slice(0, 10),
};

const ContactForm = ({ initial, onSuccess }: Props) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactData>(initial || emptyForm);
  const [acCategory, setAcCategory] = useState(initial?.account_category || ACCOUNT_CATEGORY_UNASSIGNED);
  const isEdit = !!initial?.id;

  useEffect(() => {
    setForm(initial || emptyForm);
    setAcCategory(initial?.account_category || ACCOUNT_CATEGORY_UNASSIGNED);
  }, [initial]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("contacts.name")}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
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
        <Label>{t("contacts.type")}</Label>
        <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v as ContactType })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">{t("contacts.customer")}</SelectItem>
            <SelectItem value="supplier">{t("contacts.supplier")}</SelectItem>
            <SelectItem value="both">{t("contacts.both")}</SelectItem>
            <SelectItem value="broker">{t("contacts.broker")}</SelectItem>
            <SelectItem value="bank">{t("contacts.bank")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.creditLimit")}</Label>
        <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: +e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.openingBalance")}</Label>
        <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: +e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contacts.openingBalanceDate")}</Label>
        <Input type="date" value={form.opening_balance_date} onChange={(e) => setForm({ ...form, opening_balance_date: e.target.value })} />
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
      <div className="space-y-1.5">
        <Label>{t("accountCategory.label")}</Label>
        <Select value={acCategory} onValueChange={setAcCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {getContactAccountCategoryFormOptions(t).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
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
