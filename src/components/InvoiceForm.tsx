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
import { getBusinessUnitFormOptions } from "@/lib/business-units";

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

  // Broker state (purchase only)
  const [brokerId, setBrokerId] = useState("");
  const [brokerCommissionRate, setBrokerCommissionRate] = useState(0);
  const [brokerCommissionUnitId, setBrokerCommissionUnitId] = useState("");
  const [brokerCommissionTotal, setBrokerCommissionTotal] = useState(0);

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

  // Brokers for purchase
  const { data: brokers } = useQuery({
    queryKey: ["broker-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, contact_type")
        .in("contact_type", ["broker", "both"])
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: type === "purchase",
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

  // Auto-calculate broker commission
  useEffect(() => {
    if (type !== "purchase" || !brokerId || !brokerCommissionRate || !brokerCommissionUnitId) {
      setBrokerCommissionTotal(0);
      return;
    }
    const commUnit = units?.find((u) => u.id === brokerCommissionUnitId);
    if (!commUnit) return;
    // Sum total KG across all items, then convert to commission unit
    const totalKg = items.reduce((sum, item) => {
      const itemUnit = units?.find((u) => u.id === item.unit_id);
      return sum + (item.quantity * (itemUnit?.kg_value || 1));
    }, 0);
    const totalInCommUnit = totalKg / commUnit.kg_value;
    setBrokerCommissionTotal(Math.round(brokerCommissionRate * totalInCommUnit * 100) / 100);
  }, [brokerId, brokerCommissionRate, brokerCommissionUnitId, items, units, type]);

  useEffect(() => {
    if (paymentStatus === "paid") setAmountPaid(total);
    else if (paymentStatus === "credit") setAmountPaid(0);
  }, [paymentStatus, total]);

  // Keep a ref to the latest handleSave to avoid stale closures in keyboard shortcut
  const handleSaveRef = useRef<() => void>(() => {});

  // Keyboard shortcut: Ctrl+S to save, Escape to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const addItem = useCallback(() => {
    const newId = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      { id: newId, product_id: "", unit_id: "", quantity: 0, price_per_unit: 0, total: 0 },
    ]);
    setLastAddedItemId(newId);
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

  const brokerOptions = (brokers || []).map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.contact_type === "both" ? t("contacts.both") : t("contacts.broker"),
  }));

  const generateInvoiceNumber = async (): Promise<string> => {
    const prefix = type === "sale" ? "SAL" : "PUR";
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("invoice_type", type)
      .order("created_at", { ascending: false })
      .limit(1);
    let nextNum = 1;
    if (data && data.length > 0) {
      nextNum = parseInt(data[0].invoice_number.split("-")[1] || "0", 10) + 1;
    }
    // Check for existing number and increment if needed (handles race conditions)
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${prefix}-${String(nextNum).padStart(4, "0")}`;
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_type", type)
        .eq("invoice_number", candidate)
        .limit(1);
      if (!existing?.length) return candidate;
      nextNum++;
    }
    return `${prefix}-${String(nextNum).padStart(4, "0")}`;
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

      const invoiceData: any = {
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
      };

      // Add broker fields for purchase
      if (type === "purchase" && brokerId) {
        invoiceData.broker_contact_id = brokerId;
        invoiceData.broker_commission_rate = brokerCommissionRate;
        invoiceData.broker_commission_unit_id = brokerCommissionUnitId || null;
        invoiceData.broker_commission_total = brokerCommissionTotal;
      }

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert(invoiceData)
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
        const unit = units?.find((u) => u.id === item.unit_id);
        if (!unit) continue;

        // Fresh read of current stock to avoid stale data
        const { data: freshProduct } = await supabase
          .from("products")
          .select("stock_qty, default_price")
          .eq("id", item.product_id)
          .single();
        if (!freshProduct) continue;

        const kgQty = item.quantity * unit.kg_value;
        const newStock = type === "sale" ? freshProduct.stock_qty - kgQty : freshProduct.stock_qty + kgQty;

        await supabase
          .from("products")
          .update({ stock_qty: Math.max(0, newStock) })
          .eq("id", item.product_id);
        
        const product = products?.find((p) => p.id === item.product_id);

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

  // Update ref after handleSave is defined
  useEffect(() => { handleSaveRef.current = handleSave; });

  return (
    <div className="space-y-5">
      {/* ── SECTION: Party & Date — horizontal on desktop ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t("invoice.partySection")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("invoice.contact")}</Label>
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
          <div className="space-y-1">
            <Label className="text-xs">{t("invoice.invoiceDate")}</Label>
            <Input
              type="date"
              className="h-9"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("invoice.paymentMethod")}</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">{t("invoice.paid")}</SelectItem>
                <SelectItem value="partial">{t("invoice.partial")}</SelectItem>
                <SelectItem value="credit">{t("invoice.credit")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Broker Section (Purchase only) ── */}
      {type === "purchase" && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("invoice.brokerSection")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("invoice.broker")}</Label>
              <SearchableCombobox
                value={brokerId}
                onValueChange={setBrokerId}
                options={brokerOptions}
                placeholder={t("invoice.selectBroker")}
                searchPlaceholder={t("invoice.searchBroker")}
                emptyText={t("invoice.noBroker")}
              />
            </div>
            {brokerId && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">{t("invoice.commissionRate")}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="h-9 text-sm"
                    value={brokerCommissionRate || ""}
                    onChange={(e) => setBrokerCommissionRate(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("invoice.commissionUnit")}</Label>
                  <Select value={brokerCommissionUnitId} onValueChange={setBrokerCommissionUnitId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t("products.unit")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(units || []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {language === "ur" && u.name_ur ? u.name_ur : u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("invoice.commissionTotal")}</Label>
                  <div className="h-9 flex items-center text-sm font-semibold tabular-nums" dir="ltr">
                    ₨ {brokerCommissionTotal.toLocaleString()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
          <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-border bg-muted/30">
            <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">{t("invoice.emptyItems")}</p>
            <p className="text-xs text-muted-foreground/70 mb-3">{t("invoice.emptyItemsHint")}</p>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Desktop header row */}
            <div className="hidden md:grid gap-2 text-xs font-medium text-muted-foreground pb-1 border-b border-border grid-cols-[2fr_1fr_0.7fr_0.7fr_1fr_1fr_auto]">
              <span>{t("products.name")}</span>
              <span>{t("products.unit")}</span>
              <span>{t("invoice.quantity")}</span>
              <span>{t("invoice.subQty")}</span>
              <span>{t("invoice.price")}</span>
              <span className="text-end">{t("invoice.total")}</span>
              <span className="w-9"></span>
            </div>

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
                showLabels={false}
              />
            ))}
            <div ref={itemsEndRef} />
            <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed mt-2">
              <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* ── SECTION: Summary + Payment side by side on desktop ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes + Payment (left) */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{t("invoice.notes")}</Label>
            <Textarea
              className="min-h-[60px] text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("invoice.notesPlaceholder")}
            />
          </div>

          {paymentStatus === "partial" && (
            <div className="space-y-1">
              <Label className="text-xs">{t("invoice.amountPaid")}</Label>
              <Input
                type="number"
                min={0}
                max={total}
                className="h-9 text-end text-sm"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        {/* Summary (right) */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("invoice.summarySection")}
          </h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("invoice.subtotal")}</span>
            <span className="font-medium tabular-nums" dir="ltr">₨ {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-muted-foreground shrink-0">{t("invoice.discount")}</span>
            <Input
              type="number"
              min={0}
              className="h-8 text-sm w-28 text-end"
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
              className="h-8 text-sm w-28 text-end"
              value={transportCharges || ""}
              onChange={(e) => setTransportCharges(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>

          {type === "purchase" && brokerId && brokerCommissionTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("invoice.commissionTotal")}</span>
              <span className="font-medium tabular-nums text-orange-600 dark:text-orange-400" dir="ltr">₨ {brokerCommissionTotal.toLocaleString()}</span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <span className="font-bold">{t("invoice.total")}</span>
            <span className="font-bold text-lg tabular-nums" dir="ltr">₨ {total.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("invoice.balanceDue")}</span>
            <span className={`font-bold tabular-nums ${balanceDue > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
              ₨ {Math.max(0, balanceDue).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-1">
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
