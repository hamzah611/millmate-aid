import { useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import SearchableCombobox from "./SearchableCombobox";

export interface InvoiceItem {
  id: string;
  product_id: string;
  unit_id: string;
  quantity: number;
  price_per_unit: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  name_ur: string | null;
  default_price: number;
  unit_id: string | null;
  stock_qty: number;
  is_tradeable: boolean;
}

interface Unit {
  id: string;
  name: string;
  name_ur: string | null;
  kg_value: number;
}

interface Props {
  item: InvoiceItem;
  index: number;
  products: Product[];
  units: Unit[];
  invoiceType: "sale" | "purchase";
  onChange: (item: InvoiceItem) => void;
  onRemove: () => void;
  onAddNext: () => void;
  autoFocusProduct?: boolean;
}

const InvoiceItemRow = ({ item, index, products, units, invoiceType, onChange, onRemove, onAddNext, autoFocusProduct }: Props) => {
  const { t, language } = useLanguage();
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find((p) => p.id === item.product_id);
  const selectedUnit = units.find((u) => u.id === item.unit_id);
  const productDefaultUnit = units.find((u) => u.id === selectedProduct?.unit_id);

  const productOptions = products.filter((p) => p.is_tradeable).map((p) => ({
    value: p.id,
    label: language === "ur" && p.name_ur ? p.name_ur : p.name,
    sublabel: invoiceType === "sale" ? `${t("invoice.stockAvailable")}: ${p.stock_qty} kg` : undefined,
  }));

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const unitId = product.unit_id || units.find((u) => u.kg_value === 1)?.id || "";
    const price = product.default_price || 0;
    const total = item.quantity * price;
    onChange({ ...item, product_id: productId, unit_id: unitId, price_per_unit: price, total });
    // Auto-focus quantity after product selection
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const handleUnitChange = (unitId: string) => {
    const newUnit = units.find((u) => u.id === unitId);
    if (!newUnit || !selectedProduct || !productDefaultUnit) {
      onChange({ ...item, unit_id: unitId });
      return;
    }
    const pricePerKg = selectedProduct.default_price / productDefaultUnit.kg_value;
    const newPrice = Math.round(pricePerKg * newUnit.kg_value * 100) / 100;
    const total = item.quantity * newPrice;
    onChange({ ...item, unit_id: unitId, price_per_unit: newPrice, total });
  };

  const handleQtyChange = (qty: number) => {
    const total = qty * item.price_per_unit;
    onChange({ ...item, quantity: qty, total });
  };

  const handlePriceChange = (price: number) => {
    const total = item.quantity * price;
    onChange({ ...item, price_per_unit: price, total });
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddNext();
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      priceRef.current?.focus();
    }
  };

  return (
    <div className="group relative rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30">
      {/* Row number badge */}
      <div className="absolute -top-2.5 start-3">
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
          #{index + 1}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* Product - searchable */}
        <div className="md:col-span-4 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("products.name")}</label>
          <SearchableCombobox
            value={item.product_id}
            onValueChange={handleProductChange}
            options={productOptions}
            placeholder={t("products.name")}
            searchPlaceholder={t("invoice.searchProduct")}
            emptyText={t("invoice.noProduct")}
            autoFocus={autoFocusProduct}
            triggerClassName="h-9"
          />
        </div>

        {/* Unit */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("products.unit")}</label>
          <Select value={item.unit_id} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={t("products.unit")} />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {language === "ur" && u.name_ur ? u.name_ur : u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("invoice.quantity")}</label>
          <Input
            ref={qtyRef}
            type="number"
            min={0}
            step="any"
            className="h-9 text-sm"
            value={item.quantity || ""}
            onChange={(e) => handleQtyChange(parseFloat(e.target.value) || 0)}
            onKeyDown={handleQtyKeyDown}
            placeholder="0"
          />
        </div>

        {/* Price */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("invoice.price")}</label>
          <Input
            ref={priceRef}
            type="number"
            min={0}
            step="any"
            className="h-9 text-sm"
            value={item.price_per_unit || ""}
            onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
            onKeyDown={handlePriceKeyDown}
            placeholder="0"
          />
        </div>

        {/* Total + Remove */}
        <div className="md:col-span-2 flex items-end gap-1">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("invoice.total")}</label>
            <div className="h-9 flex items-center justify-end text-sm font-semibold tabular-nums" dir="ltr">
              ₨ {item.total.toLocaleString()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onRemove}
            tabIndex={-1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stock warning for sales */}
      {invoiceType === "sale" && selectedProduct && selectedUnit && item.quantity > 0 && (() => {
        const kgQty = item.quantity * selectedUnit.kg_value;
        if (kgQty > selectedProduct.stock_qty) {
          return (
            <p className="text-xs text-destructive mt-2">
              ⚠ {t("invoice.quantity")} ({kgQty.toFixed(1)} kg) &gt; {t("invoice.stockAvailable")} ({selectedProduct.stock_qty.toFixed(1)} kg)
            </p>
          );
        }
        return null;
      })()}
    </div>
  );
};

export default InvoiceItemRow;
