import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageX } from "lucide-react";
import { fmtQty } from "@/lib/utils";

const InactiveProducts = () => {
  const { t, language } = useLanguage();

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name, name_ur, kg_value");
      return data || [];
    },
  });

  const getUnitDisplay = (unitId: string | null, stockQty: number) => {
    if (!unitId || !units) return { qty: stockQty, name: "KG" };
    const u = units.find(u => u.id === unitId);
    if (!u) return { qty: stockQty, name: "KG" };
    const kgValue = Number(u.kg_value) || 1;
    return {
      qty: stockQty / kgValue,
      name: language === "ur" && u.name_ur ? u.name_ur : u.name,
    };
  };

  const { data: products } = useQuery({
    queryKey: ["dashboard-inactive-products"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

      const { data: recentSales } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_type", "sale")
        .gte("invoice_date", cutoff);

      const recentIds = recentSales?.map(i => i.id) || [];

      let soldProductIds: string[] = [];
      if (recentIds.length > 0) {
        const { data: items } = await supabase
          .from("invoice_items")
          .select("product_id")
          .in("invoice_id", recentIds);
        soldProductIds = [...new Set(items?.map(i => i.product_id) || [])];
      }

      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, stock_qty, unit_id")
        .eq("is_tradeable", true);

      return (allProducts || [])
        .filter(p => !soldProductIds.includes(p.id))
        .slice(0, 10);
    },
  });

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10">
            <PackageX className="h-3.5 w-3.5 text-destructive" />
          </div>
          {t("dashboard.inactiveProducts")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!products?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {products.map(p => {
              const display = getUnitDisplay(p.unit_id, Number(p.stock_qty));
              return (
                <li key={p.id} className="flex justify-between items-center py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">{fmtQty(display.qty)} {display.name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default InactiveProducts;
