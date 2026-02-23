export type CategoryDedupInput = {
  supplier_id: number | string
  external_id: string
  name: string
  parent_external_id?: string | null
}

export type NormalizedCategoryInput = {
  supplier_id: number
  external_id: string
  name: string
  parent_external_id: string | null
  name_norm: string
}

export function normalizeCategoryName(name: string | null | undefined): string | null {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

export function sanitizeCategoryInputs(items: CategoryDedupInput[]) {
  const cleaned: NormalizedCategoryInput[] = []
  let skipped = 0
  for (const it of items || []) {
    const supplierId = Number((it as any)?.supplier_id)
    const externalId = String((it as any)?.external_id ?? "").trim()
    const name = String((it as any)?.name ?? "").trim()
    const nameNorm = normalizeCategoryName(name)
    if (!Number.isFinite(supplierId) || !externalId || !nameNorm) {
      skipped += 1
      continue
    }
    cleaned.push({
      supplier_id: supplierId,
      external_id: externalId,
      name,
      parent_external_id: String((it as any)?.parent_external_id ?? "").trim() || null,
      name_norm: nameNorm,
    })
  }
  return { cleaned, skipped }
}

export function simulateDedup(existingNames: string[], items: CategoryDedupInput[]) {
  const { cleaned, skipped } = sanitizeCategoryInputs(items)
  const existing = new Set((existingNames || []).map((n) => normalizeCategoryName(n)).filter(Boolean) as string[])
  const seen = new Set<string>()
  let inserted = 0
  let duplicates = 0
  for (const item of cleaned) {
    if (existing.has(item.name_norm) || seen.has(item.name_norm)) {
      duplicates += 1
      continue
    }
    inserted += 1
    seen.add(item.name_norm)
  }
  return {
    total_input: (items || []).length,
    valid_input: cleaned.length,
    skipped,
    inserted,
    duplicates,
  }
}
