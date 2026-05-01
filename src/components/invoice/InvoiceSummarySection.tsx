import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { fmtAmount } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceType } from "@/hooks/useInvoiceForm";

interface Props {
  type: InvoiceType;
  notes: string;
  setNotes: (v: string) => void;
  paymentStatus: string;
  amountPaid: number;
  setAmountPaid: (v: number) => void;
  subtotal: number;
  discount: number;
  setDiscount: (v: number) => void;
  transportCharges: number;
  setTransportCharges: (v: number) => void;
  brokerCommissionTotal: number;
  brokerId: string;
  total: number;
  balanceDue: number;
}

export default function InvoiceSummarySection({
  type, notes, setNotes,
  paymentStatus, amountPaid, setAmountPaid,
  subtotal, discount, setDiscount,
  transportCharges, setTransportCharges,
  brokerCommissionTotal, brokerId,
  total, balanceDue,
}: Props) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Notes + partial payment (left) */}
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
          <span className="font-medium tabular-nums" dir="ltr">{fmtAmount(subtotal)}</span>
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
            <span className="font-medium tabular-nums text-orange-600 dark:text-orange-400" dir="ltr">
              {fmtAmount(brokerCommissionTotal)}
            </span>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-bold">{t("invoice.total")}</span>
          <span className="font-bold text-lg tabular-nums" dir="ltr">{fmtAmount(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("invoice.balanceDue")}</span>
          <span className={`font-bold tabular-nums ${balanceDue > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
            {fmtAmount(Math.max(0, balanceDue))}
          </span>
        </div>
      </div>
    </div>
  );
}
