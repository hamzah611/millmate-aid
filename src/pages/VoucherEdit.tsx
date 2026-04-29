import { useState, useEffect } from "react";
import { fmtAmount } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableCombobox from "@/components/SearchableCombobox";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";

const recalcInvoiceBalance = async (invoiceId: string) => {
  const { data: inv } = await supabase.from("invoices").select("total").eq("id", invoiceId).single();
  if (!inv) return;
  const { data: payments } = await supabase.from("payments").select("amount").eq("invoice_id", invoiceId);
  const totalPaid = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0;
  const balance = Math.max(0, inv.total - totalPaid);
  const status = balance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "credit";
  await supabase.from("invoices").update({ amount_paid: totalPaid, balance_due: balance, payment_status: status }).eq("id", invoiceId);
};

const VoucherEdit = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const [voucherType, setVoucherType] = useState("receipt");
  const [contactId, setContactId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankContactId, setBankContactId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [oldInvoiceId, setOldInvoiceId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const { data: voucher } = useQuery({
    queryKey: ["voucher-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (voucher && !loaded) {
      setVoucherType(voucher.voucher_type);
      setContactId(voucher.contact_id || "");
      setInvoiceId(voucher.invoice_id || "");
      setOldInvoiceId(voucher.invoice_id || null);
      setAmount(String(voucher.amount));
      setPaymentMethod(voucher.payment_method);
      setBankContactId(voucher.bank_contact_id || "");
      setPaymentDate(voucher.payment_date);
      setNotes(voucher.notes || "");
      setProductId((voucher as any).product_id || "");
      setLoaded(true);
    }
  }, [voucher, loaded]);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-voucher"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, name, contact_type, account_category").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-voucher-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("is_tradeable", true).order("name");
      return data || [];
    },
  });

  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices-for-voucher-edit", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase.from("invoices").select("id, invoice_number, total, balance_due, payment_status").eq("contact_id", contactId).order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) throw new Error("Invalid amount");
      if (!contactId && !productId) throw new Error("Contact or product is required");
      if (paymentMethod === "bank" && !bankContactId) throw new Error(t("voucher.bankRequired"));

      await supabase.from("payments").update({
        amount: amountNum,
        payment_method: paymentMethod,
        payment_date: paymentDate + "T00:00:00",
        voucher_type: voucherType,
        contact_id: contactId || null,
        notes: notes || null,
        invoice_id: invoiceId || null,
        bank_contact_id: paymentMethod === "bank" ? bankContactId : null,
        product_id: productId || null,
      }).eq("id", id!);

      // Recalculate old invoice if it changed
      if (oldInvoiceId && oldInvoiceId !== invoiceId) {
        await recalcInvoiceBalance(oldInvoiceId);
      }
      // Recalculate current invoice
      if (invoiceId) {
        await recalcInvoiceBalance(invoiceId);
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

  const contactOptions = (contacts || []).map(c => ({ value: c.id, label: c.name, sublabel: c.contact_type }));
  const bankOptions = (bankContacts || []).map(c => ({ value: c.id, label: c.name }));
  const invoiceOptions = (invoices || []).map(i => ({
    value: i.id,
    label: `${i.invoice_number} — ${fmtAmount(Number(i.balance_due))} due`,
  }));

  if (!loaded) return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t("common.edit")} — {voucher?.voucher_number || t("voucher.newVoucher")}</h1>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>{t("voucher.type")}</Label>
          <Select value={voucherType} onValueChange={setVoucherType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receipt">{t("voucher.receipt")}</SelectItem>
              <SelectItem value="payment">{t("voucher.payment")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>
            {t("invoice.contact")}
            {!productId && <span className="text-destructive"> *</span>}
            {productId && <span className="text-xs text-muted-foreground"> (optional — product selected)</span>}
          </Label>
          <SearchableCombobox value={contactId} onValueChange={(v) => { setContactId(v); setInvoiceId(""); }} options={contactOptions} placeholder={t("invoice.selectContact")} />
        </div>

        {voucherType === "payment" && (
          <div className="space-y-1">
            <Label>Link to Product <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <SearchableCombobox
              value={productId}
              onValueChange={setProductId}
              options={(products || []).map(p => ({ value: p.id, label: p.name }))}
              placeholder="Select product this expense relates to"
              searchPlaceholder="Search products..."
              emptyText="No products found"
            />
            <p className="text-xs text-muted-foreground">Expense will be tracked in this product's history and reports.</p>
          </div>
        )}

        <div className="space-y-1">
          <Label>{t("voucher.invoice")} ({t("voucher.optional")})</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableCombobox value={invoiceId} onValueChange={setInvoiceId} options={invoiceOptions} placeholder={t("voucher.noInvoice")} />
            </div>
            {invoiceId && (
              <Button type="button" variant="outline" size="icon" onClick={() => setInvoiceId("")} title="Clear invoice">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label>{t("payment.amount")} *</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </div>

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
            <SearchableCombobox value={bankContactId} onValueChange={setBankContactId} options={bankOptions} placeholder={t("voucher.selectBank")} />
          </div>
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

export default VoucherEdit;
