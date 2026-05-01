import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInvoiceForm } from "@/hooks/useInvoiceForm";
import InvoicePartySection from "@/components/invoice/InvoicePartySection";
import InvoiceBrokerSection from "@/components/invoice/InvoiceBrokerSection";
import InvoiceItemsSection from "@/components/invoice/InvoiceItemsSection";
import InvoiceSummarySection from "@/components/invoice/InvoiceSummarySection";

type InvoiceType = "sale" | "purchase";

interface Props {
  type: InvoiceType;
  editInvoiceId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const InvoiceForm = ({ type, editInvoiceId, onSuccess, onCancel }: Props) => {
  const { t } = useLanguage();
  const form = useInvoiceForm({ type, editInvoiceId, onSuccess, onCancel });

  return (
    <div className="space-y-5">
      <InvoicePartySection
        contactId={form.contactId}
        setContactId={form.setContactId}
        invoiceDate={form.invoiceDate}
        setInvoiceDate={form.setInvoiceDate}
        paymentStatus={form.paymentStatus}
        setPaymentStatus={form.setPaymentStatus}
        businessUnit={form.businessUnit}
        setBusinessUnit={form.setBusinessUnit}
        contacts={form.contacts}
      />

      <InvoiceBrokerSection
        type={type}
        brokerId={form.brokerId}
        setBrokerId={form.setBrokerId}
        brokerCommissionRate={form.brokerCommissionRate}
        setBrokerCommissionRate={form.setBrokerCommissionRate}
        brokerCommissionUnitId={form.brokerCommissionUnitId}
        setBrokerCommissionUnitId={form.setBrokerCommissionUnitId}
        brokerCommissionTotal={form.brokerCommissionTotal}
        contacts={form.contacts}
        units={form.units}
      />

      <Separator />

      <InvoiceItemsSection
        type={type}
        items={form.items}
        addItem={form.addItem}
        updateItem={form.updateItem}
        removeItem={form.removeItem}
        products={form.products}
        units={form.units}
        lastAddedItemId={form.lastAddedItemId}
        itemsEndRef={form.itemsEndRef}
      />

      <Separator />

      <InvoiceSummarySection
        type={type}
        notes={form.notes}
        setNotes={form.setNotes}
        paymentStatus={form.paymentStatus}
        amountPaid={form.amountPaid}
        setAmountPaid={form.setAmountPaid}
        subtotal={form.subtotal}
        discount={form.discount}
        setDiscount={form.setDiscount}
        transportCharges={form.transportCharges}
        setTransportCharges={form.setTransportCharges}
        brokerCommissionTotal={form.brokerCommissionTotal}
        brokerId={form.brokerId}
        total={form.total}
        balanceDue={form.balanceDue}
      />

      <Separator />

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-muted-foreground hidden md:block">
          Ctrl+S {t("common.save")} · Esc {t("common.cancel")}
        </p>
        <div className="flex gap-2 ms-auto">
          <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button onClick={form.handleSave} disabled={form.saving} className="gap-2">
            <Save className="h-4 w-4" />
            {form.saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceForm;
