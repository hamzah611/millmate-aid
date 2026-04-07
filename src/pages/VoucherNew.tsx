import { useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableCombobox from "@/components/SearchableCombobox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const VoucherNew = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get("type") === "payment" ? "payment" : "receipt";

  const [voucherType, setVoucherType] = useState(defaultType);
  const [contactId, setContactId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankContactId, setBankContactId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Transfer-specific state
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");

  const isTransfer = voucherType === "transfer";

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-voucher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, contact_type")
        .not("account_category", "in", '("cash","bank","closing")')
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("account_category", "bank")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Cash + Bank contacts for transfer mode
  const { data: cashBankContacts } = useQuery({
    queryKey: ["cash-bank-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, account_category")
        .in("account_category", ["cash", "bank"])
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isTransfer,
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices-for-voucher", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, balance_due, payment_status")
        .eq("contact_id", contactId)
        .gt("balance_due", 0)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) throw new Error("Invalid amount");

      if (isTransfer) {
        // Transfer save logic
        if (!fromAccountId) throw new Error(t("voucher.fromRequired"));
        if (!toAccountId) throw new Error(t("voucher.toRequired"));
        if (fromAccountId === toAccountId) throw new Error(t("voucher.sameAccountError"));

        const { data: voucherNum, error: rpcErr } = await supabase.rpc("next_voucher_number", { v_type: "payment" });
        if (rpcErr) throw rpcErr;

        const fromAccount = cashBankContacts?.find(c => c.id === fromAccountId);
        const toAccount = cashBankContacts?.find(c => c.id === toAccountId);
        if (!fromAccount || !toAccount) throw new Error("Account not found");

        const transferNotes = `[TRANSFER] ${notes || ""}`.trim();

        // Record A: Payment from source
        const paymentA: any = {
          amount: amountNum,
          payment_method: fromAccount.account_category === "bank" ? "bank" : "cash",
          payment_date: paymentDate + "T00:00:00",
          voucher_type: "payment",
          contact_id: null,
          notes: transferNotes,
          invoice_id: null,
          bank_contact_id: fromAccount.account_category === "bank" ? fromAccount.id : null,
          voucher_number: voucherNum + "-A",
        };

        // Record B: Receipt to destination
        const paymentB: any = {
          amount: amountNum,
          payment_method: toAccount.account_category === "bank" ? "bank" : "cash",
          payment_date: paymentDate + "T00:00:00",
          voucher_type: "receipt",
          contact_id: null,
          notes: transferNotes,
          invoice_id: null,
          bank_contact_id: toAccount.account_category === "bank" ? toAccount.id : null,
          voucher_number: voucherNum + "-B",
        };

        const { error: errA } = await supabase.from("payments").insert(paymentA);
        if (errA) throw errA;
        const { error: errB } = await supabase.from("payments").insert(paymentB);
        if (errB) throw errB;
      } else {
        // Existing receipt/payment logic
        if (!contactId) throw new Error("Contact is required");
        if (paymentMethod === "bank" && !bankContactId) throw new Error(t("voucher.bankRequired"));

        const { data: voucherNum, error: rpcErr } = await supabase.rpc("next_voucher_number", { v_type: voucherType });
        if (rpcErr) throw rpcErr;

        const paymentData: any = {
          amount: amountNum,
          payment_method: paymentMethod,
          payment_date: paymentDate + "T00:00:00",
          voucher_type: voucherType,
          contact_id: contactId,
          notes: notes || null,
          invoice_id: invoiceId || null,
          bank_contact_id: paymentMethod === "bank" ? bankContactId : null,
          voucher_number: voucherNum,
        };

        const { error: payErr } = await supabase.from("payments").insert(paymentData);
        if (payErr) throw payErr;

        if (invoiceId) {
          const { data: allPayments } = await supabase
            .from("payments")
            .select("amount")
            .eq("invoice_id", invoiceId);
          const totalPaid = allPayments?.reduce((s, p) => s + Number(p.amount), 0) || 0;

          const invoice = invoices?.find(i => i.id === invoiceId);
          const invoiceTotal = Number(invoice?.total || 0);
          const newBalance = invoiceTotal - totalPaid;
          const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "credit";

          await supabase
            .from("invoices")
            .update({
              amount_paid: totalPaid,
              balance_due: Math.max(0, newBalance),
              payment_status: newStatus,
            })
            .eq("id", invoiceId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contact-payments"] });
      toast.success(t("common.saved"));
      navigate(voucherType === "receipt" ? "/receipt-vouchers" : "/payment-vouchers");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contactOptions = (contacts || []).map(c => ({
    value: c.id,
    label: c.name,
    sublabel: c.contact_type,
  }));

  const bankOptions = (bankContacts || []).map(c => ({
    value: c.id,
    label: c.name,
  }));

  const invoiceOptions = (invoices || []).map(i => ({
    value: i.id,
    label: `${i.invoice_number} — ${fmtAmount(Number(i.balance_due))} due`,
  }));

  const cashBankOptions = (cashBankContacts || []).map(c => ({
    value: c.id,
    label: `${c.name} (${c.account_category === "bank" ? t("voucher.bank") : t("voucher.cash")})`,
  }));

  const toAccountOptions = cashBankOptions.filter(o => o.value !== fromAccountId);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t("voucher.newVoucher")}</h1>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>{t("voucher.type")}</Label>
          <Select value={voucherType} onValueChange={(v) => {
            setVoucherType(v);
            // Reset fields when switching type
            setContactId("");
            setInvoiceId("");
            setFromAccountId("");
            setToAccountId("");
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receipt">{t("voucher.receipt")}</SelectItem>
              <SelectItem value="payment">{t("voucher.payment")}</SelectItem>
              <SelectItem value="transfer">{t("voucher.transfer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isTransfer ? (
          <>
            <div className="space-y-1">
              <Label>{t("voucher.fromAccount")} *</Label>
              <SearchableCombobox
                value={fromAccountId}
                onValueChange={(v) => { setFromAccountId(v); if (v === toAccountId) setToAccountId(""); }}
                options={cashBankOptions}
                placeholder={t("voucher.selectAccount")}
              />
            </div>

            <div className="space-y-1">
              <Label>{t("voucher.toAccount")} *</Label>
              <SearchableCombobox
                value={toAccountId}
                onValueChange={setToAccountId}
                options={toAccountOptions}
                placeholder={t("voucher.selectAccount")}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label>{t("invoice.contact")} *</Label>
              <SearchableCombobox
                value={contactId}
                onValueChange={(v) => { setContactId(v); setInvoiceId(""); }}
                options={contactOptions}
                placeholder={t("invoice.selectContact")}
              />
            </div>

            <div className="space-y-1">
              <Label>{t("voucher.invoice")} ({t("voucher.optional")})</Label>
              <SearchableCombobox
                value={invoiceId}
                onValueChange={setInvoiceId}
                options={invoiceOptions}
                placeholder={t("voucher.noInvoice")}
              />
              {!invoiceId && contactId && (
                <p className="text-xs text-muted-foreground">{t("voucher.directLabel")}</p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label>{t("payment.amount")} *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        {!isTransfer && (
          <>
            <div className="space-y-1">
              <Label>{t("voucher.method")}</Label>
              <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); if (v !== "bank") setBankContactId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("voucher.cash")}</SelectItem>
                  <SelectItem value="bank">{t("voucher.bank")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "bank" && (
              <div className="space-y-1">
                <Label>{t("voucher.selectBank")} *</Label>
                <SearchableCombobox
                  value={bankContactId}
                  onValueChange={setBankContactId}
                  options={bankOptions}
                  placeholder={t("voucher.selectBank")}
                />
              </div>
            )}
          </>
        )}

        <div className="space-y-1">
          <Label>{t("invoice.date")}</Label>
          <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>{t("voucher.notes")}</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
};

export default VoucherNew;
