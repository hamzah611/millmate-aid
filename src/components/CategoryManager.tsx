import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface ReferenceCheck {
  table: string;
  column: string;
  matchBy?: "id" | "name";
}

interface CategoryManagerProps {
  title: string;
  tableName: string;
  referenceCheck: ReferenceCheck;
  queryKey: string;
  hasUrdu?: boolean;
  hasLabel?: boolean;
}

export default function CategoryManager({
  title,
  tableName,
  referenceCheck,
  queryKey,
  hasUrdu = false,
  hasLabel = false,
}: CategoryManagerProps) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameUr, setEditNameUr] = useState("");

  const { data: items } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase.from(tableName as any).select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from(tableName as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setEditingId(null);
      toast.success(t("common.updated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: any) => {
      const matchValue = referenceCheck.matchBy === "name" ? item.name : item.id;
      const { count, error: countError } = await supabase
        .from(referenceCheck.table as any)
        .select("id", { count: "exact", head: true })
        .eq(referenceCheck.column, matchValue);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error("Cannot delete — category is in use.");
      }
      const { error } = await supabase.from(tableName as any).delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(t("common.deleted") || "Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(hasLabel ? item.label : item.name);
    setEditNameUr(item.name_ur || "");
  };

  const saveEdit = (item: any) => {
    const name = editName.trim();
    if (!name) return;
    const updates: Record<string, any> = {};
    if (hasLabel) {
      updates.label = name;
      updates.name = name.toLowerCase().replace(/\s+/g, "_");
    } else {
      updates.name = name;
    }
    if (hasUrdu) updates.name_ur = editNameUr.trim() || null;
    updateMutation.mutate({ id: item.id, updates });
  };

  const getDisplayName = (item: any) => {
    if (hasLabel) {
      return language === "ur" && item.label_ur ? item.label_ur : item.label;
    }
    return language === "ur" && item.name_ur ? item.name_ur : item.name;
  };

  const isSystem = (item: any) => item.is_system === true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {items?.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
              {editingId === item.id ? (
                <div className="flex-1 space-y-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  {hasUrdu && (
                    <Input
                      value={editNameUr}
                      onChange={(e) => setEditNameUr(e.target.value)}
                      className="h-8 text-sm"
                      dir="rtl"
                      placeholder="اردو"
                    />
                  )}
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => saveEdit(item)} disabled={updateMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm">{getDisplayName(item)}</span>
                  {!isSystem(item) && (
                    <div className="flex gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("common.confirmDelete") || "Are you sure?"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("common.deleteWarning") || "This action cannot be undone."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(item)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("common.delete") || "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {items?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No items found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
