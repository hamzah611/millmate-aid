import { useState } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const ReceiptVouchers = () => {
  const { t } = useLanguage();
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // Fetch bank contacts for name lookup
  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("account_category", "bank");
      return data || [];
    },
  });
  const bankNameMap = new Map((bankContacts || []).map(b => [b.id, b.name]));

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ["receipt-vouchers", dateFrom, dateTo, methodFilter],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select("*, invoices(invoice_number, total), contacts(name)")
        .eq("voucher_type", "receipt")
        .order("payment_date", { ascending: false });

      if (dateFrom) query = query.gte("payment_date", dateFrom);
      if (dateTo) query = query.lte("payment_date", dateTo);
      if (methodFilter !== "all") query = query.eq("payment_method", methodFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (voucher: any) => {
      const invoiceId = voucher.invoice_id;

      const { error: delError } = await supabase.from("payments").delete().eq("id", voucher.id);
      if (delError) throw delError;

      if (invoiceId) {
        const invoiceTotal = Number((voucher.invoices as any)?.total || 0);
        const { data: remaining } = await supabase.from("payments").select("amount").eq("invoice_id", invoiceId);
        const totalPaid = remaining?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const newBalance = invoiceTotal - totalPaid;
        const newStatus = newBalance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "credit";

        const { error: invError } = await supabase
          .from("invoices")
          .update({ amount_paid: totalPaid, balance_due: Math.max(0, newBalance), payment_status: newStatus })
          .eq("id", invoiceId);
        if (invError) throw invError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("common.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = vouchers?.reduce((s, v) => s + Number(v.amount), 0) || 0;
  

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.receiptVouchers")}</h1>
        <Button onClick={() => navigate("/vouchers/new?type=receipt")} size="sm">
          <Plus className="me-2 h-4 w-4" />{t("voucher.newVoucher")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">{t("filter.from")}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("filter.to")}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("voucher.method")}</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("voucher.allMethods")}</SelectItem>
              <SelectItem value="cash">{t("voucher.cash")}</SelectItem>
              <SelectItem value="bank">{t("voucher.bank")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("voucher.voucherNumber")}</TableHead>
            <TableHead>{t("invoice.date")}</TableHead>
            <TableHead>{t("invoice.number")}</TableHead>
            <TableHead>{t("invoice.contact")}</TableHead>
            <TableHead className="text-right">{t("payment.amount")}</TableHead>
            <TableHead>{t("voucher.method")}</TableHead>
            <TableHead>{t("voucher.notes")}</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8} className="text-center">{t("common.loading")}</TableCell></TableRow>
          ) : vouchers && vouchers.length > 0 ? (
            vouchers.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{(v as any).voucher_number || "—"}</TableCell>
                <TableCell>{v.payment_date}</TableCell>
                <TableCell className="font-medium">
                  {v.invoice_id
                    ? (v.invoices as any)?.invoice_number || "—"
                    : <Badge variant="secondary" className="text-xs">{t("voucher.direct")}</Badge>
                  }
                </TableCell>
                <TableCell>{(v.contacts as any)?.name || "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmtAmount(Number(v.amount))}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {(v as any).payment_method === "bank"
                      ? (bankNameMap.get((v as any).bank_contact_id) || t("voucher.bank"))
                      : t("voucher.cash")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{v.notes || "—"}</TableCell>
                
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/vouchers/${v.id}/edit`)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("common.deleteWarning")} ({fmtAmount(Number(v.amount))})
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(v)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {t("common.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>


              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {vouchers && vouchers.length > 0 && (
        <div className="flex justify-end text-sm font-semibold">
          {t("common.total")}: {fmtAmount(total)}
        </div>
      )}
    </div>
  );
};

export default ReceiptVouchers;
