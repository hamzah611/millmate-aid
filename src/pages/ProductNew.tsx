import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ProductForm from "@/components/ProductForm";

const ProductNew = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/products")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> {t("products.title")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("products.add")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm onSuccess={() => navigate("/products")} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductNew;
