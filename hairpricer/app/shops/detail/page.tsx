import Link from "next/link";
import { PriceRows } from "@/components/PriceRows";
import { PriceStatusBadge } from "@/components/PriceStatusBadge";
import type { PriceStatus, SourceType, StylePrice } from "@/types/shop";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopDetailPage({ searchParams }: Props) {
  const params = await searchParams;
  const name = readParam(params, "name") || "매장명 확인 필요";
  const address = readParam(params, "address") || "주소 확인 필요";
  const phone = readParam(params, "phone") || "전화번호 확인 필요";
  const naverUrl = readParam(params, "naverUrl");
  const reviewSummary = readParam(params, "reviewSummary") || "후기 요약은 추가 수집 후 표시됩니다.";
  const price = buildPrice(params);

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Link href="/" className="text-sm font-bold text-stone-600 hover:text-ink">
          ← 검색 결과로 돌아가기
        </Link>

        <section className="mt-4 rounded-xl border border-line bg-white p-5 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-coral">네이버 지역 검색 결과</p>
              <h1 className="mt-1 text-3xl font-black text-ink">{name}</h1>
              <p className="mt-2 text-sm text-stone-500">{address}</p>
              <p className="mt-2 text-sm font-semibold text-stone-700">{phone}</p>
            </div>
            <PriceStatusBadge status={price.status} />
          </div>

          <div className="mt-5 h-44 rounded-xl border border-dashed border-line bg-stone-50 p-4">
            <p className="text-sm font-bold text-stone-700">지도 placeholder</p>
            <p className="mt-2 text-sm leading-6 text-stone-500">지도 API 연동 후 실제 매장 위치를 표시합니다.</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {naverUrl ? (
              <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">
                네이버 보기
              </a>
            ) : (
              <button type="button" disabled className="rounded-lg border border-line bg-stone-100 px-4 py-2 text-sm font-bold text-stone-400">
                링크 없음
              </button>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-black text-ink">가격 정보</h2>
          <div className="mt-3">
            <PriceRows prices={[price]} />
          </div>
          <p className="mt-4 rounded-lg bg-blush p-3 text-sm leading-6 text-rose-700">
            현재 네이버 지역 검색 API는 시술별 가격을 직접 제공하지 않을 수 있습니다. 공개 가격표, OCR, 수동 검수로 확인된 가격만 수집 완료로 표시합니다.
          </p>
        </section>

        <section className="mt-5 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-black text-ink">후기 요약</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">{reviewSummary}</p>
        </section>
      </div>
    </main>
  );
}

function buildPrice(params: Record<string, string | string[] | undefined>): StylePrice {
  return {
    menuName: readParam(params, "menuName") || readParam(params, "selectedMenu") || "선택 메뉴",
    minPrice: readNumberParam(params, "minPrice"),
    maxPrice: readNumberParam(params, "maxPrice"),
    priceText: readParam(params, "priceText") || "가격 정보 확인 필요",
    status: (readParam(params, "status") as PriceStatus | null) ?? "unavailable",
    sourceType: (readParam(params, "sourceType") as SourceType | null) ?? "naver_place",
    sourceUrl: readParam(params, "sourceUrl"),
    capturedText: readParam(params, "capturedText"),
    collectedAt: readParam(params, "collectedAt")
  };
}

function readParam(params: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readNumberParam(params: Record<string, string | string[] | undefined>, key: string): number | null {
  const value = readParam(params, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
