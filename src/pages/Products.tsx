import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ProductForm from "@/components/ProductForm";

const Products = () => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, name_ur), units(name, name_ur)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
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

  const handleEdit = (p: any) => {
    setEditProduct({
      id: p.id,
      name: p.name,
      name_ur: p.name_ur || "",
      category_id: p.category_id || "",
      unit_id: p.unit_id || "",
      stock_qty: p.stock_qty,
      min_stock_level: p.min_stock_level,
      default_price: p.default_price,
      is_tradeable: p.is_tradeable,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("products.title")}</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />{t("products.add")}
        </Button>
      </div>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("products.add")}</DialogTitle></DialogHeader>
          <ProductForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editProduct} onOpenChange={(o) => !o && setEditProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.edit")} — {editProduct?.name}</DialogTitle></DialogHeader>
          {editProduct && <ProductForm initial={editProduct} onSuccess={() => setEditProduct(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.name")}</TableHead>
                {language === "ur" && <TableHead>اردو نام</TableHead>}
                <TableHead>{t("products.category")}</TableHead>
                <TableHead>{t("products.stock")}</TableHead>
                <TableHead>{t("products.price")}</TableHead>
                <TableHead className="w-[100px]">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={language === "ur" ? 6 : 5} className="text-center">{t("common.loading")}</TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={language === "ur" ? 6 : 5} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.stock_qty <= p.min_stock_level && (
                        <AlertTriangle className="inline ml-2 h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    {language === "ur" && <TableCell dir="rtl">{p.name_ur || "—"}</TableCell>}
                    <TableCell>
                      {p.categories
                        ? language === "ur" && (p.categories as any).name_ur
                          ? (p.categories as any).name_ur
                          : (p.categories as any).name
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.stock_qty <= p.min_stock_level ? "destructive" : "secondary"}>
                        {p.stock_qty} {p.units ? (language === "ur" && (p.units as any).name_ur ? (p.units as any).name_ur : (p.units as any).name) : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>₨ {p.default_price?.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

export default Products;
