import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopProductsChart } from "@/components/reports/TopProductsChart";
import { SalesPurchasesChart } from "@/components/reports/SalesPurchasesChart";
import { ProfitMarginsChart } from "@/components/reports/ProfitMarginsChart";
import { AgingReport } from "@/components/reports/AgingReport";
import { ProfitLossReport, CashFlowReport, BalanceSheetReport } from "@/components/reports/FinancialReports";
import { CashClosingReport } from "@/components/reports/CashClosingReport";

export default function Reports() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t("reports.title")}</h1>

      <Tabs defaultValue="top-products">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="top-products">{t("reports.topProducts")}</TabsTrigger>
          <TabsTrigger value="sales-purchases">{t("reports.salesVsPurchases")}</TabsTrigger>
          <TabsTrigger value="profit-margins">{t("reports.profitMargins")}</TabsTrigger>
          <TabsTrigger value="aging">{t("reports.agingReport")}</TabsTrigger>
          <TabsTrigger value="pnl">{t("reports.profitLoss")}</TabsTrigger>
          <TabsTrigger value="cashflow">{t("reports.cashFlow")}</TabsTrigger>
          <TabsTrigger value="balance">{t("reports.balanceSheet")}</TabsTrigger>
          <TabsTrigger value="cash-closing">{t("reports.cashClosing")}</TabsTrigger>
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
        <TabsContent value="pnl" className="mt-6">
          <ProfitLossReport />
        </TabsContent>
        <TabsContent value="cashflow" className="mt-6">
          <CashFlowReport />
        </TabsContent>
        <TabsContent value="balance" className="mt-6">
          <BalanceSheetReport />
        </TabsContent>
        <TabsContent value="cash-closing" className="mt-6">
          <CashClosingReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
