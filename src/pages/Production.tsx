import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Factory, Plus } from "lucide-react";

const Production = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: productions, isLoading } = useQuery({
    queryKey: ["productions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productions")
        .select("*, products!productions_source_product_id_fkey(name), production_outputs(quantity, products(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.production")}</h1>
        <Button onClick={() => navigate("/production/new")}>
          <Plus className="me-2 h-4 w-4" />{t("production.create")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            {t("production.history")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
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
                    <TableCell>{p.production_date}</TableCell>
                    <TableCell>{(p.products as any)?.name || "—"}</TableCell>
                    <TableCell>{p.source_quantity} KG</TableCell>
                    <TableCell>
                      {(p.production_outputs as any[])?.map((o: any, i: number) => (
                        <span key={i}>{o.products?.name}: {o.quantity} KG{i < (p.production_outputs as any[]).length - 1 ? ", " : ""}</span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Production;
