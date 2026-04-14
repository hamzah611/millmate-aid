import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Factory,
  BarChart3,
  Warehouse,
  Ruler,
  LogOut,
  Languages,
  Wheat,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppSidebar() {
  const { t, toggleLanguage, language, isRtl } = useLanguage();
  const { signOut } = useAuth();

  const navItems = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.contacts"), url: "/contacts", icon: Users },
    { title: t("nav.products"), url: "/products", icon: Package },
    { title: t("nav.sales"), url: "/sales", icon: ShoppingCart },
    { title: t("nav.receiptVouchers"), url: "/receipt-vouchers", icon: ArrowDownToLine, indent: true },
    { title: t("nav.purchases"), url: "/purchases", icon: Truck },
    { title: t("nav.paymentVouchers"), url: "/payment-vouchers", icon: ArrowUpFromLine, indent: true },
    { title: t("nav.production"), url: "/production", icon: Factory },
    { title: t("nav.reports"), url: "/reports", icon: BarChart3 },
    { title: t("nav.inventory"), url: "/inventory", icon: Warehouse },
    { title: t("nav.units"), url: "/units", icon: Ruler },
  ];

  return (
    <Sidebar side={isRtl ? "right" : "left"}>
      <div className="p-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20 ring-1 ring-sidebar-primary/30">
            <Wheat className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">{t("app.title")}</span>
          </div>
        </div>
      </div>
      <Separator className="mx-4 w-auto" />
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground ${(item as any).indent ? "ms-5 text-xs" : ""}`}
                      activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-medium border-s-2 border-sidebar-primary"
                    >
                      <item.icon className={`shrink-0 ${(item as any).indent ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-1">
        <Separator className="mb-2" />
        <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggleLanguage}>
          <Languages className="h-4 w-4" />
          {language === "en" ? "اردو" : "English"}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-destructive/80 hover:text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
