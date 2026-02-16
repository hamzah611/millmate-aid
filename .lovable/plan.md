

# Flour Mill Management Software — Phase 1

## Overview
A modern, clean flour mill management system with bilingual support (English/Urdu), multi-user access, and cloud storage. Built with Supabase backend for secure data storage and role-based access. Currency: PKR (₨).

---

## 1. Authentication & User Roles
- Login/signup page with email-based authentication
- Two roles: **Owner** (full access) and **Staff** (limited access — no financial reports, no user management)
- Role-based access stored securely in a separate `user_roles` table

## 2. App Layout & Navigation
- Modern sidebar navigation with icons for all modules
- **Language toggle** (English ↔ Urdu) in the header — switches all labels and layout direction (LTR/RTL)
- Responsive design for desktop and mobile
- Clean, card-based UI throughout

## 3. Dashboard (Home Page)
- Summary cards: Today's Sales, Today's Purchases, Total Cash, Total Receivables, Total Payables
- Low Stock Alerts — products below minimum stock level
- Overdue Invoices count
- Monthly Profit chart (bar/line chart)
- Inactive Customer alerts (no purchase in 30+ days)

## 4. Contacts Module (Customers & Suppliers)
- Add/edit contacts with: Name, Phone, Address
- Contact type: Customer, Supplier, or Both
- Optional credit limit and payment terms (7/15/30 days)
- Contact detail page showing: total purchases, total payments, pending balance, invoice history
- Inactive customer indicator

## 5. Products & Inventory Module
- **Categories**: Wheat, Rice, Flour, Bran (Chhil), Others
- **Subproducts** under categories (e.g., Wheat → Atta, Chhil)
- Stock tracking per product with minimum stock level alerts
- **Custom Units**: Define units like MUN (40 KG), BAG (50 KG) with automatic conversion
- Tradeable vs. non-tradeable product flag
- **Production/Conversion**: Convert raw material to subproducts with adjustable ratios (e.g., 1000 KG Wheat → 800 KG Atta + 200 KG Chhil). Ratios adjustable based on material quality.

## 6. Sales Invoice Module
- Select customer, add products with quantity (in any unit — auto-converts)
- Set price per unit, apply discounts and transport charges
- Payment type: Cash, Credit, or Partial payment
- Auto-reduces stock on completion
- Credit sales added to receivables
- Price editable per invoice (with price history tracking)

## 7. Purchase Invoice Module
- Select supplier, add purchased products
- Quantity and rate entry with unit conversion
- Payment status tracking (Paid / Pending)
- Auto-increases stock on completion

## 8. Invoice Aging System
- Receivables aging buckets: 0–7, 8–15, 16–30, 30+ days
- Payables aging buckets with same structure
- Dashboard integration showing overdue counts

---

## Future Phases (not included in Phase 1)
- Accounting reports (P&L, Balance Sheet, Cash Flow)
- Expense tracking
- Daily cash closing report
- WhatsApp invoice sending & SMS reminders
- Barcode support
- Data backup/export features

