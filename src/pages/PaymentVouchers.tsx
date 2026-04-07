import { useState } from "react";
import { fmtAmount } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // Cash + bank contacts for transfer display
  const { data: cashBankContacts } = useQuery({
    queryKey: ["cash-bank-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name, account_category").in("account_category", ["cash", "bank"]);
      return data || [];
    },
  });
  const accountNameMap = new Map((cashBankContacts || []).map(c => [c.id, c.name]));

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

  // Transfers query — get all transfer payment records (voucher_number ends in -A)
  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ["transfer-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .like("voucher_number", "%-A")
        .order("payment_date", { ascending: false });
      if (error) throw error;

      // For each -A record, fetch its paired -B record
      const pairs = [];
      for (const a of data || []) {
        const baseNum = a.voucher_number!.replace(/-A$/, "");
        const { data: bRecords } = await supabase
          .from("payments")
          .select("*")
          .eq("voucher_number", baseNum + "-B")
          .limit(1);
        const b = bRecords?.[0];
        pairs.push({ a, b, baseNum });
      }
      return pairs;
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
      queryClient.invalidateQueries({ queryKey: ["transfer-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("common.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTransferMutation = useMutation({
    mutationFn: async (pair: { a: any; b: any }) => {
      const { error: e1 } = await supabase.from("payments").delete().eq("id", pair.a.id);
      if (e1) throw e1;
      if (pair.b) {
        const { error: e2 } = await supabase.from("payments").delete().eq("id", pair.b.id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["transfer-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("common.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter out transfer records from regular vouchers
  const regularVouchers = vouchers?.filter(v => !(v.voucher_number || "").endsWith("-A")) || [];
  const total = regularVouchers.reduce((s, v) => s + Number(v.amount), 0);

  const getAccountName = (record: any) => {
    if (record?.payment_method === "bank" && record?.bank_contact_id) {
      return accountNameMap.get(record.bank_contact_id) || t("voucher.bank");
    }
    // For cash, find the first cash contact name
    const cashContact = (cashBankContacts || []).find(c => c.account_category === "cash");
    return cashContact?.name || t("voucher.cash");
  };

  const getTransferNotes = (notes: string | null) => {
    if (!notes) return "";
    return notes.replace(/^\[TRANSFER\]\s*/, "");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.paymentVouchers")}</h1>
        <Button onClick={() => navigate("/vouchers/new?type=payment")} size="sm">
          <Plus className="me-2 h-4 w-4" />{t("voucher.newVoucher")}
        </Button>
      </div>

      <Tabs defaultValue="vouchers">
        <TabsList>
          <TabsTrigger value="vouchers">{t("voucher.vouchers")}</TabsTrigger>
          <TabsTrigger value="transfers">{t("voucher.transfers")}</TabsTrigger>
        </TabsList>

        <TabsContent value="vouchers">
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
                ) : regularVouchers.length > 0 ? (
                  regularVouchers.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.voucher_number || "—"}</TableCell>
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
                          {v.payment_method === "bank"
                            ? (bankNameMap.get(v.bank_contact_id!) || t("voucher.bank"))
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            {regularVouchers.length > 0 && (
              <div className="flex justify-end text-sm font-semibold">
                {t("common.total")}: {fmtAmount(total)}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transfers">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("voucher.voucherNumber")}</TableHead>
                <TableHead>{t("invoice.date")}</TableHead>
                <TableHead>{t("voucher.fromAccount")}</TableHead>
                <TableHead>{t("voucher.toAccount")}</TableHead>
                <TableHead className="text-right">{t("payment.amount")}</TableHead>
                <TableHead>{t("voucher.notes")}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfersLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">{t("common.loading")}</TableCell></TableRow>
              ) : transfers && transfers.length > 0 ? (
                transfers.map((pair) => (
                  <TableRow key={pair.baseNum}>
                    <TableCell className="font-mono text-xs">{pair.baseNum}</TableCell>
                    <TableCell>{pair.a.payment_date}</TableCell>
                    <TableCell>{getAccountName(pair.a)}</TableCell>
                    <TableCell>{pair.b ? getAccountName(pair.b) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmtAmount(Number(pair.a.amount))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {getTransferNotes(pair.a.notes)}
                    </TableCell>
                    <TableCell>
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
                              {t("common.deleteWarning")} ({fmtAmount(Number(pair.a.amount))})
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTransferMutation.mutate(pair)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentVouchers;
