import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ProductData {
  id?: string;
  name: string;
  name_ur: string;
  category_id: string;
  unit_id: string;
  stock_qty: number;
  min_stock_level: number;
  default_price: number;
  is_tradeable: boolean;
}

interface Props {
  initial?: ProductData;
  onSuccess: () => void;
}

const emptyForm: ProductData = {
  name: "", name_ur: "", category_id: "", unit_id: "",
  stock_qty: 0, min_stock_level: 0, default_price: 0, is_tradeable: true,
};

const ProductForm = ({ initial, onSuccess }: Props) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductData>(initial || emptyForm);
  const isEdit = !!initial?.id;

  useEffect(() => {
    setForm(initial || emptyForm);
  }, [initial]);

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

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        name_ur: form.name_ur || null,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        stock_qty: form.stock_qty,
        min_stock_level: form.min_stock_level,
        default_price: form.default_price,
        is_tradeable: form.is_tradeable,
      };
      if (isEdit) {
        const { error } = await supabase.from("products").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(isEdit ? t("common.updated") : t("common.saved"));
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
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
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {isEdit ? t("common.edit") : t("common.save")}
      </Button>
    </form>
  );
};

export default ProductForm;
