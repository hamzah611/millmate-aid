import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

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
  products: Product[];
  units: Unit[];
  onChange: (item: InvoiceItem) => void;
  onRemove: () => void;
}

const InvoiceItemRow = ({ item, products, units, onChange, onRemove }: Props) => {
  const { t, language } = useLanguage();

  const selectedProduct = products.find((p) => p.id === item.product_id);
  const selectedUnit = units.find((u) => u.id === item.unit_id);
  const productDefaultUnit = units.find((u) => u.id === selectedProduct?.unit_id);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const unitId = product.unit_id || units.find((u) => u.kg_value === 1)?.id || "";
    const price = product.default_price || 0;
    const total = item.quantity * price;
    onChange({ ...item, product_id: productId, unit_id: unitId, price_per_unit: price, total });
  };

  const handleUnitChange = (unitId: string) => {
    // Recalculate price based on unit conversion
    const newUnit = units.find((u) => u.id === unitId);
    if (!newUnit || !selectedProduct || !productDefaultUnit) {
      onChange({ ...item, unit_id: unitId });
      return;
    }
    // Convert default price to new unit
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

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      {/* Product */}
      <div className="col-span-4">
        <Select value={item.product_id} onValueChange={handleProductChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t("products.name")} />
          </SelectTrigger>
          <SelectContent>
            {products.filter((p) => p.is_tradeable).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {language === "ur" && p.name_ur ? p.name_ur : p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Unit */}
      <div className="col-span-2">
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
      <div className="col-span-2">
        <Input
          type="number"
          min={0}
          step="any"
          className="h-9 text-sm"
          value={item.quantity || ""}
          onChange={(e) => handleQtyChange(parseFloat(e.target.value) || 0)}
          placeholder={t("invoice.quantity")}
        />
      </div>

      {/* Price */}
      <div className="col-span-2">
        <Input
          type="number"
          min={0}
          step="any"
          className="h-9 text-sm"
          value={item.price_per_unit || ""}
          onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
          placeholder={t("invoice.price")}
        />
      </div>

      {/* Total + Remove */}
      <div className="col-span-2 flex items-center gap-1">
        <span className="text-sm font-medium flex-1 text-end" dir="ltr">
          ₨ {item.total.toLocaleString()}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InvoiceItemRow;
