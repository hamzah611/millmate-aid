import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Clock, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  icon: typeof AlertTriangle;
  url: string;
  severity: "warning" | "critical";
}

export function NotificationPanel() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const items: Notification[] = [];

      // Low stock products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_qty, min_stock_level");
      products?.forEach(p => {
        if (p.stock_qty <= p.min_stock_level) {
          items.push({
            id: `low-${p.id}`,
            title: t("notifications.lowStock"),
            message: `${p.name} (${p.stock_qty} KG)`,
            icon: AlertTriangle,
            url: "/inventory",
            severity: p.stock_qty <= p.min_stock_level * 0.5 ? "critical" : "warning",
          });
        }
      });

      // Overdue invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, invoice_type, payment_status, contacts(payment_terms)")
        .in("payment_status", ["credit", "partial"]);
      const now = new Date();
      invoices?.forEach(inv => {
        const terms = parseInt((inv.contacts as any)?.payment_terms || "30", 10);
        const due = new Date(inv.invoice_date);
        due.setDate(due.getDate() + terms);
        if (now > due) {
          const daysOver = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          items.push({
            id: `overdue-${inv.id}`,
            title: t("notifications.overdueInvoice"),
            message: `${inv.invoice_number} — ${daysOver} ${t("reports.daysOverdue")}`,
            icon: Clock,
            url: inv.invoice_type === "sale" ? "/sales" : "/purchases",
            severity: daysOver > 30 ? "critical" : "warning",
          });
        }
      });

      // Batches nearing expiry (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const { data: batches } = await supabase
        .from("batches")
        .select("id, batch_number, expiry_date, products(name)")
        .not("expiry_date", "is", null)
        .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0]);
      batches?.forEach(b => {
        if (b.expiry_date) {
          items.push({
            id: `expiry-${b.id}`,
            title: t("notifications.batchExpiry"),
            message: `${b.batch_number} — ${(b.products as any)?.name || ""} (${b.expiry_date})`,
            icon: Package,
            url: "/inventory",
            severity: new Date(b.expiry_date) < now ? "critical" : "warning",
          });
        }
      });

      return items;
    },
    refetchInterval: 60000, // refresh every minute
  });

  const count = notifications?.length || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -end-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="text-sm font-semibold">{t("notifications.title")}</h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!count ? (
            <p className="p-4 text-sm text-muted-foreground text-center">{t("notifications.none")}</p>
          ) : (
            notifications?.map(n => (
              <button
                key={n.id}
                className="w-full text-start flex items-start gap-3 p-3 hover:bg-muted/50 border-b last:border-0 transition-colors"
                onClick={() => navigate(n.url)}
              >
                <n.icon className={`h-4 w-4 mt-0.5 shrink-0 ${n.severity === "critical" ? "text-destructive" : "text-amber-500"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
