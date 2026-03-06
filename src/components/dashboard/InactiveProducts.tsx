import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageX } from "lucide-react";

const InactiveProducts = () => {
  const { t } = useLanguage();

  const { data: products } = useQuery({
    queryKey: ["dashboard-inactive-products"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

      // Get all sale invoices in last 30 days
      const { data: recentSales } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_type", "sale")
        .gte("invoice_date", cutoff);

      const recentIds = recentSales?.map(i => i.id) || [];

      // Get products that had sales recently
      let soldProductIds: string[] = [];
      if (recentIds.length > 0) {
        const { data: items } = await supabase
          .from("invoice_items")
          .select("product_id")
          .in("invoice_id", recentIds);
        soldProductIds = [...new Set(items?.map(i => i.product_id) || [])];
      }

      // Get all tradeable products
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, stock_qty")
        .eq("is_tradeable", true);

      return (allProducts || [])
        .filter(p => !soldProductIds.includes(p.id))
        .slice(0, 10);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          <PackageX className="inline me-2 h-4 w-4 text-destructive" />
          {t("dashboard.inactiveProducts")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!products?.length ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {products.map(p => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-muted-foreground">{p.stock_qty} KG</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default InactiveProducts;
