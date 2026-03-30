import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { getBusinessUnitFormOptions } from "@/lib/business-units";
import { ACCOUNT_CATEGORY_UNASSIGNED, getExpenseAccountCategoryFormOptions } from "@/lib/account-categories";

export default function ExpenseEdit() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expenseDate, setExpenseDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [businessUnit, setBusinessUnit] = useState("___unassigned___");
  const [submitted, setSubmitted] = useState(false);

  const { data: expense, isLoading } = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").order("name");
      return data || [];
    },
  });

  useEffect(() => {
    if (expense) {
      setExpenseDate(expense.expense_date);
      setCategoryId(expense.category_id || "");
      setAmount(String(expense.amount));
      setPaymentMethod(expense.payment_method);
      setNotes(expense.notes || "");
      setBusinessUnit(expense.business_unit || "___unassigned___");
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      const { error } = await supabase.from("expenses").update({
        expense_date: expenseDate,
        category_id: categoryId,
        amount: amt,
        payment_method: paymentMethod,
        notes: notes || null,
        business_unit: businessUnit === "___unassigned___" ? null : businessUnit || null,
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: t("common.updated") });
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
    mutation.mutate();
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t("expenses.edit")}</h1>
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
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className={submitted && !categoryId ? "border-destructive" : ""}>
                <SelectValue placeholder={t("expenses.selectCategory")} />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {language === "ur" && c.name_ur ? c.name_ur : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("expenses.cash")}</SelectItem>
                <SelectItem value="bank">{t("expenses.bank")}</SelectItem>
                <SelectItem value="other">{t("expenses.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
