import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/export-csv";

export default function Adjustments() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: adjustments, isLoading } = useQuery({
    queryKey: ["inventory-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("*, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleExport = () => {
    if (!adjustments?.length) return;
    exportToCSV("adjustments", [
      "Adjustment #", "Date", "Product", "Type", "Quantity (KG)", "Reason", "Notes"
    ], adjustments.map(a => [
      a.adjustment_number,
      a.adjustment_date,
      (a.products as any)?.name || "",
      a.adjustment_type,
      a.quantity_kg,
      a.reason,
      a.notes || "",
    ]));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("adjustments.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!adjustments?.length}>
            <Download className="me-2 h-4 w-4" />
            {t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/inventory/adjustments/new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("adjustments.new")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
          ) : !adjustments?.length ? (
            <div className="p-8 text-center text-muted-foreground">{t("common.noData")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adjustments.number")}</TableHead>
                  <TableHead>{t("invoice.date")}</TableHead>
                  <TableHead>{t("products.name")}</TableHead>
                  <TableHead>{t("adjustments.type")}</TableHead>
                  <TableHead className="text-end">{t("adjustments.quantity")}</TableHead>
                  <TableHead>{t("adjustments.reason")}</TableHead>
                  <TableHead>{t("adjustments.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="font-mono">{adj.adjustment_number}</TableCell>
                    <TableCell>{format(new Date(adj.adjustment_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{(adj.products as any)?.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        adj.adjustment_type === "increase"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {adj.adjustment_type === "increase" ? "+" : "-"} {t(`adjustments.${adj.adjustment_type}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end font-mono">{Number(adj.quantity_kg).toLocaleString()} KG</TableCell>
                    <TableCell>{adj.reason}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{adj.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
