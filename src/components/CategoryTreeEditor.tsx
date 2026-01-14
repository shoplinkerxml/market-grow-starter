import React, { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DialogNoOverlay, DialogNoOverlayContent, DialogNoOverlayDescription, DialogNoOverlayHeader, DialogNoOverlayTitle } from "@/components/ui/dialog-no-overlay";
// AlertDialog не используется: удаление выполняется сразу без модалки
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { CategoryService, type Category } from "@/lib/category-service";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, MoreVertical, Plus, Pencil, Trash2, Check, X, Loader2, RefreshCw, FolderTree } from "lucide-react";
import { runOptimisticOperation, useSyncStatus } from "@/lib/optimistic-mutation";
type Supplier = {
  id: string;
  supplier_name: string;
};
type Store = {
  id: string;
  store_name: string;
};
interface CategoryTreeEditorProps {
  suppliers: Supplier[];
  stores: Store[];
  categories: Category[];
  defaultSupplierId?: string;
  defaultStoreId?: string;
  onCategoryCreated?: (category: Category) => void;
  showStoreSelect?: boolean;
  onSupplierChange?: (supplierId: string) => void;
  supplierCategoriesMap?: Record<string, Category[]>;
}
export const CategoryTreeEditor: React.FC<CategoryTreeEditorProps> = ({
  suppliers,
  stores,
  categories,
  defaultSupplierId,
  defaultStoreId,
  onCategoryCreated,
  showStoreSelect = true,
  onSupplierChange,
  supplierCategoriesMap
}) => {
  const {
    t
  } = useI18n();
  const queryClient = useQueryClient();
  // Keep supplier id strictly as string to avoid mismatches with numeric IDs
  const [supplierId, setSupplierId] = useState<string>(defaultSupplierId ? String(defaultSupplierId) : "");
  const [storeId, setStoreId] = useState<string>(defaultStoreId || "");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const suppliersSorted = useMemo(() => {
    const current = String(supplierId || defaultSupplierId || "");
    if (!current) return suppliers;
    const idx = (suppliers || []).findIndex((s) => String(s.id) === current);
    if (idx <= 0) return suppliers;
    return [suppliers[idx], ...suppliers.slice(0, idx), ...suppliers.slice(idx + 1)];
  }, [suppliers, supplierId, defaultSupplierId]);

  // Keep internal supplierId in sync with parent-provided defaultSupplierId
  // This ensures the categories query runs when the user selects a supplier outside this component
  React.useEffect(() => {
    const autoDefault = suppliers && suppliers.length > 0 ? String(suppliers[0].id) : "";
    const next = defaultSupplierId ? String(defaultSupplierId) : autoDefault;
    // Only update when it actually changes to avoid unnecessary re-renders
    setSupplierId(prev => (prev !== next ? next : prev));
    // Propagate default selection to parent to keep formData in sync
    if (next && next !== supplierId) {
      onSupplierChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSupplierId, suppliers]);

  // Modal state for create/rename
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createParentExternalId, setCreateParentExternalId] = useState<string>("");
  const [createExternalId, setCreateExternalId] = useState<string>("");
  const [createName, setCreateName] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createExternalError, setCreateExternalError] = useState<string | null>(null);
  // Немодальний прогрес видалення
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [localNewCategories, setLocalNewCategories] = useState<Array<Category & { supplier_id?: string | number }>>([]);

  const catList: Category[] = React.useMemo(() => {
    const sid = supplierId;
    if (!sid) return [];
    const key = String(sid);
    const base = supplierCategoriesMap?.[key] || [];
    const extra = (categories as any[]).filter(c => String((c as any).supplier_id) === key);
    const locals = (localNewCategories as any[]).filter(c => String((c as any).supplier_id) === key);
    const map: Record<string, Category> = {};
    for (const it of base) {
      const ext = it?.external_id != null ? String(it.external_id) : "";
      if (!ext) continue;
      map[ext] = {
        ...it,
        external_id: ext,
        name: it?.name != null ? String(it.name) : "",
        parent_external_id: (it as any)?.parent_external_id ?? null
      };
    }
    for (const c of extra) {
      const ext = String((c as any).external_id || "");
      if (!ext) continue;
      map[ext] = {
        ...c,
        external_id: ext,
        name: String((c as any).name || ""),
        parent_external_id: (c as any).parent_external_id ?? null
      };
    }
    for (const c of locals) {
      const ext = String((c as any).external_id || "");
      if (!ext) continue;
      map[ext] = {
        ...c,
        external_id: ext,
        name: String((c as any).name || ""),
        parent_external_id: (c as any).parent_external_id ?? null
      };
    }
    return Object.values(map);
  }, [supplierId, supplierCategoriesMap, categories, localNewCategories]);
  const buildTree = useCallback((items: Category[]): {
    id: string;
    name: string;
    external_id: string;
    children: any[];
  }[] => {
    const byParent: Record<string | "root", Category[]> = {
      root: []
    };
    for (const it of items) {
      const ext = it?.external_id != null ? String(it.external_id) : "";
      if (!ext) continue;
      // Treat null, undefined, and empty string as root
      const parent = (it as any)?.parent_external_id ?? undefined;
      const key = parent && String(parent).trim() !== "" ? parent as string : "root";
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push({ ...it, external_id: ext });
    }
    const mapNode = (it: Category): any => {
      const ext = it?.external_id != null ? String(it.external_id) : "";
      return {
        id: ext,
        name: it?.name != null ? String(it.name) : "",
        external_id: ext,
        children: (byParent[ext] || []).map(mapNode)
      };
    };
    return (byParent.root || []).map(mapNode);
  }, []);
  const treeData = useMemo(() => buildTree(catList || []), [catList, buildTree]);
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);
  const resetCreateState = () => {
    setCreateParentExternalId("");
    setCreateExternalId("");
    setCreateName("");
    setCreateExternalError(null);
  };
  const handleCreate = async () => {
    if (!supplierId) {
      toast.error(t("select_supplier_error"));
      return;
    }
    if (!createExternalId.trim() || !createName.trim()) {
      toast.error(t("fill_required_fields"));
      return;
    }
    const externalId = createExternalId.trim();
    const name = createName.trim();
    const parentExternalId = createParentExternalId || null;
    const entityKey = supplierId ? `category:${supplierId}:${externalId}` : `category:none:${externalId}`;

    const optimisticCat: Category & { supplier_id?: string | number } = {
      external_id: externalId,
      name,
      parent_external_id: parentExternalId,
      supplier_id: supplierId || undefined
    };

    setCreating(true);
    setCreateExternalError(null);

    try {
      await runOptimisticOperation({
        entityKey,
        strategy: "rollback",
        applyOptimistic: () => {
          setLocalNewCategories(prev => {
            const exists = prev.some(
              c =>
                String(c.external_id) === String(optimisticCat.external_id) &&
                String((c as any).supplier_id || "") === String(optimisticCat.supplier_id || ""),
            );
            if (exists) return prev;
            return [...prev, optimisticCat];
          });
          resetCreateState();
          setIsCreateOpen(false);
        },
        rollback: () => {
          setLocalNewCategories(prev =>
            prev.filter(
              c =>
                !(
                  String(c.external_id) === String(optimisticCat.external_id) &&
                  String((c as any).supplier_id || "") === String(optimisticCat.supplier_id || "")
                ),
            ),
          );
        },
        run: () =>
          CategoryService.createCategory({
            supplier_id: supplierId,
            external_id: externalId,
            name,
            parent_external_id: parentExternalId || undefined,
          }),
        applyServer: newCat => {
          onCategoryCreated?.(newCat);
          queryClient.invalidateQueries({
            queryKey: ["categories", supplierId || "none"],
          });
          toast.success(t("category_created"));
        },
        onError: (error: any) => {
          console.error("Create category error:", error);
          if (error?.code === "23505" && String(error?.message || "").includes("uq_store_categories_supplier_external")) {
            const msg = t("external_id_exists");
            setCreateExternalError(msg);
            toast.error(msg);
          } else {
            toast.error(t("failed_create_category"));
          }
        },
      });
    } finally {
      setCreating(false);
    }
  };
  const handleRename = async (externalId: string, newName: string) => {
    if (!supplierId || !newName.trim()) return;
    const name = newName.trim();
    const entityKey = supplierId ? `category:${supplierId}:${externalId}` : `category:none:${externalId}`;

    await runOptimisticOperation({
      entityKey,
      strategy: "soft-fail",
      applyOptimistic: () => {
        setLocalNewCategories(prev =>
          prev.map(c =>
            String(c.external_id) === String(externalId) &&
            String((c as any).supplier_id || "") === String(supplierId || "")
              ? { ...c, name }
              : c,
          ),
        );
      },
      run: () => CategoryService.updateName(supplierId, externalId, name),
      applyServer: () => {
        queryClient.invalidateQueries({
          queryKey: ["categories", supplierId || "none"],
        });
        toast.success(t("btn_update"));
      },
      onError: (err: any) => {
        console.error("Update category name error:", err);
        toast.error(t("failed_create_category"));
      },
    });
  };
  const handleDelete = async (externalId: string) => {
    if (!supplierId) return;
    try {
      setDeletingId(externalId);
      setIsDeleteOpen(true);
      await CategoryService.deleteCategoryCascade(supplierId, externalId);
      await queryClient.invalidateQueries({
        queryKey: ["categories", supplierId || "none"]
      });
      toast.success(t("category_deleted"));
    } catch (err) {
      console.error(err);
      toast.error(t("failed_delete_category"));
    } finally {
      setIsDeleteOpen(false);
      setDeletingId(null);
    }
  };

  // Local component: tree node
  const TreeNode: React.FC<{
    node: {
      id: string;
      name: string;
      external_id: string;
      children: any[];
    };
    entityKeyPrefix: string;
  }> = React.memo(({
    node,
    entityKeyPrefix
  }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isOpen = expanded[node.id] ?? false;
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(node.name);
    const statusEntry = useSyncStatus(`${entityKeyPrefix}:${node.external_id}`);
    const syncStatus = statusEntry?.status || "synced";
    const onRenameSubmit = async () => {
      try {
        await handleRename(node.external_id, renameValue);
      } finally {
        setIsRenaming(false);
      }
    };
    return <div className="pl-[clamp(0rem,2vw,1rem)]" data-testid={`categoryTree_node_${node.external_id}`}>
        <div className="flex items-center gap-[0.5rem] rounded-md px-[0.5rem] py-[0.25rem] cursor-pointer" onClick={() => setSelected(node.external_id)}>
          {hasChildren ? <Button variant="ghost" size="icon" className="h-[1.5rem] w-[1.5rem]" onClick={e => {
          e.stopPropagation();
          toggleExpand(node.id);
        }} data-testid={`categoryTree_toggle_${node.external_id}`}>
              {isOpen ? <ChevronDown className="h-[1rem] w-[1rem]" /> : <ChevronRight className="h-[1rem] w-[1rem]" />}
            </Button> : <span className="w-[1.5rem]" />}

          {isRenaming ? <div className="flex items-center gap-[0.5rem]">
              <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="h-[2rem]" data-testid={`categoryTree_renameInput_${node.external_id}`} />
              <Button size="sm" onClick={e => {
            e.stopPropagation();
            onRenameSubmit();
          }} data-testid={`categoryTree_renameSave_${node.external_id}`}>{t("btn_update")}</Button>
              <Button variant="ghost" size="sm" onClick={e => {
            e.stopPropagation();
            setIsRenaming(false);
          }} data-testid={`categoryTree_renameCancel_${node.external_id}`}>{t("btn_cancel")}</Button>
            </div> : <span
              title={renameValue}
              className={`${selected === node.external_id ? "font-semibold text-success" : "font-extralight"} ${
                syncStatus === "pending" ? "text-muted-foreground" : ""
              } ${syncStatus === "error" ? "text-destructive" : ""} flex-1 truncate text-xs hover:font-semibold hover:text-success`}
            >
              {renameValue}
            </span>}
          {syncStatus === "pending" && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          {syncStatus === "error" && (
            <>
              <X className="h-3 w-3 text-destructive" aria-hidden="true" />
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Retry"
                onClick={e => {
                  e.stopPropagation();
                  handleRename(node.external_id, renameValue);
                }}
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              </Button>
            </>
          )}

          <DropdownMenu onOpenChange={open => {
          if (open) setSelected(node.external_id);
        }}>
            <DropdownMenuTrigger asChild>
              <div className="inline-flex items-center justify-center gap-[0.25rem] whitespace-nowrap rounded-md text-sm font-medium transition-colors border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 hover:bg-green-50 hover:text-green-700 h-[1.75rem] w-[1.75rem]" role="button" aria-haspopup="menu" onPointerDown={e => {
              e.stopPropagation();
              setSelected(node.external_id);
            }} onClick={e => {
              e.stopPropagation();
              setSelected(node.external_id);
            }} data-testid={`categoryTree_actions_${node.external_id}`} title={t("menu")}>
                <MoreVertical className="h-[1rem] w-[1rem]" aria-hidden="true" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              setIsCreateOpen(true);
              setCreateParentExternalId(node.external_id);
            }} data-testid={`categoryTree_addSub_${node.external_id}`}>
                <Plus className="h-[1rem] w-[1rem] mr-[0.25rem]" />
                {t("add_subcategory")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              setIsRenaming(true);
            }} data-testid={`categoryTree_rename_${node.external_id}`}>
                <Pencil className="h-[1rem] w-[1rem] mr-[0.25rem]" />
                {t("rename_category")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDelete(node.external_id)} data-testid={`categoryTree_delete_${node.external_id}`}>
                <Trash2 className="h-[1rem] w-[1rem] mr-[0.25rem]" />
                {t("delete_category")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChildren && isOpen && <div className="mt-[0.25rem] space-y-[0.25rem]">
            {node.children.map((child: any) => <TreeNode key={child.id} node={child} entityKeyPrefix={entityKeyPrefix} />)}
          </div>}
      </div>;
  });
  return <Card className="border-0 shadow-none" data-testid="categoryTree_card">
      {/* Немодальне невелике вікно прогресу без затемнення */}
      <DialogNoOverlay modal={false} open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogNoOverlayContent position="top-right" className="p-[0.75rem] w-[min(22rem,90vw)]" data-testid="categoryTree_deleteProgress">
          <DialogNoOverlayHeader>
            <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              {t("deleting_category_title")}
            </DialogNoOverlayTitle>
            <DialogNoOverlayDescription className="sr-only">
              {t("deleting_category_title")}
            </DialogNoOverlayDescription>
          </DialogNoOverlayHeader>
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{t("deleting_category")}{deletingId ? `: ${deletingId}` : ""}</span>
          </div>
        </DialogNoOverlayContent>
      </DialogNoOverlay>
      <CardHeader className="flex flex-row items-center justify-between p-0 mb-2.5">
        <CardTitle className="text-sm" data-testid="categoryTree_title">{t("categories_title")}</CardTitle>
        <Dialog open={isCreateOpen} onOpenChange={open => {
        setIsCreateOpen(open);
        if (!open) resetCreateState();
      }}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCreateOpen(true)}
              data-testid="categoryTree_newButton"
              aria-label={t("new_category")}
              className="border border-transparent hover:border-success hover:text-success hover:bg-transparent"
            >
              <Plus className="h-[1rem] w-[1rem]" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                {t("create_category_modal_title")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("create_category_modal_title")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-[0.75rem]">
              <div className="space-y-[0.25rem]">
                <Label htmlFor="cte_supplier_modal">{t("supplier")}</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="cte_supplier_modal" data-testid="categoryTree_supplierSelect">
                    <SelectValue placeholder={t("select_supplier")} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>
                        {s.supplier_name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-[0.25rem]">
                <Label htmlFor="cte_parent_modal">{t("parent_category")}</Label>
                <Select value={createParentExternalId} onValueChange={setCreateParentExternalId}>
                  <SelectTrigger id="cte_parent_modal" data-testid="categoryTree_parentSelect">
                    <SelectValue placeholder={t("select_parent_category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(catList || [])
                      .filter(cat => cat?.external_id != null && String(cat.external_id).trim() !== "")
                      .map(cat => {
                        const ext = String(cat.external_id);
                        const label = cat?.name != null ? String(cat.name) : ext;
                        return (
                          <SelectItem key={ext} value={ext}>
                            {label}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-[0.25rem]">
                <Label htmlFor="cte_external_modal">{t("external_id")}</Label>
                <Input id="cte_external_modal" value={createExternalId} onChange={e => {
                setCreateExternalId(e.target.value);
                if (createExternalError) setCreateExternalError(null);
              }} placeholder={t("external_id_placeholder")} aria-invalid={Boolean(createExternalError)} className={`h-[2rem] ${createExternalError ? "border-destructive focus-visible:ring-destructive" : ""}`} data-testid="categoryTree_externalIdInput" />
                {createExternalError && <p className="text-sm text-destructive" data-testid="categoryTree_externalIdError" aria-live="polite">
                    {createExternalError}
                  </p>}
              </div>
              <div className="space-y-[0.25rem]">
                <Label htmlFor="cte_name_modal">{t("category_name")}</Label>
                <Input id="cte_name_modal" value={createName} onChange={e => setCreateName(e.target.value)} placeholder={t("category_name_placeholder")} data-testid="categoryTree_nameInput" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>{t("btn_cancel")}</Button>
              <Button onClick={handleCreate} disabled={creating || !supplierId || !createExternalId.trim() || !createName.trim()} data-testid="categoryTree_createButton">
                {creating ? t("loading_creating") : t("create_category")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-[0.5rem] p-0">
        {/* Supplier tabs for switching category trees by supplier */}
        <Tabs value={supplierId || "none"} onValueChange={val => {
        setSupplierId(val);
        onSupplierChange?.(val);
      }} className="w-full">
          <TabsList className="items-center flex w-full gap-2 h-9 overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-nowrap scroll-smooth snap-x snap-mandatory md:snap-none no-scrollbar md:px-0 bg-transparent p-0 text-foreground rounded-none border-b border-border md:border-0 justify-start" data-testid="categoryTree_supplierTabsList">
            {suppliersSorted.map(s => <TabsTrigger key={s.id} value={String(s.id)} className="whitespace-nowrap py-1 font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow shrink-0 md:shrink snap-start md:snap-none w-auto truncate text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start md:justify-start rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary transition-colors" data-testid={`categoryTree_supplierTab_${s.id}`} aria-label={s.supplier_name}>
                <span className="truncate">{s.supplier_name}</span>
              </TabsTrigger>)}
          </TabsList>
        </Tabs>

        {treeData.length === 0 ? <div className="rounded-md border p-[1rem] text-muted-foreground" data-testid="categoryTree_empty">
            <div className="font-medium">{t("no_categories_title")}</div>
            <div className="text-sm">{t("no_categories_description")}</div>
          </div> : <ScrollArea className="max-h-[50vh]">
            <div className="space-y-[0.25rem]" data-testid="categoryTree_root">
              {treeData.map(n => (
                <TreeNode
                  key={n.id}
                  node={n}
                  entityKeyPrefix={supplierId ? `category:${supplierId}` : "category:none"}
                />
              ))}
            </div>
          </ScrollArea>}
      </CardContent>
    </Card>;
};
export default CategoryTreeEditor;
