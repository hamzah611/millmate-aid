import { useMemo } from "react";
import { fmtAmount, fmtQty } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Package, TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react";
import { useEscapeBack } from "@/hooks/useEscapeBack";

const ProductHistory = () => {
  const { t, language, isRtl } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  useEscapeBack();

  const { data: product } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, units(name, name_ur, kg_value)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: transactions } = useQuery({
    queryKey: ["product-transactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("quantity, price_per_unit, total, unit_id, units(name, name_ur, kg_value), invoices!inner(invoice_date, invoice_number, invoice_type)")
        .eq("product_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: adjustments } = useQuery({
    queryKey: ["product-adjustments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("*")
        .eq("product_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: productions } = useQuery({
    queryKey: ["product-productions", id],
    queryFn: async () => {
      const { data: asSource } = await supabase
        .from("productions")
        .select("production_date, source_quantity, notes")
        .eq("source_product_id", id!);
      const { data: asOutput } = await supabase
        .from("production_outputs")
        .select("quantity, productions(production_date, notes)")
        .eq("product_id", id!);
      return { asSource: asSource || [], asOutput: asOutput || [] };
    },
    enabled: !!id,
  });

  const { data: expenses } = useQuery({
    queryKey: ["product-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, notes, expense_date, payment_method, expense_categories(name, name_ur)")
        .eq("product_id", id!)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const history = useMemo(() => {
    if (!transactions) return [];
    const productKgValue = (product?.units as any)?.kg_value || 1;

    type Entry = {
      date: string;
      type: string;
      reference: string;
      qtyIn: number;
      qtyOut: number;
      rate: number;
      totalValue: number;
    };

    const entries: Entry[] = [];

    for (const tx of transactions) {
      const inv = tx.invoices as any;
      const unitKg = (tx.units as any)?.kg_value || 1;
      const qtyInProductUnits = (tx.quantity * unitKg) / productKgValue;

      if (inv.invoice_type === "purchase") {
        entries.push({
          date: inv.invoice_date,
          type: t("invoice.purchases"),
          reference: inv.invoice_number,
          qtyIn: qtyInProductUnits,
          qtyOut: 0,
          rate: tx.price_per_unit,
          totalValue: tx.total,
        });
      } else {
        entries.push({
          date: inv.invoice_date,
          type: t("invoice.sales"),
          reference: inv.invoice_number,
          qtyIn: 0,
          qtyOut: qtyInProductUnits,
          rate: tx.price_per_unit,
          totalValue: tx.total,
        });
      }
    }

    // Add adjustments
    for (const adj of (adjustments || [])) {
      const adjQty = adj.quantity_kg / productKgValue;
      entries.push({
        date: adj.adjustment_date,
        type: adj.adjustment_type === "increase" ? t("inventory.increase") || "Increase" : t("inventory.decrease") || "Decrease",
        reference: adj.adjustment_number,
        qtyIn: adj.adjustment_type === "increase" ? adjQty : 0,
        qtyOut: adj.adjustment_type === "decrease" ? adjQty : 0,
        rate: 0,
        totalValue: 0,
      });
    }

    // Add productions
    if (productions) {
      for (const p of productions.asSource) {
        const qty = p.source_quantity / productKgValue;
        entries.push({
          date: p.production_date,
          type: t("nav.production") || "Production",
          reference: p.notes || "—",
          qtyIn: 0,
          qtyOut: qty,
          rate: 0,
          totalValue: 0,
        });
      }
      for (const p of productions.asOutput) {
        const prod = p.productions as any;
        const qty = p.quantity / productKgValue;
        entries.push({
          date: prod?.production_date || "",
          type: t("nav.production") || "Production",
          reference: prod?.notes || "—",
          qtyIn: qty,
          qtyOut: 0,
          rate: 0,
          totalValue: 0,
        });
      }
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }, [transactions, adjustments, productions, product, t]);

  const historyWithBalance = useMemo(() => {
    let balance = 0;
    return history.map(e => {
      balance += e.qtyIn - e.qtyOut;
      return { ...e, balance };
    });
  }, [history]);

  const totalPurchased = history.reduce((s, e) => s + e.qtyIn, 0);
  const totalSold = history.reduce((s, e) => s + e.qtyOut, 0);
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
  const unitName = product?.units ? (language === "ur" && (product.units as any).name_ur ? (product.units as any).name_ur : (product.units as any).name) : "";
  const displayStock = product ? Number(product.stock_qty) / ((product.units as any)?.kg_value || 1) : 0;

  if (!product) return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={() => navigate("/products")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("products.title")}
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{language === "ur" && product.name_ur ? product.name_ur : product.name}</h1>
          <p className="text-sm text-muted-foreground">{t("products.stock")}: {fmtQty(displayStock)} {unitName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t("products.stock")}</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmtQty(displayStock)} <span className="text-sm font-normal text-muted-foreground">{unitName}</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Avg Cost</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmtAmount(Number(product.avg_cost) || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {t("invoice.purchases")}</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmtQty(totalPurchased)} <span className="text-sm font-normal text-muted-foreground">{unitName}</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {t("invoice.sales")}</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmtQty(totalSold)} <span className="text-sm font-normal text-muted-foreground">{unitName}</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Expenses</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmtAmount(totalExpenses)}</p></CardContent>
        </Card>
      </div>

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5 hover:bg-primary/5">
              <TableHead>{t("invoice.date")}</TableHead>
              <TableHead>{t("voucher.type")}</TableHead>
              <TableHead>{t("invoice.number")}</TableHead>
              <TableHead className="text-right">Qty In</TableHead>
              <TableHead className="text-right">Qty Out</TableHead>
              <TableHead className="text-right">{t("invoice.price")}</TableHead>
              <TableHead className="text-right">{t("invoice.total")}</TableHead>
              <TableHead className="text-right">{t("products.stock")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyWithBalance.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("common.noData")}</TableCell></TableRow>
            ) : (
              historyWithBalance.map((e, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground">{e.date}</TableCell>
                  <TableCell>
                    <Badge variant={e.qtyIn > 0 ? "default" : "secondary"} className="text-xs">
                      {e.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{e.reference}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">{e.qtyIn > 0 ? fmtQty(e.qtyIn) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">{e.qtyOut > 0 ? fmtQty(e.qtyOut) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{e.rate > 0 ? fmtAmount(e.rate) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{e.totalValue > 0 ? fmtAmount(e.totalValue) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{fmtQty(e.balance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Product Expenses */}
      <div className="table-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Product Expenses</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5 hover:bg-primary/5">
              <TableHead>{t("invoice.date")}</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead className="text-right">{t("invoice.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!expenses?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No expenses recorded for this product.</TableCell></TableRow>
            ) : (
              expenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="text-muted-foreground">{exp.expense_date}</TableCell>
                  <TableCell>{exp.notes || "—"}</TableCell>
                  <TableCell>
                    {exp.expense_categories
                      ? language === "ur" && (exp.expense_categories as any).name_ur
                        ? (exp.expense_categories as any).name_ur
                        : (exp.expense_categories as any).name
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{exp.payment_method}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{fmtAmount(Number(exp.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ProductHistory;
