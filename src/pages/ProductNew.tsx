import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ProductForm from "@/components/ProductForm";
import { useEscapeBack } from "@/hooks/useEscapeBack";

const ProductNew = () => {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  useEscapeBack();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/products")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("products.title")}
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
