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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { t, toggleLanguage, language } = useLanguage();
  const { signOut } = useAuth();

  const navItems = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.contacts"), url: "/contacts", icon: Users },
    { title: t("nav.products"), url: "/products", icon: Package },
    { title: t("nav.sales"), url: "/sales", icon: ShoppingCart },
    { title: t("nav.purchases"), url: "/purchases", icon: Truck },
    { title: t("nav.production"), url: "/production", icon: Factory },
    { title: t("nav.reports"), url: "/reports", icon: BarChart3 },
    { title: t("nav.inventory"), url: "/inventory", icon: Warehouse },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4 py-3">
            {t("app.title")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleLanguage}>
          <Languages className="mr-2 h-4 w-4" />
          {language === "en" ? "اردو" : "English"}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
