import { useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ChevronRight } from "lucide-react";

interface ActivityItem {
  action: string;
  reference: string;
  date: string;
  link: string;
  amount?: number;
}

const RecentActivity = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const { data: activities } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: async () => {
      const items: ActivityItem[] = [];

      const { data: invoices } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_type, created_at, total")
        .order("created_at", { ascending: false })
        .limit(25);
      invoices?.forEach(i => items.push({
        action: i.invoice_type === "sale" ? t("dashboard.saleCreated") : t("dashboard.purchaseCreated"),
        reference: i.invoice_number,
        date: new Date(i.created_at).toLocaleDateString(),
        link: i.invoice_type === "sale" ? "/sales" : "/purchases",
        amount: i.total || undefined,
      }));

      const { data: payments } = await supabase
        .from("payments")
        .select("amount, payment_date, voucher_type, voucher_number, invoice_id, invoices(invoice_number, invoice_type)")
        .order("created_at", { ascending: false })
        .limit(10);
      payments?.forEach(p => {
        const isDirect = !p.invoice_id;
        const isReceipt = p.voucher_type === "receipt";
        let action: string;
        if (isDirect) {
          action = isReceipt ? t("dashboard.directReceiptVoucher") : t("dashboard.directPaymentVoucher");
        } else {
          action = isReceipt ? t("dashboard.receiptVoucherCreated") : t("dashboard.paymentVoucherCreated");
        }
        const ref = p.voucher_number
          ? `${p.voucher_number} → ₨${p.amount}`
          : `₨${p.amount} → ${(p.invoices as any)?.invoice_number || ""}`;
        items.push({
          action,
          reference: ref,
          date: p.payment_date,
          link: isReceipt ? "/receipt-vouchers" : "/payment-vouchers",
          amount: p.amount,
        });
      });

      const { data: adjs } = await supabase
        .from("inventory_adjustments")
        .select("adjustment_number, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      adjs?.forEach(a => items.push({
        action: t("dashboard.adjustmentCreated"),
        reference: a.adjustment_number,
        date: new Date(a.created_at).toLocaleDateString(),
        link: "/adjustments",
      }));

      const { data: exps } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .order("created_at", { ascending: false })
        .limit(10);
      exps?.forEach(e => items.push({
        action: t("dashboard.expenseCreated"),
        reference: `₨${e.amount}`,
        date: e.expense_date,
        link: "/expenses",
        amount: e.amount,
      }));

      return items
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 25);
    },
  });

  const visible = expanded ? activities : activities?.slice(0, 10);

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-2/15">
            <Activity className="h-3.5 w-3.5 text-chart-2" />
          </div>
          {t("dashboard.recentActivity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activities?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <>
            <ul className="space-y-0.5 text-sm">
              {visible?.map((a, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(a.link)}
                >
                  <span className="truncate">
                    {a.action} — <span className="font-medium">{a.reference}</span>
                    {a.amount != null && (
                      <span className="text-muted-foreground ml-1 text-xs">({fmtAmount(a.amount)})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap text-xs">
                    {a.date}
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </li>
              ))}
            </ul>
            {activities.length > 10 ? (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setExpanded(!expanded)}>
                {expanded ? t("common.showLess") : t("common.showMore")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground" onClick={() => setExpanded(!expanded)}>
                {t("dashboard.recentActivity")} ({activities.length})
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
