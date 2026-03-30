import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UnitForm {
  name: string;
  name_ur: string;
  kg_value: string;
  sub_unit_id: string;
}

const emptyForm: UnitForm = { name: "", name_ur: "", kg_value: "1", sub_unit_id: "" };

export default function Units() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<UnitForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UnitForm>(emptyForm);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (form: UnitForm) => {
      const { error } = await supabase.from("units").insert({
        name: form.name.trim(),
        name_ur: form.name_ur.trim() || null,
        kg_value: parseFloat(form.kg_value) || 1,
        sub_unit_id: form.sub_unit_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setShowAdd(false);
      setAddForm(emptyForm);
      toast({ title: t("common.saved") });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: UnitForm }) => {
      const { error } = await supabase.from("units").update({
        name: form.name.trim(),
        name_ur: form.name_ur.trim() || null,
        kg_value: parseFloat(form.kg_value) || 1,
        sub_unit_id: form.sub_unit_id || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setEditId(null);
      toast({ title: t("common.updated") });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if unit is used by products
      const { data: usedProducts } = await supabase
        .from("products")
        .select("id")
        .eq("unit_id", id)
        .limit(1);
      if (usedProducts?.length) {
        throw new Error(t("common.deleteInUse"));
      }
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast({ title: t("common.deleted") });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (unit: typeof units[0]) => {
    setEditId(unit.id);
    setEditForm({ name: unit.name, name_ur: unit.name_ur || "", kg_value: String(unit.kg_value), sub_unit_id: (unit as any).sub_unit_id || "" });
  };

  const getSubUnitName = (subUnitId: string | null) => {
    if (!subUnitId) return "—";
    const u = units.find((unit) => unit.id === subUnitId);
    return u ? u.name : "—";
  };

  // Filter out current unit from sub-unit options (prevent self-reference)
  const subUnitOptions = (excludeId?: string) => units.filter((u) => u.id !== excludeId);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("units.title")}</h1>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("units.add")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("units.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("units.kgValueHint")}</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("units.name")}</TableHead>
                <TableHead>{t("units.nameUr")}</TableHead>
                <TableHead>{t("units.kgValue")}</TableHead>
                <TableHead>{t("units.subUnit")}</TableHead>
                <TableHead className="w-[120px]">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showAdd && (
                <TableRow>
                  <TableCell>
                    <Input
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g. Maund"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={addForm.name_ur}
                      onChange={(e) => setAddForm({ ...addForm, name_ur: e.target.value })}
                      placeholder="e.g. من"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      value={addForm.kg_value}
                      onChange={(e) => setAddForm({ ...addForm, kg_value: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={addForm.sub_unit_id} onValueChange={(v) => setAddForm({ ...addForm, sub_unit_id: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t("units.noSubUnit")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("units.noSubUnit")}</SelectItem>
                        {subUnitOptions().map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => addForm.name.trim() && addMutation.mutate(addForm)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setShowAdd(false); setAddForm(emptyForm); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">{t("common.loading")}</TableCell>
                </TableRow>
              ) : units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">{t("common.noData")}</TableCell>
                </TableRow>
              ) : (
                units.map((unit) =>
                  editId === unit.id ? (
                    <TableRow key={unit.id}>
                      <TableCell>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editForm.name_ur}
                          onChange={(e) => setEditForm({ ...editForm, name_ur: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          value={editForm.kg_value}
                          onChange={(e) => setEditForm({ ...editForm, kg_value: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={editForm.sub_unit_id} onValueChange={(v) => setEditForm({ ...editForm, sub_unit_id: v === "__none__" ? "" : v })}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder={t("units.noSubUnit")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t("units.noSubUnit")}</SelectItem>
                            {subUnitOptions(unit.id).map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => editForm.name.trim() && updateMutation.mutate({ id: unit.id, form: editForm })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>{unit.name_ur || "—"}</TableCell>
                      <TableCell>{unit.kg_value} KG</TableCell>
                      <TableCell>{getSubUnitName((unit as any).sub_unit_id)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(unit)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
                                <AlertDialogDescription>{t("common.confirmDeleteDesc")}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(unit.id)}>
                                  {t("common.delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
