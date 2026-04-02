import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Factory, Plus, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";

const Production = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name, name_ur");
      return data || [];
    },
  });

  const getUnitName = (unitId: string | null) => {
    if (!unitId || !units) return "";
    const u = units.find(u => u.id === unitId);
    if (!u) return "";
    return language === "ur" && u.name_ur ? u.name_ur : u.name;
  };

  const { data: productions, isLoading } = useQuery({
    queryKey: ["productions"],
    queryFn: async () => {
      const { data: prods, error } = await supabase
        .from("productions")
        .select("*, production_outputs(quantity, product_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!prods?.length) return [];

      const productIds = new Set<string>();
      prods.forEach(p => {
        productIds.add(p.source_product_id);
        (p.production_outputs as any[])?.forEach((o: any) => productIds.add(o.product_id));
      });

      const { data: products } = await supabase
        .from("products")
        .select("id, name, unit_id")
        .in("id", Array.from(productIds));
      const productMap = new Map(products?.map(p => [p.id, p]) || []);

      return prods.map(p => {
        const srcProduct = productMap.get(p.source_product_id);
        return {
          ...p,
          source_product_name: srcProduct?.name || "—",
          source_unit_id: srcProduct?.unit_id || null,
          production_outputs: (p.production_outputs as any[])?.map((o: any) => {
            const outProduct = productMap.get(o.product_id);
            return {
              ...o,
              product_name: outProduct?.name || "—",
              unit_id: outProduct?.unit_id || null,
            };
          }) || [],
        };
      });
    },
  });

  const handleExport = () => {
    if (!productions?.length) return;
    exportToCSV("production", ["Date", "Source Product", "Source Qty", "Outputs"],
      productions.map(p => [
        new Date(p.production_date + "T00:00:00").toLocaleDateString(),
        (p as any).source_product_name,
        `${p.source_quantity} ${getUnitName((p as any).source_unit_id)}`,
        (p.production_outputs as any[])?.map((o: any) => `${o.product_name}: ${o.quantity} ${getUnitName(o.unit_id)}`).join(", ") || "",
      ]));
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/15">
            <Factory className="h-4.5 w-4.5 text-chart-4" />
          </div>
          <div>
            <h1 className="page-title">{t("nav.production")}</h1>
            {productions && <p className="page-subtitle">{productions.length} records</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!productions?.length}>
            <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/production/new")}>
            <Plus className="me-2 h-4 w-4" />{t("production.create")}
          </Button>
        </div>
      </div>

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-chart-4/5 hover:bg-chart-4/5">
              <TableHead>{t("invoice.date")}</TableHead>
              <TableHead>{t("production.source")}</TableHead>
              <TableHead>{t("production.sourceQty")}</TableHead>
              <TableHead>{t("production.outputs")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}><div className="space-y-2 py-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-4 bg-muted animate-pulse rounded w-full"/>)}</div></TableCell></TableRow>
            ) : !productions?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
            ) : (
              productions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{new Date(p.production_date + "T00:00:00").toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{(p as any).source_product_name}</TableCell>
                  <TableCell className="font-mono text-sm">{p.source_quantity} {getUnitName((p as any).source_unit_id)}</TableCell>
                  <TableCell>
                    {(p.production_outputs as any[])?.map((o: any, i: number) => (
                      <span key={i}>{o.product_name}: {o.quantity} {getUnitName(o.unit_id)}{i < (p.production_outputs as any[]).length - 1 ? ", " : ""}</span>
                    ))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Production;
