import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReplenishmentAlerts } from "@/components/inventory/ReplenishmentAlerts";
import { BatchTracking } from "@/components/inventory/BatchTracking";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Inventory() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("inventory.title")}</h1>
        <Button variant="outline" onClick={() => navigate("/inventory/adjustments")}>
          <ClipboardList className="me-2 h-4 w-4" />
          {t("adjustments.title")}
        </Button>
      </div>

      <Tabs defaultValue="replenishment">
        <TabsList>
          <TabsTrigger value="replenishment">{t("inventory.replenishment")}</TabsTrigger>
          <TabsTrigger value="batches">{t("inventory.batchTracking")}</TabsTrigger>
        </TabsList>

        <TabsContent value="replenishment" className="mt-6">
          <ReplenishmentAlerts />
        </TabsContent>
        <TabsContent value="batches" className="mt-6">
          <BatchTracking />
        </TabsContent>
      </Tabs>
    </div>
  );
}
