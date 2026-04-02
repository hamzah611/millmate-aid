import { useRef, useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  sub_unit_id?: string | null;
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
  showLabels?: boolean;
}

const InvoiceItemRow = ({ item, index, products, units, invoiceType, onChange, onRemove, onAddNext, autoFocusProduct, showLabels = true }: Props) => {
  const { t, language } = useLanguage();
  const qtyRef = useRef<HTMLInputElement>(null);
  const subQtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find((p) => p.id === item.product_id);
  const selectedUnit = units.find((u) => u.id === item.unit_id);
  const subUnit = selectedUnit?.sub_unit_id ? units.find((u) => u.id === selectedUnit.sub_unit_id) : null;
  const productDefaultUnit = units.find((u) => u.id === selectedProduct?.unit_id);

  // Validate: sub-unit must differ from primary unit
  const validSubUnit = subUnit && subUnit.id !== selectedUnit?.id ? subUnit : null;

  const [mainQty, setMainQty] = useState<number>(0);
  const [subQty, setSubQty] = useState<number>(0);

  useEffect(() => {
    if (validSubUnit && selectedUnit && item.quantity > 0) {
      const main = Math.floor(item.quantity);
      const remainder = item.quantity - main;
      const sub = Math.round(remainder * selectedUnit.kg_value / validSubUnit.kg_value * 100) / 100;
      setMainQty(main);
      setSubQty(sub);
    } else {
      setMainQty(item.quantity);
      setSubQty(0);
    }
  }, [item.unit_id]);

  const productOptions = products.filter((p) => p.is_tradeable).map((p) => {
    const pUnit = units.find(u => u.id === p.unit_id);
    const pUnitName = pUnit ? (language === "ur" && pUnit.name_ur ? pUnit.name_ur : pUnit.name) : "KG";
    return {
      value: p.id,
      label: language === "ur" && p.name_ur ? p.name_ur : p.name,
      sublabel: invoiceType === "sale" ? `${t("invoice.stockAvailable")}: ${p.stock_qty} ${pUnitName}` : undefined,
    };
  });

  const computeQuantity = (main: number, sub: number): number => {
    if (validSubUnit && selectedUnit) {
      return main + (sub * validSubUnit.kg_value / selectedUnit.kg_value);
    }
    return main;
  };

  const computeTotalKg = (qty: number): number => {
    if (!selectedUnit) return 0;
    return qty * selectedUnit.kg_value;
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const unitId = product.unit_id || units.find((u) => u.kg_value === 1)?.id || "";
    const price = product.default_price || 0;
    const qty = computeQuantity(mainQty, subQty);
    const total = qty * price;
    onChange({ ...item, product_id: productId, unit_id: unitId, price_per_unit: price, quantity: qty, total });
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
    setMainQty(0);
    setSubQty(0);
    onChange({ ...item, unit_id: unitId, price_per_unit: newPrice, quantity: 0, total: 0 });
  };

  const handleMainQtyChange = (main: number) => {
    setMainQty(main);
    const qty = computeQuantity(main, subQty);
    const total = qty * item.price_per_unit;
    onChange({ ...item, quantity: qty, total });
  };

  const handleSubQtyChange = (sub: number) => {
    setSubQty(sub);
    const qty = computeQuantity(mainQty, sub);
    const total = qty * item.price_per_unit;
    onChange({ ...item, quantity: qty, total });
  };

  const handleSimpleQtyChange = (qty: number) => {
    setMainQty(qty);
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
      if (validSubUnit && subQtyRef.current) {
        subQtyRef.current.focus();
      } else {
        priceRef.current?.focus();
      }
    }
  };

  const handleSubQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      priceRef.current?.focus();
    }
  };

  const unitName = (u: Unit) => language === "ur" && u.name_ur ? u.name_ur : u.name;

  const totalKg = computeTotalKg(item.quantity);
  const showHelper = !!selectedUnit && item.quantity > 0;

  return (
    <div className="group relative">
      {/* Always 7-column grid to match header */}
      <div className="grid items-end gap-2 grid-cols-[2fr_1fr_0.7fr_0.7fr_1fr_1fr_auto] max-md:grid-cols-1 max-md:gap-3 max-md:rounded-lg max-md:border max-md:border-border max-md:bg-card max-md:p-3">

        {/* Product */}
        <div className="space-y-1">
          {showLabels && <label className="text-xs font-medium text-muted-foreground md:hidden">{t("products.name")}</label>}
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
        <div className="space-y-1">
          {showLabels && <label className="text-xs font-medium text-muted-foreground md:hidden">{t("products.unit")}</label>}
          <Select value={item.unit_id} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={t("products.unit")} />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {unitName(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quantity — main */}
        <div className="space-y-1">
          {showLabels && <label className="text-xs font-medium text-muted-foreground md:hidden">
            {t("invoice.quantity")}
          </label>}
          <Input
            ref={qtyRef}
            type="number"
            min={0}
            step="any"
            className="h-9 text-sm"
            value={mainQty || ""}
            onChange={(e) => validSubUnit ? handleMainQtyChange(parseFloat(e.target.value) || 0) : handleSimpleQtyChange(parseFloat(e.target.value) || 0)}
            onKeyDown={handleQtyKeyDown}
            placeholder="0"
          />
        </div>

        {/* Sub-unit quantity — always visible for stable grid */}
        <div className="space-y-1">
          {showLabels && <label className="text-xs font-medium text-muted-foreground md:hidden">
            {t("invoice.subQty")}
          </label>}
          {validSubUnit ? (
            <Input
              ref={subQtyRef}
              type="number"
              min={0}
              step="any"
              className="h-9 text-sm"
              value={subQty || ""}
              onChange={(e) => handleSubQtyChange(parseFloat(e.target.value) || 0)}
              onKeyDown={handleSubQtyKeyDown}
              placeholder={unitName(validSubUnit)}
            />
          ) : (
            <Input
              type="number"
              className="h-9 text-sm"
              disabled
              placeholder="—"
              tabIndex={-1}
            />
          )}
        </div>

        {/* Price */}
        <div className="space-y-1">
          {showLabels && <label className="text-xs font-medium text-muted-foreground md:hidden">{t("invoice.price")}</label>}
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
        <div className="flex items-end gap-1">
          <div className="flex-1 space-y-1">
            {showLabels && <label className="text-xs font-medium text-muted-foreground md:hidden">{t("invoice.total")}</label>}
            <div className="h-9 flex items-center justify-end text-sm font-semibold tabular-nums whitespace-nowrap" dir="ltr">
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

      {/* Helper text: Total KG */}
      {showHelper && (
        <p className="text-xs text-muted-foreground mt-0.5 ms-1 tabular-nums">
          {t("invoice.totalKg").replace("{0}", totalKg.toFixed(1))}
        </p>
      )}

      {/* Stock warning for sales */}
      {invoiceType === "sale" && selectedProduct && selectedUnit && item.quantity > 0 && (() => {
        const kgQty = item.quantity * selectedUnit.kg_value;
        if (kgQty > selectedProduct.stock_qty) {
          return (
            <p className="text-xs text-destructive mt-0.5 ms-1">
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
