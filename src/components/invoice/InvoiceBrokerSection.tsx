import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableCombobox from "@/components/SearchableCombobox";
import { fmtAmount } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceType } from "@/hooks/useInvoiceForm";

interface Contact {
  id: string;
  name: string;
  contact_type: string | null;
}

interface Unit {
  id: string;
  name: string;
  name_ur: string | null;
  kg_value: number;
}

interface Props {
  type: InvoiceType;
  brokerId: string;
  setBrokerId: (v: string) => void;
  brokerCommissionRate: number;
  setBrokerCommissionRate: (v: number) => void;
  brokerCommissionUnitId: string;
  setBrokerCommissionUnitId: (v: string) => void;
  brokerCommissionTotal: number;
  contacts: Contact[] | undefined;
  units: Unit[] | undefined;
}

export default function InvoiceBrokerSection({
  type, brokerId, setBrokerId,
  brokerCommissionRate, setBrokerCommissionRate,
  brokerCommissionUnitId, setBrokerCommissionUnitId,
  brokerCommissionTotal, contacts, units,
}: Props) {
  const { t, language } = useLanguage();

  if (type !== "purchase") return null;

  const brokerOptions = (contacts || []).map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.contact_type || "",
  }));

  return (
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
                {fmtAmount(brokerCommissionTotal)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
