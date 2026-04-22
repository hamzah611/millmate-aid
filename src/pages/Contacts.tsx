import { useState, useMemo } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
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


const BUILT_IN_TYPES = ["customer", "supplier", "both", "broker", "bank"];

const TYPE_DOT_COLORS: Record<string, string> = {
  customer: "bg-primary",
  supplier: "bg-chart-3",
  bank: "bg-chart-5",
  broker: "bg-chart-4",
  both: "bg-chart-4",
};

const Contacts = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [acTypeFilter, setAcTypeFilter] = useState("all");

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

  // Fetch all invoices to compute per-contact balances
  const { data: allInvoices } = useQuery({
    queryKey: ["all-invoices-for-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, contact_id, invoice_type, total");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all payments to compute per-contact balances
  const { data: allPayments } = useQuery({
    queryKey: ["all-payments-for-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("contact_id, invoice_id, voucher_type, amount");
      if (error) throw error;
      return data;
    },
  });

  // Compute outstanding balance per contact using same logic as ledger
  const contactBalances = useMemo(() => {
    const balances = new Map<string, number>();
    if (!contacts) return balances;

    // Build invoice_id -> contact_id map for invoice-linked payments
    const invoiceToContact = new Map<string, string>();
    for (const inv of allInvoices || []) {
      invoiceToContact.set(inv.id, inv.contact_id);
    }

    for (const c of contacts) {
      const isSupplier = c.contact_type === "supplier" || c.contact_type === "employee";
      let balance = Number(c.opening_balance || 0);

      // Add invoice entries (same DR/CR as ledger)
      for (const inv of allInvoices || []) {
        if (inv.contact_id !== c.id) continue;
        const total = inv.total || 0;
        if (isSupplier) {
          // supplier: purchase=CR(-), sale=DR(+)
          balance += inv.invoice_type === "sale" ? total : -total;
        } else {
          // customer: sale=DR(+), purchase=CR(-)
          balance += inv.invoice_type === "sale" ? total : -total;
        }
      }

      // Add all payments for this contact (direct + invoice-linked)
      for (const p of allPayments || []) {
        const isDirectVoucher = p.contact_id === c.id && !p.invoice_id;
        const isInvoiceLinked = p.invoice_id && invoiceToContact.get(p.invoice_id) === c.id;

        if (isDirectVoucher || isInvoiceLinked) {
          // payment=DR(+), receipt=CR(-) — same as ledger
          balance += p.voucher_type === "payment" ? (p.amount || 0) : -(p.amount || 0);
        }
      }

      balances.set(c.id, balance);
    }

    return balances;
  }, [contacts, allInvoices, allPayments]);

  const { data: contactTypes } = useQuery({
    queryKey: ["contact_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_types").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });


  const getTypeLabel = (name: string) => {
    if (BUILT_IN_TYPES.includes(name)) return t(`contacts.${name}`);
    if (language === "ur") {
      const ct = contactTypes?.find(ct => ct.name === name);
      return ct?.name_ur || name;
    }
    return name;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
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

  const uniqueAccountTypes = useMemo(() => {
    if (!contacts) return [];
    const types = contacts.map(c => c.account_type).filter((c): c is string => !!c);
    return [...new Set(types)].sort();
  }, [contacts]);

  const filtered = contacts?.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || c.contact_type === typeFilter;
    const matchesCity = cityFilter === "all" || c.city === cityFilter;
    const matchesAcType = acTypeFilter === "all" || c.account_type === acTypeFilter;
    return matchesSearch && matchesType && matchesCity && matchesAcType;
  });

  const handleExport = () => {
    if (!filtered?.length) return;
    exportToCSV("contacts", ["Name", "Phone", "Account Category", "Credit Limit", "Outstanding Balance", "Payment Terms", "Account Type"],
      filtered.map(c => [c.name, c.phone || "", c.contact_type, c.credit_limit || 0, contactBalances.get(c.id) ?? (c.opening_balance || 0), c.payment_terms || "", c.account_type || ""]));
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
            {filtered && <p className="page-subtitle">{filtered.length} accounts</p>}
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
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="search-input ps-10 h-10 rounded-lg border border-border bg-card shadow-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all duration-200"
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("contacts.filterByAccountCategory")}</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("contacts.filterByAccountCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {contactTypes?.map((ct) => (
                <SelectItem key={ct.id} value={ct.name}>{getTypeLabel(ct.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("contacts.filterByCity")}</label>
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
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("contacts.filterByAccountType")}</label>
          <Select value={acTypeFilter} onValueChange={setAcTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("contacts.filterByAccountType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {uniqueAccountTypes.map(at => (
                <SelectItem key={at} value={at}>{at}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5 hover:bg-primary/5">
              <TableHead>{t("contacts.name")}</TableHead>
              <TableHead>{t("contacts.phone")}</TableHead>
              <TableHead>{t("contacts.accountCategory")}</TableHead>
              <TableHead>{t("contacts.accountType")}</TableHead>
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
                      <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT_COLORS[c.contact_type] || 'bg-muted-foreground'}`} />
                      {getTypeLabel(c.contact_type)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.account_type || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{fmtAmount(c.credit_limit ?? 0)}</TableCell>
                  <TableCell className={`font-mono text-sm ${(contactBalances.get(c.id) ?? c.opening_balance ?? 0) < 0 ? 'text-destructive' : ''}`}>
                    {(() => {
                      const bal = contactBalances.get(c.id) ?? (c.opening_balance ?? 0);
                      return `${fmtAmount(Math.abs(bal))} ${bal === 0 ? '' : bal > 0 ? 'DR' : 'CR'}`;
                    })()}
                  </TableCell>
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
