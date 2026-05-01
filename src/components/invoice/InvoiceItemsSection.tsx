import { type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InvoiceItemRow, { type InvoiceItem } from "@/components/InvoiceItemRow";
import { Plus, Package } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceType } from "@/hooks/useInvoiceForm";

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
  type: InvoiceType;
  items: InvoiceItem[];
  addItem: () => void;
  updateItem: (id: string, updated: InvoiceItem) => void;
  removeItem: (id: string) => void;
  products: Product[] | undefined;
  units: Unit[] | undefined;
  lastAddedItemId: string | null;
  itemsEndRef: RefObject<HTMLDivElement>;
}

export default function InvoiceItemsSection({
  type, items, addItem, updateItem, removeItem,
  products, units, lastAddedItemId, itemsEndRef,
}: Props) {
  const { t } = useLanguage();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("invoice.itemsSection")}
        </h3>
        {items.length > 0 && (
          <Badge variant="outline" className="text-xs tabular-nums">
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-border bg-muted/30">
          <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">{t("invoice.emptyItems")}</p>
          <p className="text-xs text-muted-foreground/70 mb-3">{t("invoice.emptyItemsHint")}</p>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="hidden md:grid gap-2 text-xs font-medium text-muted-foreground pb-1 border-b border-border grid-cols-[2fr_1fr_0.7fr_0.7fr_1fr_1fr_auto]">
            <span>{t("products.name")}</span>
            <span>{t("products.unit")}</span>
            <span>{t("invoice.quantity")}</span>
            <span>{t("invoice.subQty")}</span>
            <span>{t("invoice.price")}</span>
            <span className="text-end">{t("invoice.total")}</span>
            <span className="w-9"></span>
          </div>
          {items.map((item, idx) => (
            <InvoiceItemRow
              key={item.id}
              item={item}
              index={idx}
              products={products || []}
              units={units || []}
              invoiceType={type}
              onChange={(updated) => updateItem(item.id, updated)}
              onRemove={() => removeItem(item.id)}
              onAddNext={addItem}
              autoFocusProduct={item.id === lastAddedItemId}
              showLabels={false}
            />
          ))}
          <div ref={itemsEndRef} />
          <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed mt-2">
            <Plus className="h-4 w-4 me-1" /> {t("invoice.addItem")}
          </Button>
        </div>
      )}
    </div>
  );
}
