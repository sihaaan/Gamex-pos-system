export type BranchOptionalCatalogRecord = {
  branchId: string | null;
};

export function catalogBranchFilterMatches(
  record: BranchOptionalCatalogRecord,
  branchFilter: string,
): boolean {
  if (!branchFilter) {
    return true;
  }

  if (branchFilter === "GLOBAL") {
    return !record.branchId;
  }

  return record.branchId === branchFilter || record.branchId === null;
}
