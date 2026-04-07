import { useState, useMemo } from "react";
import { fmtAmount } from "@/lib/utils";
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

const PaymentVouchers = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  const { data: bankContacts } = useQuery({
    queryKey: ["bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("account_category", "bank");
      return data || [];
    },
  });
  const bankNameMap = new Map((bankContacts || []).map(b => [b.id, b.name]));

  const { data: cashBankContacts } = useQuery({
    queryKey: ["cash-bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name, account_category").in("account_category", ["cash", "bank"]);
      return data || [];
    },
  });
  const accountNameMap = new Map((cashBankContacts || []).map(c => [c.id, c.name]));

  // All contacts for contact-based transfers
  const { data: allContacts } = useQuery({
    queryKey: ["all-contacts-names"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name");
      return data || [];
    },
  });
  const contactNameMap = new Map((allContacts || []).map(c => [c.id, c.name]));

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ["payment-vouchers", dateFrom, dateTo, methodFilter],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select("*, invoices(invoice_number, total), contacts(name)")
        .eq("voucher_type", "payment")
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
      queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("common.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTransferMutation = useMutation({
    mutationFn: async (record: any) => {
      const vn = record.voucher_number || "";
      const baseNum = vn.replace(/-[AB]$/, "");
      const pairSuffix = vn.endsWith("-A") ? "-B" : "-A";
      const { data: pairRecords } = await supabase.from("payments").select("id").eq("voucher_number", baseNum + pairSuffix).limit(1);
      
      const { error: e1 } = await supabase.from("payments").delete().eq("id", record.id);
      if (e1) throw e1;
      if (pairRecords?.[0]) {
        const { error: e2 } = await supabase.from("payments").delete().eq("id", pairRecords[0].id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("common.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getAccountName = (record: any) => {
    if (record?.contact_id && contactNameMap.get(record.contact_id)) {
      return contactNameMap.get(record.contact_id)!;
    }
    if (record?.payment_method === "bank" && record?.bank_contact_id) {
      return accountNameMap.get(record.bank_contact_id) || t("voucher.bank");
    }
    const cashContact = (cashBankContacts || []).find(c => c.account_category === "cash");
    return cashContact?.name || t("voucher.cash");
  };

  // Build unified list: regular payments + transfer-A records
  const unifiedRows = useMemo(() => {
    if (!vouchers) return [];
    
    return vouchers.map(v => {
      const vn = v.voucher_number || "";
      const isTransferA = vn.endsWith("-A");
      
      if (isTransferA) {
        return { ...v, _rowType: "transfer" as const };
      }
      return { ...v, _rowType: "regular" as const };
    });
  }, [vouchers]);

  // For transfer rows, fetch the -B pair to get "to" info
  const { data: transferPairs } = useQuery({
    queryKey: ["payment-transfer-pairs", unifiedRows.filter(r => r._rowType === "transfer").map(r => r.voucher_number)],
    queryFn: async () => {
      const transferRows = unifiedRows.filter(r => r._rowType === "transfer");
      if (transferRows.length === 0) return new Map<string, any>();
      
      const pairMap = new Map<string, any>();
      for (const tr of transferRows) {
        const baseNum = (tr.voucher_number || "").replace(/-A$/, "");
        const { data: bRecords } = await supabase
          .from("payments")
          .select("*")
          .eq("voucher_number", baseNum + "-B")
          .limit(1);
        if (bRecords?.[0]) {
          pairMap.set(tr.id, bRecords[0]);
        }
      }
      return pairMap;
    },
    enabled: unifiedRows.some(r => r._rowType === "transfer"),
  });

  const total = unifiedRows.reduce((s, v) => s + Number(v.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.paymentVouchers")}</h1>
        <Button onClick={() => navigate("/vouchers/new?type=payment")} size="sm">
          <Plus className="me-2 h-4 w-4" />{t("voucher.newVoucher")}
        </Button>
      </div>

      <div className="space-y-4">
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
              <TableHead>{t("voucher.type")}</TableHead>
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
              <TableRow><TableCell colSpan={9} className="text-center">{t("common.loading")}</TableCell></TableRow>
            ) : unifiedRows.length > 0 ? (
              unifiedRows.map((v) => {
                const isTransfer = v._rowType === "transfer";
                const pairB = isTransfer ? transferPairs?.get(v.id) : null;
                const baseNum = isTransfer ? (v.voucher_number || "").replace(/-A$/, "") : null;
                const fromName = isTransfer ? getAccountName(v) : null;
                const toName = pairB ? getAccountName(pairB) : "—";

                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{isTransfer ? baseNum : (v.voucher_number || "—")}</TableCell>
                    <TableCell>
                      <Badge variant={isTransfer ? "secondary" : "outline"} className="text-xs">
                        {isTransfer ? t("voucher.transferOut") : t("voucher.payment")}
                      </Badge>
                    </TableCell>
                    <TableCell>{v.payment_date}</TableCell>
                    <TableCell className="font-medium">
                      {isTransfer ? "—" : (
                        v.invoice_id
                          ? (v.invoices as any)?.invoice_number || "—"
                          : <Badge variant="secondary" className="text-xs">{t("voucher.direct")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isTransfer
                        ? `Transfer: ${fromName} → ${toName}`
                        : ((v.contacts as any)?.name || "—")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtAmount(Number(v.amount))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {v.payment_method === "bank"
                          ? (bankNameMap.get(v.bank_contact_id!) || t("voucher.bank"))
                          : t("voucher.cash")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {isTransfer ? (v.notes || "").replace(/^\[TRANSFER\]\s*/, "") : (v.notes || "—")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!isTransfer && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/vouchers/${v.id}/edit`)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                              <AlertDialogAction
                                onClick={() => isTransfer ? deleteTransferMutation.mutate(v) : deleteMutation.mutate(v)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("common.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {unifiedRows.length > 0 && (
          <div className="flex justify-end text-sm font-semibold">
            {t("common.total")}: {fmtAmount(total)}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentVouchers;
