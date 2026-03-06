import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import InvoiceDetail from "@/components/InvoiceDetail";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
  pending: "outline",
};

const Purchases = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, contacts(name)")
        .eq("invoice_type", "purchase")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = invoices?.filter((inv) => {
    if (statusFilter !== "all" && inv.payment_status !== statusFilter) return false;
    if (dateFrom && inv.invoice_date < dateFrom) return false;
    if (dateTo && inv.invoice_date > dateTo) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("invoice.purchases")}</h1>
        <Button onClick={() => navigate("/purchases/new")}>
          <Plus className="me-2 h-4 w-4" />{t("invoice.create")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.all")}</SelectItem>
            <SelectItem value="paid">{t("invoice.paid")}</SelectItem>
            <SelectItem value="partial">{t("invoice.partial")}</SelectItem>
            <SelectItem value="credit">{t("invoice.credit")}</SelectItem>
            <SelectItem value="pending">{t("invoice.pending")}</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-[150px] h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-[150px] h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        {(statusFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}>
            {t("filter.clear")}
          </Button>
        )}
      </div>

      <InvoiceDetail invoiceId={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow><TableCell colSpan={6}><div className="space-y-2 py-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-4 bg-muted animate-pulse rounded w-full"/>)}</div></TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(inv.id)}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.invoice_date}</TableCell>
                    <TableCell>{(inv.contacts as any)?.name || "—"}</TableCell>
                    <TableCell>₨ {inv.total?.toLocaleString()}</TableCell>
                    <TableCell className={inv.balance_due > 0 ? "text-destructive font-medium" : ""}>
                      ₨ {inv.balance_due?.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[inv.payment_status] || "outline"}>
                        {t(`invoice.${inv.payment_status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Purchases;
