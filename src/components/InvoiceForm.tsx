import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import InvoiceItemRow, { type InvoiceItem } from "./InvoiceItemRow";
import { Plus } from "lucide-react";

type InvoiceType = "sale" | "purchase";
type PaymentStatus = "paid" | "partial" | "credit";

interface Props {
  type: InvoiceType;
  onSuccess: () => void;
  onCancel: () => void;
}

const InvoiceForm = ({ type, onSuccess, onCancel }: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [contactId, setContactId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [amountPaid, setAmountPaid] = useState(0);

  const contactFilter = type === "sale"
    ? ["customer", "both"] as const
    : ["supplier", "both"] as const;

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-invoice", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, contact_type")
        .in("contact_type", contactFilter)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, name_ur, default_price, unit_id, stock_qty, is_tradeable")
        .eq("is_tradeable", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("kg_value");
      if (error) throw error;
      return data;
    },
  });

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal - discount + transportCharges;
  const balanceDue = total - amountPaid;

  useEffect(() => {
    if (paymentStatus === "paid") setAmountPaid(total);
    else if (paymentStatus === "credit") setAmountPaid(0);
  }, [paymentStatus, total]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), product_id: "", unit_id: "", quantity: 0, price_per_unit: 0, total: 0 },
    ]);
  };

  const updateItem = useCallback((id: string, updated: InvoiceItem) => {
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const generateInvoiceNumber = async (): Promise<string> => {
    const prefix = type === "sale" ? "SAL" : "PUR";
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("invoice_type", type)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].invoice_number.split("-")[1] || "0", 10);
      return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`;
    }
    return `${prefix}-0001`;
  };

  const handleSave = async () => {
    if (!contactId) {
      toast({ title: t("invoice.selectContact"), variant: "destructive" });
      return;
    }
    if (items.length === 0 || items.some((i) => !i.product_id || i.quantity <= 0)) {
      toast({ title: t("invoice.addItems"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const invoiceNumber = await generateInvoiceNumber();

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          invoice_type: type,
          contact_id: contactId,
          subtotal,
          discount,
          transport_charges: transportCharges,
          total,
          amount_paid: amountPaid,
          balance_due: balanceDue > 0 ? balanceDue : 0,
          payment_status: paymentStatus,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (invError) throw invError;

      // Insert line items
      const lineItems = items.map((i) => ({
        invoice_id: invoice.id,
        product_id: i.product_id,
        unit_id: i.unit_id || null,
        quantity: i.quantity,
        price_per_unit: i.price_per_unit,
        total: i.total,
      }));

      const { error: itemsError } = await supabase.from("invoice_items").insert(lineItems);
      if (itemsError) throw itemsError;

      // Update stock for each item
      for (const item of items) {
        const product = products?.find((p) => p.id === item.product_id);
        const unit = units?.find((u) => u.id === item.unit_id);
        if (!product || !unit) continue;

        const kgQty = item.quantity * unit.kg_value;
        const newStock = type === "sale" ? product.stock_qty - kgQty : product.stock_qty + kgQty;

        await supabase
          .from("products")
          .update({ stock_qty: Math.max(0, newStock) })
          .eq("id", item.product_id);

        // Log price change if different from default
        if (item.price_per_unit !== product.default_price) {
          const productUnit = units?.find((u) => u.id === product.unit_id);
          // Compare in same unit basis
          const defaultInItemUnit = productUnit && unit
            ? (product.default_price / productUnit.kg_value) * unit.kg_value
            : product.default_price;
          if (Math.abs(item.price_per_unit - defaultInItemUnit) > 0.01) {
            await supabase.from("price_history").insert({
              product_id: item.product_id,
              old_price: product.default_price,
              new_price: item.price_per_unit,
              changed_by: user?.id || null,
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: [type === "sale" ? "sales-invoices" : "purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-invoice"] });
      toast({ title: `${invoiceNumber} ${t("common.save")}` });
      onSuccess();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Contact selection */}
      <div className="space-y-1">
        <Label>{t("invoice.contact")}</Label>
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger>
            <SelectValue placeholder={t("invoice.selectContact")} />
          </SelectTrigger>
          <SelectContent>
            {contacts?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Line items header */}
      <div>
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-1">
          <span className="col-span-4">{t("products.name")}</span>
          <span className="col-span-2">{t("products.unit")}</span>
          <span className="col-span-2">{t("invoice.quantity")}</span>
          <span className="col-span-2">{t("invoice.price")}</span>
          <span className="col-span-2 text-end">{t("invoice.total")}</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <InvoiceItemRow
              key={item.id}
              item={item}
              products={products || []}
              units={units || []}
              onChange={(updated) => updateItem(item.id, updated)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" /> {t("invoice.addItem")}
        </Button>
      </div>

      <Separator />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Label>{t("invoice.subtotal")}</Label>
        <span className="text-end font-medium">₨ {subtotal.toLocaleString()}</span>

        <Label>{t("invoice.discount")}</Label>
        <Input type="number" min={0} className="h-8 text-sm" value={discount || ""} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />

        <Label>{t("invoice.transport")}</Label>
        <Input type="number" min={0} className="h-8 text-sm" value={transportCharges || ""} onChange={(e) => setTransportCharges(parseFloat(e.target.value) || 0)} />

        <Label className="font-bold">{t("invoice.total")}</Label>
        <span className="text-end font-bold text-lg">₨ {total.toLocaleString()}</span>
      </div>

      <Separator />

      {/* Payment */}
      <div className="space-y-2">
        <Label>{t("invoice.paymentMethod")}</Label>
        <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">{t("invoice.paid")}</SelectItem>
            <SelectItem value="partial">{t("invoice.partial")}</SelectItem>
            <SelectItem value="credit">{t("invoice.credit")}</SelectItem>
          </SelectContent>
        </Select>

        {paymentStatus === "partial" && (
          <div className="space-y-1">
            <Label>{t("invoice.amountPaid")}</Label>
            <Input type="number" min={0} max={total} className="h-9" value={amountPaid || ""} onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} />
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("invoice.balanceDue")}</span>
          <span className="font-bold text-destructive">₨ {Math.max(0, balanceDue).toLocaleString()}</span>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </div>
    </div>
  );
};

export default InvoiceForm;
