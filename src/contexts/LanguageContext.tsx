import React, { createContext, useContext, useState, useCallback } from "react";

type Language = "en" | "ur";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const translations: Record<string, Record<Language, string>> = {
  // App
  "app.title": { en: "Flour Mill Manager", ur: "فلور مل مینیجر" },

  // Auth
  "auth.login": { en: "Log In", ur: "لاگ ان" },
  "auth.signup": { en: "Sign Up", ur: "سائن اپ" },
  "auth.email": { en: "Email", ur: "ای میل" },
  "auth.password": { en: "Password", ur: "پاس ورڈ" },
  "auth.fullName": { en: "Full Name", ur: "پورا نام" },
  "auth.noAccount": { en: "Don't have an account?", ur: "اکاؤنٹ نہیں ہے؟" },
  "auth.hasAccount": { en: "Already have an account?", ur: "اکاؤنٹ پہلے سے ہے؟" },
  "auth.loggingIn": { en: "Logging in...", ur: "لاگ ان ہو رہا ہے..." },
  "auth.signingUp": { en: "Signing up...", ur: "سائن اپ ہو رہا ہے..." },
  "auth.logout": { en: "Logout", ur: "لاگ آؤٹ" },
  "auth.checkEmail": { en: "Check your email for a confirmation link.", ur: "تصدیقی لنک کے لیے اپنا ای میل چیک کریں۔" },

  // Nav
  "nav.dashboard": { en: "Dashboard", ur: "ڈیش بورڈ" },
  "nav.contacts": { en: "Contacts", ur: "روابط" },
  "nav.products": { en: "Products", ur: "مصنوعات" },
  "nav.sales": { en: "Sales", ur: "فروخت" },
  "nav.purchases": { en: "Purchases", ur: "خریداری" },
  "nav.production": { en: "Production", ur: "پیداوار" },

  // Dashboard
  "dashboard.todaySales": { en: "Today's Sales", ur: "آج کی فروخت" },
  "dashboard.todayPurchases": { en: "Today's Purchases", ur: "آج کی خریداری" },
  "dashboard.totalCash": { en: "Total Cash", ur: "کل نقد" },
  "dashboard.receivables": { en: "Receivables", ur: "وصولیاں" },
  "dashboard.payables": { en: "Payables", ur: "واجبات" },
  "dashboard.lowStock": { en: "Low Stock Alerts", ur: "کم اسٹاک الرٹس" },
  "dashboard.overdueInvoices": { en: "Overdue Invoices", ur: "واجب الادا انوائسز" },
  "dashboard.monthlyProfit": { en: "Monthly Profit", ur: "ماہانہ منافع" },

  // Production
  "production.create": { en: "New Conversion", ur: "نئی تبدیلی" },
  "production.source": { en: "Source Product", ur: "ذریعہ مصنوعات" },
  "production.sourceQty": { en: "Source Qty (KG)", ur: "ذریعہ مقدار (KG)" },
  "production.outputs": { en: "Output Products", ur: "پیداوار مصنوعات" },
  "production.history": { en: "Production History", ur: "پیداوار کی تاریخ" },

  // Contacts
  "contacts.title": { en: "Contacts", ur: "روابط" },
  "contacts.add": { en: "Add Contact", ur: "رابطہ شامل کریں" },
  "contacts.name": { en: "Name", ur: "نام" },
  "contacts.phone": { en: "Phone", ur: "فون" },
  "contacts.address": { en: "Address", ur: "پتہ" },
  "contacts.type": { en: "Type", ur: "قسم" },
  "contacts.customer": { en: "Customer", ur: "گاہک" },
  "contacts.supplier": { en: "Supplier", ur: "فراہم کنندہ" },
  "contacts.both": { en: "Both", ur: "دونوں" },
  "contacts.creditLimit": { en: "Credit Limit", ur: "کریڈٹ حد" },
  "contacts.paymentTerms": { en: "Payment Terms (days)", ur: "ادائیگی کی شرائط (دن)" },

  // Products
  "products.title": { en: "Products & Inventory", ur: "مصنوعات اور انوینٹری" },
  "products.add": { en: "Add Product", ur: "مصنوعات شامل کریں" },
  "products.name": { en: "Product Name", ur: "مصنوعات کا نام" },
  "products.category": { en: "Category", ur: "زمرہ" },
  "products.unit": { en: "Unit", ur: "اکائی" },
  "products.stock": { en: "Stock", ur: "اسٹاک" },
  "products.minStock": { en: "Min Stock Level", ur: "کم از کم اسٹاک" },
  "products.price": { en: "Default Price (₨)", ur: "طے شدہ قیمت (₨)" },
  "products.tradeable": { en: "Tradeable", ur: "تجارتی" },

  // Invoices
  "invoice.sales": { en: "Sales Invoices", ur: "فروخت انوائسز" },
  "invoice.purchases": { en: "Purchase Invoices", ur: "خریداری انوائسز" },
  "invoice.create": { en: "Create Invoice", ur: "انوائس بنائیں" },
  "invoice.number": { en: "Invoice #", ur: "انوائس نمبر" },
  "invoice.date": { en: "Date", ur: "تاریخ" },
  "invoice.contact": { en: "Contact", ur: "رابطہ" },
  "invoice.total": { en: "Total", ur: "کل" },
  "invoice.status": { en: "Status", ur: "حالت" },
  "invoice.paid": { en: "Paid", ur: "ادا شدہ" },
  "invoice.pending": { en: "Pending", ur: "زیر التوا" },
  "invoice.partial": { en: "Partial", ur: "جزوی" },
  "invoice.credit": { en: "Credit", ur: "ادھار" },
  "invoice.selectContact": { en: "Select contact", ur: "رابطہ منتخب کریں" },
  "invoice.addItem": { en: "Add Item", ur: "آئٹم شامل کریں" },
  "invoice.addItems": { en: "Add at least one valid item", ur: "کم از کم ایک آئٹم شامل کریں" },
  "invoice.quantity": { en: "Qty", ur: "مقدار" },
  "invoice.price": { en: "Price", ur: "قیمت" },
  "invoice.subtotal": { en: "Subtotal", ur: "ذیلی کل" },
  "invoice.discount": { en: "Discount (₨)", ur: "رعایت (₨)" },
  "invoice.transport": { en: "Transport (₨)", ur: "ٹرانسپورٹ (₨)" },
  "invoice.paymentMethod": { en: "Payment", ur: "ادائیگی" },
  "invoice.amountPaid": { en: "Amount Paid", ur: "ادا شدہ رقم" },
  "invoice.balanceDue": { en: "Balance Due", ur: "باقی رقم" },

  // Payment
  "payment.record": { en: "Record Payment", ur: "ادائیگی درج کریں" },
  "payment.amount": { en: "Amount", ur: "رقم" },
  "payment.history": { en: "Payment History", ur: "ادائیگی کی تاریخ" },
  "payment.recorded": { en: "Payment recorded", ur: "ادائیگی درج ہو گئی" },
  "payment.invalidAmount": { en: "Invalid amount", ur: "غلط رقم" },

  // Filters
  "filter.all": { en: "All", ur: "سب" },
  "filter.from": { en: "From", ur: "سے" },
  "filter.to": { en: "To", ur: "تک" },
  "filter.clear": { en: "Clear", ur: "صاف کریں" },

  // Common
  "common.save": { en: "Save", ur: "محفوظ کریں" },
  "common.saved": { en: "Saved", ur: "محفوظ ہو گیا" },
  "common.updated": { en: "Updated", ur: "اپ ڈیٹ ہو گیا" },
  "common.deleted": { en: "Deleted", ur: "حذف ہو گیا" },
  "common.cancel": { en: "Cancel", ur: "منسوخ" },
  "common.delete": { en: "Delete", ur: "حذف کریں" },
  "common.edit": { en: "Edit", ur: "ترمیم" },
  "common.actions": { en: "Actions", ur: "عمل" },
  "common.search": { en: "Search...", ur: "تلاش..." },
  "common.noData": { en: "No data found", ur: "کوئی ڈیٹا نہیں ملا" },
  "common.loading": { en: "Loading...", ur: "لوڈ ہو رہا ہے..." },
  "common.currency": { en: "₨", ur: "₨" },
  "common.confirmDelete": { en: "Are you sure?", ur: "کیا آپ کو یقین ہے؟" },
  "common.confirmDeleteDesc": { en: "This action cannot be undone.", ur: "یہ عمل واپس نہیں ہو سکتا۔" },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem("lang") as Language) || "en";
  });

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const next = prev === "en" ? "ur" : "en";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string) => translations[key]?.[language] ?? key,
    [language]
  );

  const isRtl = language === "ur";

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, isRtl }}>
      <div dir={isRtl ? "rtl" : "ltr"} className={isRtl ? "font-urdu" : ""}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
