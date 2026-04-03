import { useState } from "react";
import { useEscapeBack } from "@/hooks/useEscapeBack";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getBusinessUnitFormOptions } from "@/lib/business-units";
import { ACCOUNT_CATEGORY_UNASSIGNED, getExpenseAccountCategoryFormOptions, fetchAccountCategories } from "@/lib/account-categories";
import SearchableCombobox from "@/components/SearchableCombobox";

export default function ExpenseNew() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useEscapeBack();

  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankContactId, setBankContactId] = useState("");
  const [notes, setNotes] = useState("");
  const [businessUnit, setBusinessUnit] = useState("___unassigned___");
  const [accountCategory, setAccountCategory] = useState(ACCOUNT_CATEGORY_UNASSIGNED);
  const [submitted, setSubmitted] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingAcCategory, setAddingAcCategory] = useState(false);
  const [newAcCategoryName, setNewAcCategoryName] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").order("name");
      return data || [];
    },
  });

  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("account_category", "bank").order("name");
      return data || [];
    },
  });

  const { data: dynamicAccountCategories } = useQuery({
    queryKey: ["account-categories"],
    queryFn: fetchAccountCategories,
  });

  const bankOptions = (bankContacts || []).map(c => ({ value: c.id, label: c.name }));

  const addAcCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("account_categories").insert({ name, label: name, is_system: false }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["account-categories"] });
      setAccountCategory(data.name);
      setAddingAcCategory(false);
      setNewAcCategoryName("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("expense_categories").insert({ name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setCategoryId(data.id);
      setAddingCategory(false);
      setNewCategoryName("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      const { error } = await supabase.from("expenses").insert({
        expense_date: expenseDate,
        category_id: categoryId,
        amount: amt,
        payment_method: paymentMethod,
        notes: notes || null,
        business_unit: businessUnit === "___unassigned___" ? null : businessUnit || null,
        account_category: accountCategory === ACCOUNT_CATEGORY_UNASSIGNED ? null : accountCategory || null,
        bank_contact_id: paymentMethod === "bank" ? bankContactId || null : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: t("common.saved"), description: t("expenses.saved") });
      navigate("/expenses");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    setSubmitted(true);
    if (!categoryId) {
      toast({ title: t("expenses.validationCategory"), variant: "destructive" });
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: t("expenses.validationAmount"), variant: "destructive" });
      return;
    }
    if (paymentMethod === "bank" && !bankContactId) {
      toast({ title: t("voucher.bankRequired"), variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t("expenses.new")}</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("expenses.form")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("invoice.date")}</Label>
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("expenses.category")}</Label>
            {addingCategory ? (
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("expenses.newCategoryName")}
                  autoFocus
                />
                <Button size="sm" onClick={() => { if (newCategoryName.trim()) addCategoryMutation.mutate(newCategoryName.trim()); }} disabled={addCategoryMutation.isPending}>
                  {t("common.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Select value={categoryId} onValueChange={(v) => { if (v === "__add_new__") { setAddingCategory(true); } else { setCategoryId(v); } }}>
                <SelectTrigger className={submitted && !categoryId ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("expenses.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {language === "ur" && c.name_ur ? c.name_ur : c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add_new__" className="text-primary font-medium">
                    {t("expenses.addCategory")}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("payment.amount")} (₨)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={submitted && (!amount || parseFloat(amount) <= 0) ? "border-destructive" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("expenses.paymentMethod")}</Label>
            <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); if (v !== "bank") setBankContactId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("expenses.cash")}</SelectItem>
                <SelectItem value="bank">{t("expenses.bank")}</SelectItem>
                <SelectItem value="other">{t("expenses.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "bank" && (
            <div className="space-y-2">
              <Label>{t("voucher.selectBank")} *</Label>
              <SearchableCombobox
                value={bankContactId}
                onValueChange={setBankContactId}
                options={bankOptions}
                placeholder={t("voucher.selectBank")}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("adjustments.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("expenses.notesPlaceholder")} />
          </div>

          <div className="space-y-2">
            <Label>{t("businessUnit.label")}</Label>
            <Select value={businessUnit} onValueChange={setBusinessUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getBusinessUnitFormOptions(t).map((opt) => (
                  <SelectItem key={opt.value || "unassigned"} value={opt.value || "___unassigned___"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("accountCategory.label")}</Label>
            <Select value={accountCategory} onValueChange={setAccountCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getExpenseAccountCategoryFormOptions(t).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/expenses")}>
              {t("common.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
