import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const Products = () => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", name_ur: "", category_id: "", unit_id: "",
    stock_qty: 0, min_stock_level: 0, default_price: 0, is_tradeable: true,
  });

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

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
      if (error) throw error;
      return data;
    },
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        name: form.name,
        name_ur: form.name_ur || null,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        stock_qty: form.stock_qty,
        min_stock_level: form.min_stock_level,
        default_price: form.default_price,
        is_tradeable: form.is_tradeable,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      toast.success("Product added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.name_ur && p.name_ur.includes(search))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("products.title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />{t("products.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("products.add")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addProduct.mutate(); }} className="space-y-3">
              <Input placeholder={t("products.name") + " (English)"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder={t("products.name") + " (اردو)"} value={form.name_ur} onChange={(e) => setForm({ ...form, name_ur: e.target.value })} dir="rtl" />
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("products.category")} /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {language === "ur" && c.name_ur ? c.name_ur : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("products.unit")} /></SelectTrigger>
                <SelectContent>
                  {units?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {language === "ur" && u.name_ur ? u.name_ur : u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder={t("products.stock")} value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: +e.target.value })} />
                <Input type="number" placeholder={t("products.minStock")} value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: +e.target.value })} />
              </div>
              <Input type="number" placeholder={t("products.price")} value={form.default_price} onChange={(e) => setForm({ ...form, default_price: +e.target.value })} />
              <Button type="submit" className="w-full" disabled={addProduct.isPending}>{t("common.save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                <TableHead>{t("products.category")}</TableHead>
                <TableHead>{t("products.stock")}</TableHead>
                <TableHead>{t("products.price")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">{t("common.loading")}</TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {language === "ur" && p.name_ur ? p.name_ur : p.name}
                      {p.stock_qty <= p.min_stock_level && (
                        <AlertTriangle className="inline ml-2 h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
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
