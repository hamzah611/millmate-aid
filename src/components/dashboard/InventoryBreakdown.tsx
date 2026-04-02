import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";
import type { ProductValuation } from "@/lib/financial-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductValuation[];
  totalValue: number;
}

export default function InventoryBreakdown({ open, onOpenChange, products, totalValue }: Props) {
  const { t } = useLanguage();

  const warningCount = products.filter(p => p.costSource !== "purchase_history").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("dashboard.inventoryBreakdown")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-4 text-sm mb-4">
          <div className="bg-muted rounded-md px-3 py-1.5">
            <span className="text-muted-foreground">{t("common.total")}:</span>{" "}
            <span className="font-bold">₨{totalValue.toLocaleString()}</span>
          </div>
          <div className="bg-muted rounded-md px-3 py-1.5">
            <span className="text-muted-foreground">{t("dashboard.productCount").replace("{0}", String(products.length))}</span>
          </div>
          {warningCount > 0 && (
            <div className="bg-destructive/10 text-destructive rounded-md px-3 py-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("dashboard.warningCount").replace("{0}", String(warningCount))}
            </div>
          )}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.name")}</TableHead>
                <TableHead className="text-end">{t("products.stock")}</TableHead>
                <TableHead className="text-end">{t("dashboard.avgCost")}</TableHead>
                <TableHead className="text-end">{t("dashboard.inventoryValue")}</TableHead>
                <TableHead>{t("dashboard.costSource")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-end font-mono">
                    {p.stockInUnit} {p.unitName}
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    ₨{p.avgCost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-end font-mono font-semibold">
                    ₨{p.inventoryValue.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.costSource === "purchase_history" && (
                        <Badge variant="secondary" className="text-[10px]">{t("dashboard.fromPurchases")}</Badge>
                      )}
                      {p.costSource === "default_price" && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">{t("dashboard.usingDefaultPrice")}</Badge>
                      )}
                      {p.costSource === "missing" && (
                        <Badge variant="destructive" className="text-[10px]">{t("dashboard.missingCost")}</Badge>
                      )}
                      {p.hasOpeningStock && (
                        <Badge variant="outline" className="text-[10px]">{t("dashboard.includesOpeningStock")}</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
