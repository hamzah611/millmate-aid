import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import InvoiceForm from "@/components/InvoiceForm";

const SaleNew = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/sales")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> {t("invoice.sales")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("invoice.create")} — {t("invoice.sales")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm type="sale" onSuccess={() => navigate("/sales")} onCancel={() => navigate("/sales")} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SaleNew;
