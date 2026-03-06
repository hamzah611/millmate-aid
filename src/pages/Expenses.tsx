import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/export-csv";

export default function Expenses() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_categories(name, name_ur)")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleExport = () => {
    if (!expenses?.length) return;
    exportToCSV("expenses", [
      "Date", "Category", "Amount", "Payment Method", "Notes"
    ], expenses.map(e => [
      e.expense_date,
      (e.expense_categories as any)?.name || "",
      e.amount,
      e.payment_method,
      e.notes || "",
    ]));
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("expenses.title")}</h1>
          {expenses && expenses.length > 0 && (
            <p className="text-muted-foreground mt-1">
              {t("expenses.total")}: ₨{totalExpenses.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!expenses?.length}>
            <Download className="me-2 h-4 w-4" />
            {t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/expenses/new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("expenses.new")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
          ) : !expenses?.length ? (
            <div className="p-8 text-center text-muted-foreground">{t("common.noData")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoice.date")}</TableHead>
                  <TableHead>{t("expenses.category")}</TableHead>
                  <TableHead className="text-right">{t("payment.amount")}</TableHead>
                  <TableHead>{t("expenses.paymentMethod")}</TableHead>
                  <TableHead>{t("adjustments.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((exp) => {
                  const cat = exp.expense_categories as any;
                  const catName = language === "ur" && cat?.name_ur ? cat.name_ur : cat?.name || "";
                  return (
                    <TableRow key={exp.id}>
                      <TableCell>{format(new Date(exp.expense_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{catName}</TableCell>
                      <TableCell className="text-right font-mono">₨{Number(exp.amount).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{exp.payment_method}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{exp.notes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
