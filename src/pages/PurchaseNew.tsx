import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import InvoiceForm from "@/components/InvoiceForm";

const PurchaseNew = () => {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/purchases")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("invoice.purchases")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("invoice.create")} — {t("invoice.purchases")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm type="purchase" onSuccess={() => navigate("/purchases")} onCancel={() => navigate("/purchases")} />
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseNew;
