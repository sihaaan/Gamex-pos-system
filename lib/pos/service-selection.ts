export type TimedResourceForServiceSelection = {
  branchId: string;
  kind: "POOL_TABLE" | "CONSOLE";
};

export type TimedServiceForSelection = {
  branchId?: string | null;
  name: string;
  description: string;
};

export function findServiceForResource<TService extends TimedServiceForSelection>(
  resource: TimedResourceForServiceSelection,
  services: readonly TService[],
): TService | null {
  const candidates =
    resource.kind === "POOL_TABLE" ? ["pool"] : ["ps5", "console"];

  const matchingServices = services.filter((service) => {
    if (service.branchId && service.branchId !== resource.branchId) {
      return false;
    }

    const searchable = `${service.name} ${service.description}`.toLowerCase();
    return candidates.some((candidate) => searchable.includes(candidate));
  });

  return (
    matchingServices.find((service) => service.branchId === resource.branchId) ??
    matchingServices[0] ??
    null
  );
}
