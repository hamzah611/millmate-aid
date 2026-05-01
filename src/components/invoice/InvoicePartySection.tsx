import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableCombobox from "@/components/SearchableCombobox";
import { getBusinessUnitFormOptions, BUSINESS_UNIT_UNASSIGNED } from "@/lib/business-units";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PaymentStatus } from "@/hooks/useInvoiceForm";

interface Contact {
  id: string;
  name: string;
  contact_type: string | null;
}

interface Props {
  contactId: string;
  setContactId: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  paymentStatus: PaymentStatus;
  setPaymentStatus: (v: PaymentStatus) => void;
  businessUnit: string;
  setBusinessUnit: (v: string) => void;
  contacts: Contact[] | undefined;
}

export default function InvoicePartySection({
  contactId, setContactId,
  invoiceDate, setInvoiceDate,
  paymentStatus, setPaymentStatus,
  businessUnit, setBusinessUnit,
  contacts,
}: Props) {
  const { t } = useLanguage();

  const contactOptions = (contacts || []).map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.contact_type || "",
  }));

  return (
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
        <div className="space-y-1">
          <Label className="text-xs">{t("businessUnit.label")}</Label>
          <Select value={businessUnit} onValueChange={setBusinessUnit}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("businessUnit.unassigned")} />
            </SelectTrigger>
            <SelectContent>
              {getBusinessUnitFormOptions(t).map((opt) => (
                <SelectItem key={opt.value || "unassigned"} value={opt.value || BUSINESS_UNIT_UNASSIGNED}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
