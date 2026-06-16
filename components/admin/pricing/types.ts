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
    pricingMode: string;
    ratePerMinute: number;
    halfHourPrice: number | null;
    hourPrice: number | null;
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
  halfHourPrice: string;
  hourPrice: string;
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
  halfHourPrice: "80",
  hourPrice: "140",
  minimumBillableMinutes: "30",
  roundUpToMinutes: "30",
  managerDiscountLimitPercent: "10",
  isActive: true,
  reason: "",
};
