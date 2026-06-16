import type { TaxRateOption } from "@/components/admin/shared";

export type ServiceRow = {
  id: string;
  branchId: string | null;
  taxRateId: string;
  name: string;
  sacCode: string;
  description: string;
  isActive: boolean;
  branch: { id: string; name: string; code: string } | null;
  taxRate: TaxRateOption;
  pricingRule: {
    ratePerMinute: number;
    minimumBillableMinutes: number;
    roundUpToMinutes: number;
    managerDiscountLimitPercent: number;
  };
};

export type ServiceDraft = {
  branchId: string;
  taxRateId: string;
  name: string;
  sacCode: string;
  description: string;
  ratePerHour: string;
  minimumBillableMinutes: string;
  roundUpToMinutes: string;
  managerDiscountLimitPercent: string;
  isActive: boolean;
  reason: string;
};

export const emptyServiceDraft: ServiceDraft = {
  branchId: "",
  taxRateId: "",
  name: "",
  sacCode: "9996",
  description: "",
  ratePerHour: "",
  minimumBillableMinutes: "10",
  roundUpToMinutes: "5",
  managerDiscountLimitPercent: "10",
  isActive: true,
  reason: "",
};
