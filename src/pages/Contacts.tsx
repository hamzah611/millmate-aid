import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, BookOpen, Download, Users } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { toast } from "sonner";
import { getContactAccountCategoryFilterOptions, getAccountCategoryLabel, matchesAccountCategory } from "@/lib/account-categories";

const Contacts = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [acCategoryFilter, setAcCategoryFilter] = useState("all");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if contact is used in invoices
      const { data: usedInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("contact_id", id)
        .limit(1);
      if (usedInvoices?.length) {
        throw new Error(t("common.deleteInUse"));
      }
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("common.deleted"));
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uniqueCities = useMemo(() => {
    if (!contacts) return [];
    const cities = contacts.map(c => c.city).filter((c): c is string => !!c);
    return [...new Set(cities)].sort();
  }, [contacts]);

  const filtered = contacts?.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || c.contact_type === typeFilter;
    const matchesCity = cityFilter === "all" || c.city === cityFilter;
    const matchesAc = matchesAccountCategory(c.account_category, acCategoryFilter);
    return matchesSearch && matchesType && matchesCity && matchesAc;
  });

  const handleExport = () => {
    if (!filtered?.length) return;
    exportToCSV("contacts", ["Name", "Phone", "Type", "Credit Limit", "Payment Terms", "Account Category"],
      filtered.map(c => [c.name, c.phone || "", c.contact_type, c.credit_limit || 0, c.payment_terms || "", getAccountCategoryLabel(c.account_category, t)]));
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="page-title">{t("contacts.title")}</h1>
            {filtered && <p className="page-subtitle">{filtered.length} contacts</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/contacts/new")}>
            <Plus className="me-2 h-4 w-4" />{t("contacts.add")}
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
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

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="search-input" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("contacts.filterByType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="customer">{t("contacts.customer")}</SelectItem>
            <SelectItem value="supplier">{t("contacts.supplier")}</SelectItem>
            <SelectItem value="both">{t("contacts.both")}</SelectItem>
            <SelectItem value="broker">{t("contacts.broker")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("contacts.filterByCity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {uniqueCities.map(city => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={acCategoryFilter} onValueChange={setAcCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("accountCategory.label")} />
          </SelectTrigger>
          <SelectContent>
            {getContactAccountCategoryFilterOptions(t).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>{t("contacts.name")}</TableHead>
              <TableHead>{t("contacts.phone")}</TableHead>
              <TableHead>{t("contacts.type")}</TableHead>
              <TableHead>{t("accountCategory.label")}</TableHead>
              <TableHead>{t("contacts.creditLimit")}</TableHead>
              <TableHead>{t("contacts.openingBalance")}</TableHead>
              <TableHead className="w-[100px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><div className="space-y-2 py-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-4 bg-muted animate-pulse rounded w-full"/>)}</div></TableCell></TableRow>
            ) : !filtered?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("common.noData")}</TableCell></TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="transition-colors">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.contact_type === 'customer' ? 'bg-primary' : c.contact_type === 'supplier' ? 'bg-chart-3' : 'bg-chart-4'}`} />
                      {t(`contacts.${c.contact_type}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getAccountCategoryLabel(c.account_category, t)}</TableCell>
                  <TableCell className="font-mono text-sm">₨ {c.credit_limit?.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/contacts/${c.id}/ledger`)} title={t("ledger.title")}>
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/contacts/${c.id}/edit`)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Contacts;
