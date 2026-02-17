import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

type ContactType = "customer" | "supplier" | "both";
type PaymentTerms = "7" | "15" | "30";

const Contacts = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    contact_type: "customer" as ContactType,
    credit_limit: 0,
    payment_terms: null as PaymentTerms | null,
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").insert({
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        contact_type: form.contact_type,
        credit_limit: form.credit_limit,
        payment_terms: form.payment_terms,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false);
      setForm({ name: "", phone: "", address: "", contact_type: "customer", credit_limit: 0, payment_terms: null });
      toast.success("Contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = contacts?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("contacts.title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />{t("contacts.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("contacts.add")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); addContact.mutate(); }}
              className="space-y-3"
            >
              <Input placeholder={t("contacts.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder={t("contacts.phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder={t("contacts.address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v as ContactType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{t("contacts.customer")}</SelectItem>
                  <SelectItem value="supplier">{t("contacts.supplier")}</SelectItem>
                  <SelectItem value="both">{t("contacts.both")}</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder={t("contacts.creditLimit")} value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: +e.target.value })} />
              <Select value={form.payment_terms ?? ""} onValueChange={(v) => setForm({ ...form, payment_terms: v as PaymentTerms })}>
                <SelectTrigger><SelectValue placeholder={t("contacts.paymentTerms")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={addContact.isPending}>
                {t("common.save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("contacts.name")}</TableHead>
                <TableHead>{t("contacts.phone")}</TableHead>
                <TableHead>{t("contacts.type")}</TableHead>
                <TableHead>{t("contacts.creditLimit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">{t("common.loading")}</TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{t(`contacts.${c.contact_type}`)}</TableCell>
                    <TableCell>₨ {c.credit_limit?.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Contacts;
