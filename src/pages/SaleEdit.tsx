import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import InvoiceForm from "@/components/InvoiceForm";
import { useEscapeBack } from "@/hooks/useEscapeBack";

const SaleEdit = () => {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  useEscapeBack();

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/sales")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("invoice.sales")}
      </Button>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("common.edit")} — {t("invoice.sales")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm type="sale" editInvoiceId={id} onSuccess={() => navigate("/sales")} onCancel={() => navigate("/sales")} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SaleEdit;
