import { useState, useMemo } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Pencil, Trash2, Download, Package, Eye } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { toast } from "sonner";

const Products = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, name_ur), units(name, name_ur, kg_value)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: purchaseItems } = useQuery({
    queryKey: ["purchase-items-for-avg-cost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, total, invoices!inner(invoice_type)")
        .eq("invoices.invoice_type", "purchase");
      if (error) throw error;
      return data;
    },
  });

  const avgCostMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!purchaseItems) return map;
    const agg = new Map<string, { totalCost: number; totalQty: number }>();
    for (const item of purchaseItems) {
      const existing = agg.get(item.product_id) || { totalCost: 0, totalQty: 0 };
      existing.totalCost += item.total;
      existing.totalQty += item.quantity;
      agg.set(item.product_id, existing);
    }
    for (const [pid, { totalCost, totalQty }] of agg) {
      if (totalQty > 0) map.set(pid, totalCost / totalQty);
    }
    return map;
  }, [purchaseItems]);

  const getDisplayQty = (p: any) => {
    const kgValue = (p.units as any)?.kg_value || 1;
    return Number(p.stock_qty) / kgValue;
  };

  const getStockValue = (p: { id: string; stock_qty: number; default_price: number; units?: any }) => {
    const avgCost = avgCostMap.get(p.id) ?? p.default_price;
    const kgValue = (p.units as any)?.kg_value || 1;
    const displayQty = Number(p.stock_qty) / kgValue;
    return displayQty * avgCost;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if product is used in invoice items
      const { data: usedItems } = await supabase
        .from("invoice_items")
        .select("id")
        .eq("product_id", id)
        .limit(1);
      if (usedItems?.length) {
        throw new Error(t("common.deleteInUse"));
      }
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("common.deleted"));
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.name_ur && p.name_ur.includes(search))
  );

  const colSpan = language === "ur" ? 7 : 6;

  const handleExport = () => {
    if (!filtered?.length) return;
    exportToCSV("products", ["Name", "Category", "Stock", "Min Stock", "Price", "Stock Value"],
      filtered.map(p => [p.name, (p.categories as any)?.name || "", fmtQty(getDisplayQty(p)), p.min_stock_level, p.default_price, Math.round(getStockValue(p))]));
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="page-title">{t("products.title")}</h1>
            {filtered && <p className="page-subtitle">{filtered.length} items</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/products/new")}>
            <Plus className="me-2 h-4 w-4" />{t("products.add")}
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="search-input" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5 hover:bg-primary/5">
              <TableHead>{t("products.name")}</TableHead>
              {language === "ur" && <TableHead>اردو نام</TableHead>}
              <TableHead>{t("products.category")}</TableHead>
              <TableHead>{t("products.stock")}</TableHead>
              <TableHead>{t("products.price")}</TableHead>
              <TableHead>{t("products.stockValue")}</TableHead>
              <TableHead className="w-[100px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={colSpan}><div className="space-y-2 py-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-4 bg-muted animate-pulse rounded w-full"/>)}</div></TableCell></TableRow>
            ) : !filtered?.length ? (
              <TableRow><TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">{t("common.noData")}</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="transition-colors">
                  <TableCell className="font-medium">
                    {p.name}
                    {p.stock_qty <= p.min_stock_level && (
                      <AlertTriangle className="inline ms-2 h-3.5 w-3.5 text-destructive" />
                    )}
                  </TableCell>
                  {language === "ur" && <TableCell dir="rtl">{p.name_ur || "—"}</TableCell>}
                  <TableCell className="text-muted-foreground">
                    {p.categories
                      ? language === "ur" && (p.categories as any).name_ur
                        ? (p.categories as any).name_ur
                        : (p.categories as any).name
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.stock_qty <= p.min_stock_level ? "destructive" : "secondary"} className="font-mono text-xs">
                      {fmtQty(getDisplayQty(p))} {p.units ? (language === "ur" && (p.units as any).name_ur ? (p.units as any).name_ur : (p.units as any).name) : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{fmtAmount(p.default_price ?? 0)}</TableCell>
                  <TableCell className="font-mono text-sm font-medium">{fmtAmount(Math.round(getStockValue(p)))}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/products/${p.id}/history`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/products/${p.id}/edit`)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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

export default Products;
