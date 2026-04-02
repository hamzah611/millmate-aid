import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

interface ActivityItem {
  action: string;
  reference: string;
  date: string;
}

const RecentActivity = () => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const { data: activities } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: async () => {
      const items: ActivityItem[] = [];

      const { data: invoices } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_type, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      invoices?.forEach(i => items.push({
        action: i.invoice_type === "sale" ? t("dashboard.saleCreated") : t("dashboard.purchaseCreated"),
        reference: i.invoice_number,
        date: new Date(i.created_at).toLocaleDateString(),
      }));

      const { data: payments } = await supabase
        .from("payments")
        .select("amount, payment_date, invoices(invoice_number)")
        .order("created_at", { ascending: false })
        .limit(10);
      payments?.forEach(p => items.push({
        action: t("dashboard.paymentRecorded"),
        reference: `₨${p.amount} → ${(p.invoices as any)?.invoice_number || ""}`,
        date: p.payment_date,
      }));

      const { data: adjs } = await supabase
        .from("inventory_adjustments")
        .select("adjustment_number, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      adjs?.forEach(a => items.push({
        action: t("dashboard.adjustmentCreated"),
        reference: a.adjustment_number,
        date: new Date(a.created_at).toLocaleDateString(),
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
      }));

      return items
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 25);
    },
  });

  const visible = expanded ? activities : activities?.slice(0, 10);

  return (
    <Card className="shadow-sm">
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
                <li key={i} className="flex justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="truncate">{a.action} — <span className="font-medium">{a.reference}</span></span>
                  <span className="text-muted-foreground whitespace-nowrap text-xs">{a.date}</span>
                </li>
              ))}
            </ul>
            {activities.length > 10 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setExpanded(!expanded)}>
                {expanded ? t("common.showLess") : t("common.showMore")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
