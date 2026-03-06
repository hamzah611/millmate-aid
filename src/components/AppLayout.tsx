import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationPanel } from "@/components/NotificationPanel";

export function AppLayout() {
  const { isRtl } = useLanguage();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur-md flex items-center px-4 gap-3 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1" />
            <GlobalSearch />
            <NotificationPanel />
          </header>
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
