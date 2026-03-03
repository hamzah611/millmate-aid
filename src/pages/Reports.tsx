import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopProductsChart } from "@/components/reports/TopProductsChart";
import { SalesPurchasesChart } from "@/components/reports/SalesPurchasesChart";
import { ProfitMarginsChart } from "@/components/reports/ProfitMarginsChart";
import { AgingReport } from "@/components/reports/AgingReport";

export default function Reports() {
  const { t } = useLanguage();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("reports.title")}</h1>

      <Tabs defaultValue="top-products">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="top-products">{t("reports.topProducts")}</TabsTrigger>
          <TabsTrigger value="sales-purchases">{t("reports.salesVsPurchases")}</TabsTrigger>
          <TabsTrigger value="profit-margins">{t("reports.profitMargins")}</TabsTrigger>
          <TabsTrigger value="aging">{t("reports.agingReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="top-products" className="mt-6">
          <TopProductsChart />
        </TabsContent>
        <TabsContent value="sales-purchases" className="mt-6">
          <SalesPurchasesChart />
        </TabsContent>
        <TabsContent value="profit-margins" className="mt-6">
          <ProfitMarginsChart />
        </TabsContent>
        <TabsContent value="aging" className="mt-6">
          <AgingReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
