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
        .select("contact_id, total, contacts(name)")
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          <Users className="inline me-2 h-4 w-4 text-primary" />
          {t("dashboard.topCustomers")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!customers?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {customers.map((c, i) => (
              <li key={i} className="flex justify-between">
                <span>{c.name}</span>
                <span className="font-medium">₨ {c.total.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TopCustomers;
