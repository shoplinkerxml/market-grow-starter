export type LinkLike = {
  store_id?: string | null
  is_active?: boolean | null
  custom_category_id?: string | null
  store_products?: {
    category_id?: number | null
    category_external_id?: string | null
    supplier_id?: number | null
  } | null
}

export type CategoryLike = {
  id: number
  external_id?: string | null
  supplier_id?: number | null
  store_id?: string | null
}

export type CategoryNameLike = {
  id: number
  name?: string | null
  store_id?: string | null
}

export type StoreCategoryLike = {
  id: number
  store_id: string
  category_id: number
}

export type CategoryExternalRef = {
  storeId: string
  externalId: string
  supplierId: number | null
}

export function normalizeExternalId(value: string | null | undefined): string | null {
  const v = String(value || "").trim()
  return v ? v.toLowerCase() : null
}

export function normalizeCategoryName(value: string | null | undefined): string | null {
  const v = String(value || "").trim()
  return v ? v.toLowerCase() : null
}

export function extractCategoryRefsFromLinks(links: LinkLike[]) {
  const desiredByStore = new Map<string, Set<number>>()
  const externalRefs: CategoryExternalRef[] = []
  const externalIdList: string[] = []

  for (const link of links || []) {
    const storeId = String((link as any)?.store_id || "").trim()
    if (!storeId) continue

    const base = (link as any)?.store_products || {}
    const customRaw = String((link as any)?.custom_category_id || "").trim()
    if (customRaw) {
      const normalized = normalizeExternalId(customRaw)
      if (normalized) {
        externalRefs.push({
          storeId,
          externalId: normalized,
          supplierId: base?.supplier_id ?? null,
        })
        externalIdList.push(customRaw)
      }
      continue
    }

    const catId = Number((base as any)?.category_id)
    if (Number.isFinite(catId)) {
      if (!desiredByStore.has(storeId)) desiredByStore.set(storeId, new Set<number>())
      desiredByStore.get(storeId)!.add(catId)
      continue
    }

    const extRaw = String((base as any)?.category_external_id || "").trim()
    if (!extRaw) continue
    const normalized = normalizeExternalId(extRaw)
    if (!normalized) continue
    externalRefs.push({
      storeId,
      externalId: normalized,
      supplierId: base?.supplier_id ?? null,
    })
    externalIdList.push(extRaw)
  }

  return {
    desiredByStore,
    externalRefs,
    externalIdList: Array.from(new Set(externalIdList)),
  }
}

export function applyExternalRefsToDesiredMap(
  desiredByStore: Map<string, Set<number>>,
  externalRefs: CategoryExternalRef[],
  categories: CategoryLike[],
) {
  const byStoreExt = new Map<string, number>()
  const bySupplierExt = new Map<string, number>()

  for (const row of categories || []) {
    const ext = normalizeExternalId((row as any)?.external_id)
    if (!ext) continue
    const id = Number((row as any)?.id)
    if (!Number.isFinite(id)) continue
    const storeId = (row as any)?.store_id != null ? String((row as any).store_id) : ""
    const supplierId = Number((row as any)?.supplier_id)
    if (storeId) byStoreExt.set(`${storeId}|${ext}`, id)
    if (Number.isFinite(supplierId)) bySupplierExt.set(`${supplierId}|${ext}`, id)
  }

  for (const ref of externalRefs || []) {
    const storeId = String((ref as any)?.storeId || "").trim()
    if (!storeId) continue
    const ext = normalizeExternalId((ref as any)?.externalId)
    if (!ext) continue
    let id = byStoreExt.get(`${storeId}|${ext}`)
    if (!Number.isFinite(id)) {
      const supplierId = Number((ref as any)?.supplierId)
      if (Number.isFinite(supplierId)) {
        id = bySupplierExt.get(`${supplierId}|${ext}`)
      }
    }
    if (!Number.isFinite(id)) continue
    if (!desiredByStore.has(storeId)) desiredByStore.set(storeId, new Set<number>())
    desiredByStore.get(storeId)!.add(Number(id))
  }

  return desiredByStore
}

export function dedupeDesiredCategoriesByName(
  desiredByStore: Map<string, Set<number>>,
  categories: CategoryNameLike[],
  existingRows: StoreCategoryLike[] = [],
) {
  const categoryMetaById = new Map<number, { nameNorm: string | null; storeId: string }>()
  for (const row of categories || []) {
    const id = Number((row as any)?.id)
    if (!Number.isFinite(id)) continue
    const nameNorm = normalizeCategoryName((row as any)?.name)
    const storeId = (row as any)?.store_id != null ? String((row as any).store_id) : ""
    categoryMetaById.set(id, { nameNorm, storeId })
  }

  const existingByStore = new Map<string, Set<number>>()
  for (const row of existingRows || []) {
    const storeId = String((row as any)?.store_id || "").trim()
    const categoryId = Number((row as any)?.category_id)
    if (!storeId || !Number.isFinite(categoryId)) continue
    if (!existingByStore.has(storeId)) existingByStore.set(storeId, new Set<number>())
    existingByStore.get(storeId)!.add(categoryId)
  }

  const deduped = new Map<string, Set<number>>()
  for (const [storeId, desired] of desiredByStore) {
    const picked = new Set<number>()
    const groups = new Map<string, number[]>()
    for (const catId of desired) {
      const meta = categoryMetaById.get(catId)
      const nameNorm = meta?.nameNorm
      if (!nameNorm) {
        picked.add(catId)
        continue
      }
      if (!groups.has(nameNorm)) groups.set(nameNorm, [])
      groups.get(nameNorm)!.push(catId)
    }

    for (const [nameNorm, ids] of groups) {
      let chosen = ids[0]
      let bestScore = -1
      for (const id of ids) {
        const meta = categoryMetaById.get(id)
        let score = 0
        if (existingByStore.get(storeId)?.has(id)) score += 2
        if (meta?.storeId && meta.storeId === storeId) score += 1
        if (score > bestScore || (score === bestScore && id < chosen)) {
          bestScore = score
          chosen = id
        }
      }
      if (Number.isFinite(chosen)) picked.add(chosen)
    }

    deduped.set(storeId, picked)
  }

  return deduped
}

export function diffStoreCategoryRows(
  desiredByStore: Map<string, Set<number>>,
  existingRows: StoreCategoryLike[],
) {
  const existingByStore = new Map<string, Map<number, number>>()
  for (const row of existingRows || []) {
    const storeId = String((row as any)?.store_id || "").trim()
    const categoryId = Number((row as any)?.category_id)
    const id = Number((row as any)?.id)
    if (!storeId || !Number.isFinite(categoryId) || !Number.isFinite(id)) continue
    if (!existingByStore.has(storeId)) existingByStore.set(storeId, new Map<number, number>())
    existingByStore.get(storeId)!.set(categoryId, id)
  }

  const toInsert: Array<{ store_id: string; category_id: number }> = []
  const toDeleteIds: number[] = []

  for (const [storeId, desired] of desiredByStore) {
    const existingForStore = existingByStore.get(storeId) || new Map<number, number>()
    for (const catId of desired) {
      if (!existingForStore.has(catId)) {
        toInsert.push({ store_id: storeId, category_id: catId })
      }
    }
  }

  for (const [storeId, existingForStore] of existingByStore) {
    const desired = desiredByStore.get(storeId) || new Set<number>()
    for (const [catId, rowId] of existingForStore) {
      if (!desired.has(catId)) {
        toDeleteIds.push(rowId)
      }
    }
  }

  return { toInsert, toDeleteIds }
}
