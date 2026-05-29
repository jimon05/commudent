import type { StylePrice } from "@/types/shop";
import { formatDate, formatPriceRange, sourceTypeLabel } from "@/utils/format";
import { PriceStatusBadge } from "./PriceStatusBadge";

type Props = {
  prices: StylePrice[];
  compact?: boolean;
};

export function PriceRows({ prices, compact = false }: Props) {
  return (
    <div className="space-y-2">
      {prices.map((price) => (
        <div key={`${price.menuName}-${price.sourceType}`} className="rounded-lg border border-line bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{price.menuName}</p>
              <p className="mt-1 text-lg font-bold text-teal">{formatPriceRange(price)}</p>
            </div>
            <PriceStatusBadge status={price.status} />
          </div>
          {!compact && (
            <div className="mt-3 space-y-1 text-xs text-stone-500">
              <p>출처: {sourceTypeLabel(price.sourceType)}</p>
              <p>수집: {formatDate(price.collectedAt)}</p>
              <p className="leading-relaxed">수집 문장: {price.capturedText ?? "수집 문장 없음"}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
