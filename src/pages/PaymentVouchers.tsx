import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const PaymentVouchers = () => {
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ["payment-vouchers", dateFrom, dateTo, methodFilter],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select("*, invoices(invoice_number), contacts(name)")
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

  const total = vouchers?.reduce((s, v) => s + Number(v.amount), 0) || 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("nav.paymentVouchers")}</h1>

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
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
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
            <TableHead>{t("invoice.date")}</TableHead>
            <TableHead>{t("invoice.number")}</TableHead>
            <TableHead>{t("invoice.contact")}</TableHead>
            <TableHead className="text-right">{t("payment.amount")}</TableHead>
            <TableHead>{t("voucher.method")}</TableHead>
            <TableHead>{t("voucher.notes")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="text-center">{t("common.loading")}</TableCell></TableRow>
          ) : vouchers && vouchers.length > 0 ? (
            vouchers.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.payment_date}</TableCell>
                <TableCell className="font-medium">{(v.invoices as any)?.invoice_number || "—"}</TableCell>
                <TableCell>{(v.contacts as any)?.name || "—"}</TableCell>
                <TableCell className="text-right font-medium">₨ {Number(v.amount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {(v as any).payment_method === "bank" ? t("voucher.bank") : t("voucher.cash")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{v.notes || "—"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {vouchers && vouchers.length > 0 && (
        <div className="flex justify-end text-sm font-semibold">
          {t("common.total")}: ₨ {total.toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default PaymentVouchers;
