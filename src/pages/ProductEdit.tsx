import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ProductForm from "@/components/ProductForm";

const ProductEdit = () => {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        name_ur: data.name_ur || "",
        category_id: data.category_id || "",
        unit_id: data.unit_id || "",
        stock_qty: data.stock_qty,
        min_stock_level: data.min_stock_level,
        default_price: data.default_price,
        is_tradeable: data.is_tradeable,
      };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/products")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("products.title")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("common.edit")} — {product?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {product && <ProductForm initial={product} onSuccess={() => navigate("/products")} />}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductEdit;
