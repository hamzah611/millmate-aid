import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const items: Notification[] = [];

      const { data: unitsList } = await supabase.from("units").select("id, name, name_ur");
      const getUN = (unitId: string | null) => {
        if (!unitId || !unitsList) return "";
        const u = unitsList.find(u => u.id === unitId);
        return u ? (language === "ur" && u.name_ur ? u.name_ur : u.name) : "";
      };

      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_qty, min_stock_level, unit_id");
      products?.forEach(p => {
        if (p.stock_qty <= p.min_stock_level) {
          items.push({
            id: `low-${p.id}`,
            title: t("notifications.lowStock"),
            message: `${p.name} (${p.stock_qty} ${getUN(p.unit_id)})`,
            icon: AlertTriangle,
            url: "/inventory",
            severity: p.stock_qty <= p.min_stock_level * 0.5 ? "critical" : "warning",
          });
        }
      });

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, invoice_type, payment_status, contacts!invoices_contact_id_fkey(payment_terms)")
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
    refetchInterval: 60000,
  });

  const count = notifications?.length || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4.5 w-4.5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-lg" align="end">
        <div className="p-3 border-b bg-muted/30">
          <h4 className="text-sm font-semibold">{t("notifications.title")}</h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!count ? (
            <p className="p-4 text-sm text-muted-foreground text-center">{t("notifications.none")}</p>
          ) : (
            notifications?.map(n => (
              <button
                key={n.id}
                className="w-full text-start flex items-start gap-3 p-3 hover:bg-muted/50 border-b last:border-0 transition-colors group"
                onClick={() => navigate(n.url)}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md mt-0.5 ${n.severity === "critical" ? "bg-destructive/10" : "bg-amber-500/10"}`}>
                  <n.icon className={`h-3.5 w-3.5 ${n.severity === "critical" ? "text-destructive" : "text-amber-500"}`} />
                </div>
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
