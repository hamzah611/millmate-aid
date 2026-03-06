import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface ActivityItem {
  action: string;
  reference: string;
  date: string;
}

const RecentActivity = () => {
  const { t } = useLanguage();

  const { data: activities } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: async () => {
      const items: ActivityItem[] = [];

      // Sales & Purchases
      const { data: invoices } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_type, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      invoices?.forEach(i => items.push({
        action: i.invoice_type === "sale" ? t("dashboard.saleCreated") : t("dashboard.purchaseCreated"),
        reference: i.invoice_number,
        date: new Date(i.created_at).toLocaleDateString(),
      }));

      // Payments
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, payment_date, invoices(invoice_number)")
        .order("created_at", { ascending: false })
        .limit(5);
      payments?.forEach(p => items.push({
        action: t("dashboard.paymentRecorded"),
        reference: `₨${p.amount} → ${(p.invoices as any)?.invoice_number || ""}`,
        date: p.payment_date,
      }));

      // Adjustments
      const { data: adjs } = await supabase
        .from("inventory_adjustments")
        .select("adjustment_number, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      adjs?.forEach(a => items.push({
        action: t("dashboard.adjustmentCreated"),
        reference: a.adjustment_number,
        date: new Date(a.created_at).toLocaleDateString(),
      }));

      // Expenses
      const { data: exps } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .order("created_at", { ascending: false })
        .limit(5);
      exps?.forEach(e => items.push({
        action: t("dashboard.expenseCreated"),
        reference: `₨${e.amount}`,
        date: e.expense_date,
      }));

      // Sort by date desc, take 10
      return items
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          <Activity className="inline me-2 h-4 w-4 text-primary" />
          {t("dashboard.recentActivity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activities?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activities.map((a, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{a.action} — <span className="font-medium">{a.reference}</span></span>
                <span className="text-muted-foreground whitespace-nowrap">{a.date}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
