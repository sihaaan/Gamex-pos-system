export type AdminPricingRole = "OWNER" | "MANAGER" | "STAFF";

export type PricingDisplayService = {
  branchId: string | null;
  isActive: boolean;
  name: string;
  description: string;
  pricingRule: {
    ratePerMinute: number;
  };
};

export function pricingServiceFamilyKey(service: PricingDisplayService): string {
  const searchable = `${service.name} ${service.description}`.toLowerCase();
  if (searchable.includes("pool")) {
    return "pool";
  }
  if (searchable.includes("ps5") || searchable.includes("console")) {
    return "console";
  }
  return service.name.trim().toLowerCase();
}

export function pricingScopeLabel(
  service: PricingDisplayService,
  effectiveBranchId: string | null,
): "Global default" | "Inherited from global default" | "Branch override" {
  if (service.branchId) {
    return "Branch override";
  }
  return effectiveBranchId ? "Inherited from global default" : "Global default";
}

export function pricingEditActionLabel({
  service,
  role,
  effectiveBranchId,
}: {
  service: PricingDisplayService;
  role: AdminPricingRole;
  effectiveBranchId: string | null;
}): "Create branch override" | "Edit global default" | "Edit branch override" {
  if (service.branchId) {
    return "Edit branch override";
  }
  if (role === "MANAGER" && effectiveBranchId) {
    return "Create branch override";
  }
  return "Edit global default";
}

export function activeGlobalDefaultForService<TService extends PricingDisplayService>(
  target: PricingDisplayService,
  services: readonly TService[],
): TService | null {
  const familyKey = pricingServiceFamilyKey(target);
  return (
    services.find(
      (service) =>
        service.isActive &&
        service.branchId === null &&
        pricingServiceFamilyKey(service) === familyKey,
    ) ?? null
  );
}

export function activeBranchOverrideForService<TService extends PricingDisplayService>(
  target: PricingDisplayService,
  services: readonly TService[],
  branchId: string | null,
): TService | null {
  if (!branchId) {
    return null;
  }
  const familyKey = pricingServiceFamilyKey(target);
  return (
    services.find(
      (service) =>
        service.isActive &&
        service.branchId === branchId &&
        pricingServiceFamilyKey(service) === familyKey,
    ) ?? null
  );
}

export function effectiveServiceForBranch<TService extends PricingDisplayService>(
  target: PricingDisplayService,
  services: readonly TService[],
  branchId: string | null,
): TService | null {
  return (
    activeBranchOverrideForService(target, services, branchId) ??
    activeGlobalDefaultForService(target, services) ??
    null
  );
}
