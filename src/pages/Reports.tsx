import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopProductsChart } from "@/components/reports/TopProductsChart";
import { SalesPurchasesChart } from "@/components/reports/SalesPurchasesChart";
import { ProfitMarginsChart } from "@/components/reports/ProfitMarginsChart";
import { AgingReport } from "@/components/reports/AgingReport";
import { ProfitLossReport, CashFlowReport, BalanceSheetReport } from "@/components/reports/FinancialReports";
import { CashClosingReport } from "@/components/reports/CashClosingReport";
import { DailyTransactionsReport } from "@/components/reports/DailyTransactionsReport";
import { DailyProductsReport } from "@/components/reports/DailyProductsReport";

export default function Reports() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t("reports.title")}</h1>

      <Tabs defaultValue="top-products">
        <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 border-b border-border pb-2">
          {[
            { value: "top-products", label: t("reports.topProducts") },
            { value: "sales-purchases", label: t("reports.salesVsPurchases") },
            { value: "profit-margins", label: t("reports.profitMargins") },
            { value: "aging", label: t("reports.agingReport") },
            { value: "pnl", label: t("reports.profitLoss") },
            { value: "cashflow", label: t("reports.cashFlow") },
            { value: "balance", label: t("reports.balanceSheet") },
            { value: "cash-closing", label: t("reports.cashClosing") },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium bg-muted/50 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
            >
              {tab.label}
            </TabsTrigger>
          ))}
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
