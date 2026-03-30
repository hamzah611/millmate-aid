import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter, Download, Truck } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import InvoiceDetail from "@/components/InvoiceDetail";
import { getBusinessUnitFilterOptions, getBusinessUnitLabel, matchesBusinessUnit } from "@/lib/business-units";

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-500",
  partial: "bg-amber-500",
  credit: "bg-red-500",
  pending: "bg-muted-foreground",
};

const Purchases = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [buFilter, setBuFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, contacts!invoices_contact_id_fkey(name)")
        .eq("invoice_type", "purchase")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = invoices?.filter((inv) => {
    if (statusFilter !== "all" && inv.payment_status !== statusFilter) return false;
    if (!matchesBusinessUnit(inv.business_unit, buFilter)) return false;
    if (dateFrom && inv.invoice_date < dateFrom) return false;
    if (dateTo && inv.invoice_date > dateTo) return false;
    return true;
  });

  const handleExport = () => {
    if (!filtered?.length) return;
    exportToCSV("purchases", ["Invoice #", "Date", "Contact", "Total", "Balance Due", "Status"],
      filtered.map(inv => [inv.invoice_number, new Date(inv.invoice_date + "T00:00:00").toLocaleDateString(), (inv.contacts as any)?.name || "", inv.total, inv.balance_due, inv.payment_status]));
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-3/15">
            <Truck className="h-4.5 w-4.5 text-chart-3" />
          </div>
          <div>
            <h1 className="page-title">{t("invoice.purchases")}</h1>
            {filtered && <p className="page-subtitle">{filtered.length} invoices</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="me-2 h-4 w-4" />{t("reports.exportCSV")}
          </Button>
          <Button onClick={() => navigate("/purchases/new")}>
            <Plus className="me-2 h-4 w-4" />{t("invoice.create")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.all")}</SelectItem>
            <SelectItem value="paid">{t("invoice.paid")}</SelectItem>
            <SelectItem value="partial">{t("invoice.partial")}</SelectItem>
            <SelectItem value="credit">{t("invoice.credit")}</SelectItem>
            <SelectItem value="pending">{t("invoice.pending")}</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-[150px] h-9 rounded-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-[150px] h-9 rounded-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Select value={buFilter} onValueChange={setBuFilter}>
          <SelectTrigger className="w-[180px] h-9 rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {getBusinessUnitFilterOptions(t).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || buFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setBuFilter("all"); setDateFrom(""); setDateTo(""); }}>
            {t("filter.clear")}
          </Button>
        )}
      </div>

      <InvoiceDetail invoiceId={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} />

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>{t("invoice.number")}</TableHead>
              <TableHead>{t("invoice.date")}</TableHead>
              <TableHead>{t("invoice.contact")}</TableHead>
              <TableHead>{t("invoice.total")}</TableHead>
              <TableHead>{t("invoice.balanceDue")}</TableHead>
              <TableHead>{t("invoice.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><div className="space-y-2 py-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-4 bg-muted animate-pulse rounded w-full"/>)}</div></TableCell></TableRow>
            ) : !filtered?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("common.noData")}</TableCell></TableRow>
            ) : (
              filtered.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer transition-colors" onClick={() => setDetailId(inv.id)}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(inv.invoice_date + "T00:00:00").toLocaleDateString()}</TableCell>
                  <TableCell>{(inv.contacts as any)?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">₨ {inv.total?.toLocaleString()}</TableCell>
                  <TableCell className={`font-mono text-sm ${inv.balance_due > 0 ? "text-destructive font-medium" : ""}`}>
                    ₨ {inv.balance_due?.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusStyles[inv.payment_status] || statusStyles.pending}`} />
                      {t(`invoice.${inv.payment_status}`)}
                    </span>
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

export default Purchases;
