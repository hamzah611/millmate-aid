import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { exportToCSV } from "@/lib/export-csv";

interface SaleRow {
  dated: string;
  invNo: string;
  description: string;
  qty: number;
  weight: number;
  kaat: number;
  netWeight: number;
  rate: number;
  asPer: string;
  amount: number;
}

interface ProductSection {
  label: string;
  rows: SaleRow[];
}

const PRODUCT_GROUPS: Record<string, string> = {
  "Rice Atta": "ATTA RICE",
  "Wheat Atta": "ATTA WHEAT",
  "Chill": "CHILL",
  "Powder": "POWDER",
};

const SECTION_ORDER = ["ATTA RICE", "ATTA WHEAT", "CHILL", "POWDER"];

export function DailyProductsReport() {
  const { language } = useLanguage();
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");

  const { data: sections, isLoading } = useQuery({
    queryKey: ["sales-summary", fromStr, toStr],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("invoice_items")
        .select(`
          quantity, price_per_unit, total,
          product_id, products!invoice_items_product_id_fkey(name),
          unit_id, units!invoice_items_unit_id_fkey(name, kg_value),
          invoice_id, invoices!invoice_items_invoice_id_fkey(invoice_number, invoice_date, invoice_type, contact_id, contacts!invoices_contact_id_fkey(name, account_category))
        `);

      const grouped: Record<string, SaleRow[]> = {};
      SECTION_ORDER.forEach(s => (grouped[s] = []));

      for (const item of items || []) {
        const inv = item.invoices as any;
        if (!inv || inv.invoice_type !== "sale") continue;
        if (inv.invoice_date < fromStr || inv.invoice_date > toStr) continue;

        const prodName = (item.products as any)?.name || "";
        const sectionLabel = PRODUCT_GROUPS[prodName];
        if (!sectionLabel) continue;

        const unit = item.units as any;
        const kgValue = unit?.kg_value || 1;
        const contact = inv.contacts as any;
        const isCash = contact?.account_category === "current_assets";

        const weight = item.quantity * kgValue;
        const row: SaleRow = {
          dated: format(new Date(inv.invoice_date), "dd-MM-yyyy"),
          invNo: inv.invoice_number,
          description: isCash ? "CASH SALES" : (contact?.name || "—"),
          qty: item.quantity,
          weight,
          kaat: 0,
          netWeight: weight,
          rate: item.price_per_unit,
          asPer: unit?.name || "—",
          amount: item.total,
        };

        grouped[sectionLabel].push(row);
      }

      return SECTION_ORDER.map(label => ({ label, rows: grouped[label] })) as ProductSection[];
    },
    staleTime: 0,
  });

  const allSections = sections || [];
  const fmt = (n: number) => `₨ ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtN = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grandQty = allSections.reduce((s, sec) => s + sec.rows.reduce((a, r) => a + r.qty, 0), 0);
  const grandNet = allSections.reduce((s, sec) => s + sec.rows.reduce((a, r) => a + r.netWeight, 0), 0);
  const grandAmount = allSections.reduce((s, sec) => s + sec.rows.reduce((a, r) => a + r.amount, 0), 0);

  const handleExport = () => {
    const headers = ["DATED", "INV #", "DESCRIPTION", "QTY", "WEIGHT", "KAAT", "NET WEIGHT", "RATE", "AS PER", "AMOUNT"];
    const rows: (string | number)[][] = [];
    allSections.forEach(sec => {
      rows.push([sec.label, "", "", "", "", "", "", "", "", ""]);
      sec.rows.forEach(r => rows.push([r.dated, r.invNo, r.description, r.qty, r.weight, r.kaat, r.netWeight, r.rate, r.asPer, r.amount]));
    });
    rows.push(["GRAND TOTAL", "", "", grandQty, "", "", grandNet, "", "", grandAmount]);
    exportToCSV(`sales-summary-${fromStr}-to-${toStr}`, headers, rows);
  };

  const DatePicker = ({ label, date, setDate, open, setOpen }: { label: string; date: Date; setDate: (d: Date) => void; open: boolean; setOpen: (o: boolean) => void }) => (
    <div className="flex items-center gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-[140px] justify-start text-xs">
            <CalendarIcon className="mr-1 h-3.5 w-3.5" />
            {format(date, "dd MMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setOpen(false); } }} initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Controls - hidden in print */}
        <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <DatePicker label="From" date={fromDate} setDate={setFromDate} open={fromOpen} setOpen={setFromOpen} />
            <DatePicker label="To" date={toDate} setDate={setToDate} open={toOpen} setOpen={setToOpen} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-0.5">
          <h2 className="text-lg font-bold uppercase">Al Madina Flour Mill</h2>
          <p className="text-xs text-muted-foreground">Sitta Road, Khairpur Nathan Shah</p>
          <p className="text-xs text-muted-foreground">Ph: 0309-1311499, 0345-3551100</p>
          <h3 className="text-sm font-bold mt-2 uppercase">
            Sales Summary From: {format(fromDate, "dd-MM-yyyy")} To: {format(toDate, "dd-MM-yyyy")}
          </h3>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">DATED</TableHead>
                <TableHead className="text-xs">INV #</TableHead>
                <TableHead className="text-xs">DESCRIPTION</TableHead>
                <TableHead className="text-xs text-right">QTY</TableHead>
                <TableHead className="text-xs text-right">WEIGHT</TableHead>
                <TableHead className="text-xs text-right">KAAT</TableHead>
                <TableHead className="text-xs text-right">NET WEIGHT</TableHead>
                <TableHead className="text-xs text-right">RATE</TableHead>
                <TableHead className="text-xs">AS PER</TableHead>
                <TableHead className="text-xs text-right">AMOUNT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSections.map((sec) => {
                if (sec.rows.length === 0) return null;
                const secQty = sec.rows.reduce((a, r) => a + r.qty, 0);
                const secWeight = sec.rows.reduce((a, r) => a + r.weight, 0);
                const secKaat = sec.rows.reduce((a, r) => a + r.kaat, 0);
                const secNet = sec.rows.reduce((a, r) => a + r.netWeight, 0);
                const secAmount = sec.rows.reduce((a, r) => a + r.amount, 0);
                const avgRate = sec.rows.length > 0 ? secAmount / secQty : 0;

                return (
                  <> 
                    {/* Section header */}
                    <TableRow key={`h-${sec.label}`} className="bg-muted/50">
                      <TableCell colSpan={10} className="font-bold text-xs py-1.5">{sec.label}</TableCell>
                    </TableRow>
                    {/* Data rows */}
                    {sec.rows.map((r, i) => (
                      <TableRow key={`${sec.label}-${i}`}>
                        <TableCell className="py-1">{r.dated}</TableCell>
                        <TableCell className="py-1">{r.invNo}</TableCell>
                        <TableCell className="py-1">{r.description}</TableCell>
                        <TableCell className="py-1 text-right">{fmtN(r.qty)}</TableCell>
                        <TableCell className="py-1 text-right">{fmtN(r.weight)}</TableCell>
                        <TableCell className="py-1 text-right">{fmtN(r.kaat)}</TableCell>
                        <TableCell className="py-1 text-right">{fmtN(r.netWeight)}</TableCell>
                        <TableCell className="py-1 text-right">{fmt(r.rate)}</TableCell>
                        <TableCell className="py-1">{r.asPer}</TableCell>
                        <TableCell className="py-1 text-right">{fmt(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Section subtotal */}
                    <TableRow key={`t-${sec.label}`} className="border-t-2 font-semibold">
                      <TableCell colSpan={3} className="text-right py-1 text-xs">TOTAL {sec.label}</TableCell>
                      <TableCell className="py-1 text-right text-xs">{fmtN(secQty)}</TableCell>
                      <TableCell className="py-1 text-right text-xs">{fmtN(secWeight)}</TableCell>
                      <TableCell className="py-1 text-right text-xs">{fmtN(secKaat)}</TableCell>
                      <TableCell className="py-1 text-right text-xs">{fmtN(secNet)}</TableCell>
                      <TableCell className="py-1 text-right text-xs">{fmt(avgRate)}</TableCell>
                      <TableCell className="py-1"></TableCell>
                      <TableCell className="py-1 text-right text-xs">{fmt(secAmount)}</TableCell>
                    </TableRow>
                  </>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold text-xs">
                <TableCell colSpan={3} className="text-right">GRAND TOTAL</TableCell>
                <TableCell className="text-right">{fmtN(grandQty)}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmtN(grandNet)}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmt(grandAmount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
