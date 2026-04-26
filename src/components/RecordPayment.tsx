import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableCombobox from "@/components/SearchableCombobox";
import { toast } from "sonner";

interface Props {
  invoiceId: string;
  balanceDue: number;
  invoiceTotal: number;
  currentAmountPaid: number;
  contactId: string;
  invoiceType: "sale" | "purchase";
  onSuccess: () => void;
}

const RecordPayment = ({ invoiceId, balanceDue, invoiceTotal, currentAmountPaid, contactId, invoiceType, onSuccess }: Props) => {
  const { t } = useLanguage();
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [bankContactId, setBankContactId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const voucherType = invoiceType === "sale" ? "receipt" : "payment";
  const formTitle = invoiceType === "sale" ? t("voucher.addReceipt") : t("voucher.addPayment");

  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const bankOptions = (bankContacts || []).map((c) => ({ value: c.id, label: c.name }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > balanceDue) {
      toast.error(t("payment.invalidAmount"));
      return;
    }
    if (paymentMethod === "bank" && !bankContactId) {
      toast.error(t("voucher.bankRequired"));
      return;
    }

    setSaving(true);
    try {
      // Insert payment record
      const { error: payError } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount,
        payment_date: date,
        contact_id: contactId,
        voucher_type: voucherType,
        payment_method: paymentMethod,
        bank_contact_id: paymentMethod === "bank" ? bankContactId : null,
        notes: notes || null,
      });
      if (payError) throw payError;

      // Recalculate from SUM of payments (source of truth)
      const { data: sumData, error: sumError } = await supabase
        .from("payments")
        .select("amount")
        .eq("invoice_id", invoiceId);
      if (sumError) throw sumError;

      const totalPaid = sumData.reduce((sum, p) => sum + Number(p.amount), 0);
      const newBalance = invoiceTotal - totalPaid;
      const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";

      const { error: invError } = await supabase
        .from("invoices")
        .update({
          amount_paid: totalPaid,
          balance_due: Math.max(0, newBalance),
          payment_status: newStatus,
        })
        .eq("id", invoiceId);
      if (invError) throw invError;

      toast.success(t("payment.recorded"));
      setAmount(0);
      setNotes("");
      setBankContactId("");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold">{formTitle}</h4>

      {/* Invoice Summary */}
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground text-xs">{t("voucher.invoiceTotal")}</div>
          <div className="font-semibold">{fmtAmount(invoiceTotal)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-xs">{t("voucher.totalPaid")}</div>
          <div className="font-semibold text-green-600 dark:text-green-400">{fmtAmount(currentAmountPaid)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-xs">{t("voucher.remaining")}</div>
          <div className="font-bold text-destructive">{fmtAmount(balanceDue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("payment.amount")}</Label>
          <Input
            type="number"
            min={1}
            max={balanceDue}
            value={amount || ""}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("invoice.date")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("voucher.method")}</Label>
        <Select
          value={paymentMethod}
          onValueChange={(v) => {
            setPaymentMethod(v);
            if (v !== "bank") setBankContactId("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">{t("voucher.cash")}</SelectItem>
            <SelectItem value="bank">{t("voucher.bank")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {paymentMethod === "bank" && (
        <div className="space-y-1">
          <Label className="text-xs">{t("voucher.selectBank")} *</Label>
          <SearchableCombobox
            value={bankContactId}
            onValueChange={setBankContactId}
            options={bankOptions}
            placeholder={t("voucher.selectBank")}
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">{t("voucher.notes")}</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("invoice.notesPlaceholder")}
          className="min-h-[60px]"
        />
      </div>

      <Button type="submit" size="sm" disabled={saving} className="w-full">
        {saving ? t("common.loading") : formTitle}
      </Button>
    </form>
  );
};

export default RecordPayment;
