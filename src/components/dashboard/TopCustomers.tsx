import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

const TopCustomers = () => {
  const { t } = useLanguage();

  const { data: customers } = useQuery({
    queryKey: ["dashboard-top-customers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("contact_id, total, contacts!invoices_contact_id_fkey(name)")
        .eq("invoice_type", "sale");
      if (!data) return [];

      const map: Record<string, { name: string; total: number }> = {};
      data.forEach(inv => {
        const cid = inv.contact_id;
        if (!map[cid]) map[cid] = { name: (inv.contacts as any)?.name || "?", total: 0 };
        map[cid].total += inv.total || 0;
      });

      return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
    },
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-4/15">
            <Users className="h-3.5 w-3.5 text-chart-4" />
          </div>
          {t("dashboard.topCustomers")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!customers?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {customers.map((c, i) => (
              <li key={i} className="flex justify-between items-center py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                  {c.name}
                </span>
                <span className="font-medium font-mono text-xs">₨ {c.total.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TopCustomers;
