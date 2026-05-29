import type { ShopSearchResult } from "@/types/shop";
import { formatPriceRange, priceStatusDescription } from "@/utils/format";
import { getPrimaryPriceStatus } from "@/services/searchShops";
import { PriceStatusBadge } from "./PriceStatusBadge";

type Props = {
  shop: ShopSearchResult;
  selectedMenu: string;
};

export function ShopCard({ shop, selectedMenu }: Props) {
  const price = shop.matchedPrice;
  const priceStatus = price?.status ?? getPrimaryPriceStatus(shop);
  const detailHref = buildDetailHref(shop, selectedMenu);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        <img src={shop.styleImages[0]} alt={`${shop.name} 대표 스타일`} className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3">
          <PriceStatusBadge status={getPrimaryPriceStatus(shop)} />
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">{shop.name}</h2>
            <div className="shrink-0 rounded-lg bg-mint px-2.5 py-1 text-right">
              <p className="text-[11px] font-semibold text-stone-600">선택 메뉴</p>
              <p className="max-w-28 truncate text-sm font-black text-teal">{selectedMenu}</p>
            </div>
          </div>
          <p className="mt-1 text-sm text-stone-500">{shop.address}</p>
          <p className="mt-2 text-sm font-semibold text-stone-700">
            ★ {shop.rating.toFixed(1)} · 리뷰 {shop.reviewCount.toLocaleString("ko-KR")}개 · {formatDistance(shop.distanceKm)}
          </p>
        </div>

        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs font-semibold text-stone-500">수집된 가격 정보</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{price?.menuName ?? selectedMenu}</p>
              <p className="text-xl font-black text-ink">
                수집 가격: {price ? formatPriceRange(price) : "가격 정보 확인 필요"}
              </p>
              <p className="mt-1 text-xs font-semibold text-stone-500">{priceStatusDescription(priceStatus)}</p>
            </div>
            <PriceStatusBadge status={priceStatus} />
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-stone-600">{shop.reviewSummary}</p>

        <div className="flex flex-wrap gap-2">
          <a href={detailHref} className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-stone-700">
            상세보기
          </a>
          {shop.naverUrl ? (
            <a href={shop.naverUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-stone-700">
              네이버 보기
            </a>
          ) : (
            <button type="button" disabled className="rounded-lg border border-line bg-stone-100 px-4 py-2 text-sm font-bold text-stone-400">
              링크 없음
            </button>
          )}
          {shop.snsUrl && (
            <a href={shop.snsUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-stone-700">
              SNS 보기
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function formatDistance(distanceKm: number): string {
  return distanceKm > 1000 ? "거리 확인 필요" : `${distanceKm}km`;
}

function buildDetailHref(shop: ShopSearchResult, selectedMenu: string): string {
  const price = shop.matchedPrice;
  const params = new URLSearchParams({
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    selectedMenu,
    reviewSummary: shop.reviewSummary
  });

  if (shop.naverUrl) params.set("naverUrl", shop.naverUrl);
  if (price) {
    params.set("menuName", price.menuName);
    params.set("priceText", price.priceText);
    params.set("status", price.status);
    params.set("sourceType", price.sourceType);
    if (price.sourceUrl) params.set("sourceUrl", price.sourceUrl);
    if (price.capturedText) params.set("capturedText", price.capturedText);
    if (price.collectedAt) params.set("collectedAt", price.collectedAt);
    if (price.minPrice !== null) params.set("minPrice", String(price.minPrice));
    if (price.maxPrice !== null) params.set("maxPrice", String(price.maxPrice));
  }

  return `/shops/detail?${params.toString()}`;
}
