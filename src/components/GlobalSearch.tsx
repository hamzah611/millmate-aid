import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  name: string;
  type: "contact" | "invoice" | "product" | "batch";
  url: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const search = async () => {
      const items: SearchResult[] = [];

      const [contacts, invoices, products, batches] = await Promise.all([
        supabase.from("contacts").select("id, name").ilike("name", `%${query}%`).limit(5),
        supabase.from("invoices").select("id, invoice_number, invoice_type").ilike("invoice_number", `%${query}%`).limit(5),
        supabase.from("products").select("id, name").ilike("name", `%${query}%`).limit(5),
        supabase.from("batches").select("id, batch_number").ilike("batch_number", `%${query}%`).limit(5),
      ]);

      contacts.data?.forEach(c => items.push({ id: c.id, name: c.name, type: "contact", url: `/contacts/${c.id}/ledger` }));
      invoices.data?.forEach(i => items.push({
        id: i.id, name: i.invoice_number, type: "invoice",
        url: i.invoice_type === "sale" ? "/sales" : "/purchases",
      }));
      products.data?.forEach(p => items.push({ id: p.id, name: p.name, type: "product", url: `/products/${p.id}/edit` }));
      batches.data?.forEach(b => items.push({ id: b.id, name: b.batch_number, type: "batch", url: "/inventory" }));

      setResults(items);
    };
    search();
  }, [query]);

  const typeLabel = (type: string) => {
    switch (type) {
      case "contact": return t("search.contact");
      case "invoice": return t("search.invoice");
      case "product": return t("search.product");
      case "batch": return t("search.batch");
      default: return type;
    }
  };

  const typeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "contact": return "default";
      case "invoice": return "secondary";
      case "product": return "outline";
      default: return "outline";
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{t("search.placeholder")}</span>
        <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("search.placeholder")} value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{t("common.noData")}</CommandEmpty>
          {results.length > 0 && (
            <CommandGroup heading={t("search.results")}>
              {results.map(r => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  onSelect={() => { navigate(r.url); setOpen(false); setQuery(""); }}
                  className="flex items-center justify-between"
                >
                  <span>{r.name}</span>
                  <Badge variant={typeVariant(r.type)} className="text-xs">{typeLabel(r.type)}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
