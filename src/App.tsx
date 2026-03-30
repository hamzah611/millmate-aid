import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Contacts from "./pages/Contacts";
import ContactNew from "./pages/ContactNew";
import ContactEdit from "./pages/ContactEdit";
import ContactLedger from "./pages/ContactLedger";
import Products from "./pages/Products";
import ProductNew from "./pages/ProductNew";
import ProductEdit from "./pages/ProductEdit";
import Sales from "./pages/Sales";
import SaleNew from "./pages/SaleNew";
import Purchases from "./pages/Purchases";
import PurchaseNew from "./pages/PurchaseNew";
import Production from "./pages/Production";
import ProductionNew from "./pages/ProductionNew";
import Reports from "./pages/Reports";
import Inventory from "./pages/Inventory";
import Adjustments from "./pages/Adjustments";
import AdjustmentNew from "./pages/AdjustmentNew";
import BatchNew from "./pages/BatchNew";
import Expenses from "./pages/Expenses";
import ExpenseNew from "./pages/ExpenseNew";
import ExpenseEdit from "./pages/ExpenseEdit";
import Units from "./pages/Units";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route element={!user ? <Navigate to="/auth" replace /> : <AppLayout />}>
        <Route path="/" element={<Index />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/new" element={<ContactNew />} />
        <Route path="/contacts/:id/edit" element={<ContactEdit />} />
        <Route path="/contacts/:id/ledger" element={<ContactLedger />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/new" element={<ProductNew />} />
        <Route path="/products/:id/edit" element={<ProductEdit />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/new" element={<SaleNew />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchases/new" element={<PurchaseNew />} />
        <Route path="/production" element={<Production />} />
        <Route path="/production/new" element={<ProductionNew />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/adjustments" element={<Adjustments />} />
        <Route path="/inventory/adjustments/new" element={<AdjustmentNew />} />
        <Route path="/inventory/batches/new" element={<BatchNew />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/new" element={<ExpenseNew />} />
        <Route path="/expenses/edit/:id" element={<ExpenseEdit />} />
        <Route path="/units" element={<Units />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="flour-mill-theme">
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
