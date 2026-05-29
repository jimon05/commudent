import type { PriceStatus } from "@/types/shop";
import { priceStatusLabel } from "@/utils/format";

type Props = {
  status: PriceStatus;
};

export function PriceStatusBadge({ status }: Props) {
  const className =
    status === "collected"
      ? "border-teal-200 bg-teal-50 text-teal-700"
      : status === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-stone-200 bg-stone-100 text-stone-600";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {priceStatusLabel(status)}
    </span>
  );
}
