import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import InvoiceItemRow, { type InvoiceItem } from "./InvoiceItemRow";
import SearchableCombobox from "./SearchableCombobox";
import { Plus, Package, Save } from "lucide-react";

type InvoiceType = "sale" | "purchase";
type PaymentStatus = "paid" | "partial" | "credit";

interface Props {
  type: InvoiceType;
  onSuccess: () => void;
  onCancel: () => void;
}

const InvoiceForm = ({ type, onSuccess, onCancel }: Props) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const itemsEndRef = useRef<HTMLDivElement>(null);
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  const [contactId, setContactId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
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

  // Keyboard shortcut: Ctrl+S to save, Escape to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [contactId, items, discount, transportCharges, paymentStatus, amountPaid, saving]);

  const addItem = useCallback(() => {
    const newId = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      { id: newId, product_id: "", unit_id: "", quantity: 0, price_per_unit: 0, total: 0 },
    ]);
    setLastAddedItemId(newId);
    // Scroll to new item
    setTimeout(() => itemsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
  }, []);

  const updateItem = useCallback((id: string, updated: InvoiceItem) => {
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const contactOptions = (contacts || []).map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.contact_type === "both" ? t("contacts.both") : c.contact_type === "customer" ? t("contacts.customer") : t("contacts.supplier"),
  }));

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
    if (saving) return;
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
          invoice_date: invoiceDate,
          notes: notes || null,
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

        if (item.price_per_unit !== product.default_price) {
          const productUnit = units?.find((u) => u.id === product.unit_id);
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
    <div className="space-y-6">
      {/* ── SECTION: Party & Date ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t("invoice.partySection")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t("invoice.contact")}</Label>
            <SearchableCombobox
              value={contactId}
              onValueChange={setContactId}
              options={contactOptions}
              placeholder={t("invoice.selectContact")}
              searchPlaceholder={t("invoice.searchContact")}
              emptyText={t("invoice.noContact")}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoice.invoiceDate")}</Label>
            <Input
              type="date"
              className="h-10"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── SECTION: Items ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("invoice.itemsSection")}
          </h3>
          {items.length > 0 && (
            <Badge variant="outline" className="text-xs tabular-nums">
              {items.length} {items.length === 1 ? "item" : "items"}
            </Badge>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-lg border-2 border-dashed border-border bg-muted/30">
            <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("invoice.emptyItems")}</p>
            <p className="text-xs text-muted-foreground/70 mb-4">{t("invoice.emptyItemsHint")}</p>
            <Button variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <InvoiceItemRow
                key={item.id}
                item={item}
                index={idx}
                products={products || []}
                units={units || []}
                invoiceType={type}
                onChange={(updated) => updateItem(item.id, updated)}
                onRemove={() => removeItem(item.id)}
                onAddNext={addItem}
                autoFocusProduct={item.id === lastAddedItemId}
              />
            ))}
            <div ref={itemsEndRef} />
            <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
              <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* ── SECTION: Summary ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t("invoice.summarySection")}
        </h3>
        <div className="max-w-sm ms-auto space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("invoice.subtotal")}</span>
            <span className="font-medium tabular-nums" dir="ltr">₨ {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-muted-foreground shrink-0">{t("invoice.discount")}</span>
            <Input
              type="number"
              min={0}
              className="h-8 text-sm w-32 text-end"
              value={discount || ""}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>

          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-muted-foreground shrink-0">{t("invoice.transport")}</span>
            <Input
              type="number"
              min={0}
              className="h-8 text-sm w-32 text-end"
              value={transportCharges || ""}
              onChange={(e) => setTransportCharges(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="font-bold">{t("invoice.total")}</span>
            <span className="font-bold text-lg tabular-nums" dir="ltr">₨ {total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── SECTION: Payment ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t("invoice.paymentSection")}
        </h3>
        <div className="max-w-sm ms-auto space-y-3">
          <div className="space-y-1.5">
            <Label>{t("invoice.paymentMethod")}</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">{t("invoice.paid")}</SelectItem>
                <SelectItem value="partial">{t("invoice.partial")}</SelectItem>
                <SelectItem value="credit">{t("invoice.credit")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentStatus === "partial" && (
            <div className="space-y-1.5">
              <Label>{t("invoice.amountPaid")}</Label>
              <Input
                type="number"
                min={0}
                max={total}
                className="h-10 text-end"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="flex justify-between text-sm pt-1">
            <span className="text-muted-foreground">{t("invoice.balanceDue")}</span>
            <span className={`font-bold tabular-nums ${balanceDue > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
              ₨ {Math.max(0, balanceDue).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Notes ── */}
      <div className="space-y-1.5">
        <Label>{t("invoice.notes")}</Label>
        <Textarea
          className="min-h-[60px] text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("invoice.notesPlaceholder")}
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground hidden md:block">
          Ctrl+S {t("common.save")} · Esc {t("common.cancel")}
        </p>
        <div className="flex gap-2 ms-auto">
          <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceForm;
