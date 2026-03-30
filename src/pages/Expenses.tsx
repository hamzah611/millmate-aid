import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Download, Receipt, CalendarDays, TrendingDown, Search, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/export-csv";
import { toast } from "sonner";
import { getBusinessUnitFilterOptions, getBusinessUnitLabel, matchesBusinessUnit } from "@/lib/business-units";
import { getExpenseAccountCategoryFilterOptions, getAccountCategoryLabel, matchesAccountCategory } from "@/lib/account-categories";

export default function Expenses() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(t("common.deleted"));
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.slice(0, 7); // "YYYY-MM"

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [buFilter, setBuFilter] = useState("all");
  const [acFilter, setAcFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").order("name");
      return data || [];
    },
  });

  // Filtered data
  const filtered = useMemo(() => {
    return (expenses || []).filter(e => {
      if (dateFrom && e.expense_date < dateFrom) return false;
      if (dateTo && e.expense_date > dateTo) return false;
      if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
      if (methodFilter !== "all" && e.payment_method !== methodFilter) return false;
      if (!matchesBusinessUnit(e.business_unit, buFilter)) return false;
      if (!matchesAccountCategory(e.account_category, acFilter)) return false;
      if (searchQuery) {
        const cat = e.expense_categories as any;
        const catName = (language === "ur" && cat?.name_ur ? cat.name_ur : cat?.name || "").toLowerCase();
        const notes = (e.notes || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        if (!catName.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, dateFrom, dateTo, categoryFilter, methodFilter, buFilter, acFilter, searchQuery, language]);

  // Summary calculations
  const totalFiltered = useMemo(() => filtered.reduce((s, e) => s + Number(e.amount), 0), [filtered]);
  const totalToday = useMemo(() =>
    (expenses || []).filter(e => e.expense_date === today).reduce((s, e) => s + Number(e.amount), 0),
    [expenses, today]
  );
  const totalMonth = useMemo(() =>
    (expenses || []).filter(e => e.expense_date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0),
    [expenses, currentMonth]
  );

  // Category breakdown from filtered
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filtered.forEach(e => {
      const cat = e.expense_categories as any;
      const catName = language === "ur" && cat?.name_ur ? cat.name_ur : cat?.name || "Other";
      const key = e.category_id || "none";
      if (!map[key]) map[key] = { name: catName, total: 0 };
      map[key].total += Number(e.amount);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered, language]);

  const maxCategoryTotal = categoryBreakdown[0]?.total || 1;

  const handleExport = () => {
    if (!filtered.length) return;
    exportToCSV("expenses", [
      "Date", "Category", "Amount", "Payment Method", "Notes", "Business Unit", "Account Category"
    ], filtered.map(e => [
      new Date(e.expense_date + "T00:00:00").toLocaleDateString(),
      (e.expense_categories as any)?.name || "",
      e.amount,
      e.payment_method,
      e.notes || "",
      e.business_unit || "Unassigned",
      getAccountCategoryLabel(e.account_category, t),
    ]));
  };

  const hasFilters = dateFrom || dateTo || categoryFilter !== "all" || methodFilter !== "all" || buFilter !== "all" || acFilter !== "all" || searchQuery;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-3/15">
            <Receipt className="h-4.5 w-4.5 text-chart-3" />
          </div>
          <div>
            <h1 className="page-title">{t("expenses.title")}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!filtered.length}>
            <Download className="me-2 h-4 w-4" />
            {t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/expenses/new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("expenses.new")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-1/15">
                <CalendarDays className="h-4 w-4 text-chart-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("expenses.totalToday")}</p>
                <p className="text-lg font-bold font-mono">₨{totalToday.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-2/15">
                <TrendingDown className="h-4 w-4 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("expenses.totalMonth")}</p>
                <p className="text-lg font-bold font-mono">₨{totalMonth.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-3/15">
                <Receipt className="h-4 w-4 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {hasFilters ? t("expenses.totalAll") : t("expenses.total")}
                </p>
                <p className="text-lg font-bold font-mono">₨{totalFiltered.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("expenses.search")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 w-[200px] h-9 text-sm"
          />
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="w-[140px] h-9 text-sm"
          placeholder={t("expenses.dateFrom")}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="w-[140px] h-9 text-sm"
          placeholder={t("expenses.dateTo")}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {language === "ur" && c.name_ur ? c.name_ur : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("expenses.allMethods")}</SelectItem>
            <SelectItem value="cash">{t("expenses.cash")}</SelectItem>
            <SelectItem value="bank">{t("expenses.bank")}</SelectItem>
            <SelectItem value="other">{t("expenses.other")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={buFilter} onValueChange={setBuFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getBusinessUnitFilterOptions(t).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={acFilter} onValueChange={setAcFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getExpenseAccountCategoryFilterOptions(t).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => {
            setDateFrom(""); setDateTo(""); setCategoryFilter("all"); setMethodFilter("all"); setBuFilter("all"); setAcFilter("all"); setSearchQuery("");
          }}>
            ✕
          </Button>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("expenses.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table */}
      <div className="table-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
        ) : !filtered.length ? (
          <div className="p-8 text-center text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("expenses.category")}</TableHead>
                <TableHead className="text-end">{t("payment.amount")}</TableHead>
                <TableHead>{t("expenses.paymentMethod")}</TableHead>
                <TableHead>{t("adjustments.notes")}</TableHead>
                <TableHead className="w-[80px]">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((exp) => {
                const cat = exp.expense_categories as any;
                const catName = language === "ur" && cat?.name_ur ? cat.name_ur : cat?.name || "";
                return (
                  <TableRow key={exp.id} className="transition-colors">
                    <TableCell className="text-muted-foreground">
                      {format(new Date(exp.expense_date + "T00:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{catName}</TableCell>
                    <TableCell className="text-end font-mono text-sm">₨{Number(exp.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize">
                        <span className={`h-1.5 w-1.5 rounded-full ${exp.payment_method === 'cash' ? 'bg-emerald-500' : 'bg-primary'}`} />
                        {exp.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{exp.notes}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/expenses/edit/${exp.id}`)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(exp.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("expenses.categoryBreakdown")}</h3>
            <div className="space-y-2">
              {categoryBreakdown.map((cat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <span className="font-mono text-muted-foreground">₨{cat.total.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-chart-3 transition-all"
                      style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
