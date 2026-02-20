import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  invoiceId: string;
  balanceDue: number;
  currentAmountPaid: number;
  onSuccess: () => void;
}

const RecordPayment = ({ invoiceId, balanceDue, currentAmountPaid, onSuccess }: Props) => {
  const { t } = useLanguage();
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > balanceDue) {
      toast.error(t("payment.invalidAmount"));
      return;
    }

    setSaving(true);
    try {
      // Insert payment record
      const { error: payError } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount,
        payment_date: date,
      });
      if (payError) throw payError;

      // Update invoice
      const newAmountPaid = currentAmountPaid + amount;
      const newBalance = balanceDue - amount;
      const newStatus = newBalance <= 0 ? "paid" : "partial";

      const { error: invError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalance),
          payment_status: newStatus,
        })
        .eq("id", invoiceId);
      if (invError) throw invError;

      toast.success(t("payment.recorded"));
      setAmount(0);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold">{t("payment.record")}</h4>
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
      <Button type="submit" size="sm" disabled={saving} className="w-full">
        {saving ? t("common.loading") : t("payment.record")}
      </Button>
    </form>
  );
};

export default RecordPayment;
