import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { type InvoiceItem } from "@/components/InvoiceItemRow";
import { BUSINESS_UNIT_UNASSIGNED } from "@/lib/business-units";

export type InvoiceType = "sale" | "purchase";
export type PaymentStatus = "paid" | "partial" | "credit";

export interface InvoicePayload {
  contact_id: string;
  invoice_date: string;
  notes: string | null;
  subtotal: number;
  discount: number;
  transport_charges: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: string;
  business_unit: string | null;
  broker_contact_id?: string | null;
  broker_commission_rate?: number;
  broker_commission_unit_id?: string | null;
  broker_commission_total?: number;
  // create-only fields
  invoice_number?: string;
  invoice_type?: string;
  created_by?: string | null;
}

interface UseInvoiceFormProps {
  type: InvoiceType;
  editInvoiceId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function useInvoiceForm({ type, editInvoiceId, onSuccess, onCancel }: UseInvoiceFormProps) {
  const { t } = useLanguage();
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
  const [businessUnit, setBusinessUnit] = useState(BUSINESS_UNIT_UNASSIGNED);

  const [brokerId, setBrokerId] = useState("");
  const [brokerCommissionRate, setBrokerCommissionRate] = useState(0);
  const [brokerCommissionUnitId, setBrokerCommissionUnitId] = useState("");
  const [brokerCommissionTotal, setBrokerCommissionTotal] = useState(0);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, contact_type")
        .order("name");
      if (error) throw error;
      return data || [];
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

  const [editLoaded, setEditLoaded] = useState(false);
  const { data: editInvoice } = useQuery({
    queryKey: ["edit-invoice", editInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("id", editInvoiceId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!editInvoiceId,
  });
  const { data: editItems } = useQuery({
    queryKey: ["edit-invoice-items", editInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", editInvoiceId!);
      if (error) throw error;
      return data;
    },
    enabled: !!editInvoiceId,
  });

  useEffect(() => {
    if (editInvoice && editItems && !editLoaded) {
      setContactId(editInvoice.contact_id);
      setInvoiceDate(editInvoice.invoice_date);
      setNotes(editInvoice.notes || "");
      setDiscount(editInvoice.discount);
      setTransportCharges(editInvoice.transport_charges);
      setBusinessUnit(editInvoice.business_unit || BUSINESS_UNIT_UNASSIGNED);
      if (editInvoice.balance_due <= 0) setPaymentStatus("paid");
      else if (editInvoice.amount_paid > 0) setPaymentStatus("partial");
      else setPaymentStatus("credit");
      setAmountPaid(editInvoice.amount_paid);
      if (editInvoice.broker_contact_id) {
        setBrokerId(editInvoice.broker_contact_id);
        setBrokerCommissionRate(editInvoice.broker_commission_rate || 0);
        setBrokerCommissionUnitId(editInvoice.broker_commission_unit_id || "");
        setBrokerCommissionTotal(editInvoice.broker_commission_total || 0);
      }
      setItems(editItems.map(i => ({
        id: i.id,
        product_id: i.product_id,
        unit_id: i.unit_id || "",
        quantity: i.quantity,
        price_per_unit: i.price_per_unit,
        total: i.total,
      })));
      setEditLoaded(true);
    }
  }, [editInvoice, editItems, editLoaded]);

  const subtotal = Math.round(items.reduce((sum, i) => sum + i.total, 0));
  const total = Math.round(subtotal - discount + transportCharges);
  const balanceDue = Math.round(total - amountPaid);

  useEffect(() => {
    if (type !== "purchase" || !brokerId || !brokerCommissionRate || !brokerCommissionUnitId) {
      if (!editInvoiceId || editLoaded) setBrokerCommissionTotal(0);
      return;
    }
    const commUnit = units?.find((u) => u.id === brokerCommissionUnitId);
    if (!commUnit) return;
    const totalKg = items.reduce((sum, item) => {
      const itemUnit = units?.find((u) => u.id === item.unit_id);
      return sum + (item.quantity * (itemUnit?.kg_value || 1));
    }, 0);
    const totalInCommUnit = totalKg / commUnit.kg_value;
    setBrokerCommissionTotal(Math.round(brokerCommissionRate * totalInCommUnit));
  }, [brokerId, brokerCommissionRate, brokerCommissionUnitId, items, units, type]);

  useEffect(() => {
    if (editInvoiceId && !editLoaded) return;
    if (paymentStatus === "paid") setAmountPaid(Math.round(total));
    else if (paymentStatus === "credit") setAmountPaid(0);
  }, [paymentStatus, total]);

  const handleSaveRef = useRef<() => void>(() => {});

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
      const isEdit = !!editInvoiceId;

      let isFixedAsset = false;
      if (type === "purchase") {
        const { data: contactData } = await supabase
          .from("contacts")
          .select("account_category")
          .eq("id", contactId)
          .single();
        isFixedAsset = contactData?.account_category === "fixed_asset";
      }

      // ── EDIT: call RPC to reverse old stock (before deleting old items) ──
      if (isEdit && !isFixedAsset) {
        const { error: stockReverseErr } = await (supabase.rpc as any)("process_invoice_stock", {
          p_invoice_id: editInvoiceId,
          p_invoice_type: type,
          p_is_edit: true,
          p_items: items.map(i => ({
            product_id: i.product_id,
            unit_id: i.unit_id || null,
            quantity: i.quantity,
            price_per_unit: i.price_per_unit,
            total: i.total,
          })),
          p_user_id: user?.id || null,
        });
        if (stockReverseErr) throw stockReverseErr;
      }

      let invoiceId: string;
      let invoiceNumber: string;

      if (isEdit) {
        const { data: linkedPayments } = await supabase.from("payments").select("amount").eq("invoice_id", editInvoiceId);
        const actualPaid = linkedPayments?.reduce((s, p) => s + Number(p.amount), 0) || 0;
        const editBalanceDue = Math.max(0, total - actualPaid);
        const editStatus = editBalanceDue <= 0 ? "paid" : actualPaid > 0 ? "partial" : "credit";

        const invoiceData: InvoicePayload = {
          contact_id: contactId,
          invoice_date: invoiceDate,
          notes: notes || null,
          subtotal,
          discount,
          transport_charges: transportCharges,
          total,
          amount_paid: actualPaid,
          balance_due: editBalanceDue,
          payment_status: editStatus,
          business_unit: businessUnit === BUSINESS_UNIT_UNASSIGNED ? null : businessUnit || null,
        };
        if (type === "purchase" && brokerId) {
          invoiceData.broker_contact_id = brokerId;
          invoiceData.broker_commission_rate = brokerCommissionRate;
          invoiceData.broker_commission_unit_id = brokerCommissionUnitId || null;
          invoiceData.broker_commission_total = brokerCommissionTotal;
        } else if (type === "purchase") {
          invoiceData.broker_contact_id = null;
          invoiceData.broker_commission_rate = 0;
          invoiceData.broker_commission_unit_id = null;
          invoiceData.broker_commission_total = 0;
        }

        const { error: updErr } = await supabase.from("invoices").update(invoiceData as any).eq("id", editInvoiceId);
        if (updErr) throw updErr;

        await supabase.from("invoice_items").delete().eq("invoice_id", editInvoiceId);
        invoiceId = editInvoiceId;
        invoiceNumber = editInvoice?.invoice_number || "";
      } else {
        const { data: nextNum, error: numErr } = await (supabase.rpc as any)("get_next_invoice_number", {
          p_invoice_type: type,
        });
        if (numErr) throw numErr;
        invoiceNumber = nextNum as string;

        const invoiceData: InvoicePayload = {
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
          business_unit: businessUnit === BUSINESS_UNIT_UNASSIGNED ? null : businessUnit || null,
        };
        if (type === "purchase" && brokerId) {
          invoiceData.broker_contact_id = brokerId;
          invoiceData.broker_commission_rate = brokerCommissionRate;
          invoiceData.broker_commission_unit_id = brokerCommissionUnitId || null;
          invoiceData.broker_commission_total = brokerCommissionTotal;
        }
        const { data: invoice, error: invError } = await supabase.from("invoices").insert(invoiceData as any).select("id").single();
        if (invError) throw invError;
        invoiceId = invoice.id;
      }

      const lineItems = items.map((i) => ({
        invoice_id: invoiceId,
        product_id: i.product_id,
        unit_id: i.unit_id || null,
        quantity: i.quantity,
        price_per_unit: i.price_per_unit,
        total: i.total,
      }));

      const { error: itemsError } = await supabase.from("invoice_items").insert(lineItems);
      if (itemsError) throw itemsError;

      if (!isEdit && amountPaid > 0) {
        await supabase.from("payments").insert({
          invoice_id: invoiceId,
          amount: amountPaid,
          payment_date: invoiceDate,
          contact_id: contactId,
          voucher_type: type === "sale" ? "receipt" : "payment",
          payment_method: "cash",
          notes: `Auto-generated from ${invoiceNumber}`,
        });
      }

      // Apply stock for new invoices (edit reversal + new stock was handled by RPC above)
      if (!isEdit && !isFixedAsset) {
        const { error: stockErr } = await (supabase.rpc as any)("process_invoice_stock", {
          p_invoice_id: invoiceId,
          p_invoice_type: type,
          p_is_edit: false,
          p_items: items.map(i => ({
            product_id: i.product_id,
            unit_id: i.unit_id || null,
            quantity: i.quantity,
            price_per_unit: i.price_per_unit,
            total: i.total,
          })),
          p_user_id: user?.id || null,
        });
        if (stockErr) throw stockErr;
      }

      queryClient.invalidateQueries({ queryKey: [type === "sale" ? "sales-invoices" : "purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-invoice"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: `${invoiceNumber} ${t("common.save")}` });
      onSuccess();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { handleSaveRef.current = handleSave; });

  return {
    // state
    contactId, setContactId,
    invoiceDate, setInvoiceDate,
    notes, setNotes,
    items,
    discount, setDiscount,
    transportCharges, setTransportCharges,
    paymentStatus, setPaymentStatus,
    amountPaid, setAmountPaid,
    businessUnit, setBusinessUnit,
    brokerId, setBrokerId,
    brokerCommissionRate, setBrokerCommissionRate,
    brokerCommissionUnitId, setBrokerCommissionUnitId,
    brokerCommissionTotal,
    saving,
    // derived
    subtotal, total, balanceDue,
    // actions
    addItem, updateItem, removeItem, handleSave,
    // data
    contacts, products, units,
    lastAddedItemId, itemsEndRef,
  };
}
