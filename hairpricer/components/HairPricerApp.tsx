"use client";

import Link from "next/link";
import { useShopSearch } from "@/hooks/useShopSearch";
import { SearchControls } from "./SearchControls";
import { ShopCard } from "./ShopCard";

export function HairPricerApp() {
  const { filters, results, updateFilters, searchNaverShops, isLoading, errorMessage } = useShopSearch();

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-coral">HairPricer MVP</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-ink sm:text-5xl">
              실제 메뉴 기준으로 미용실 가격과 공개 정보를 비교하세요.
            </h1>
            <p className="mt-4 text-base leading-7 text-stone-600">
              커트, 펌, 염색, 클리닉, 스타일링 메뉴를 선택하고 확인된 가격만 비교합니다.
            </p>
          </div>
          <div className="mt-5">
            <Link href="/admin/price-upload" className="inline-flex rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-stone-700">
              가격표 업로드
            </Link>
          </div>
          <div className="mt-6">
            <SearchControls
              filters={filters}
              onChange={updateFilters}
              onSearchNaver={searchNaverShops}
              isLoading={isLoading}
            />
            {errorMessage && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-500">네이버 지역 검색 API 결과</p>
            <h2 className="text-2xl font-black text-ink">{results.length}개 미용실</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-stone-500">
            가격이 공개되지 않은 항목은 추정하지 않고 확인 필요로 표시합니다.
          </p>
        </div>

        {results.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((shop) => (
              <ShopCard key={shop.id} shop={shop} selectedMenu={filters.selectedMenu} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
            <p className="font-bold text-ink">조건에 맞는 미용실이 없습니다.</p>
            <p className="mt-2 text-sm text-stone-500">지역 또는 메뉴 조건을 조금 넓게 선택해 보세요.</p>
          </div>
        )}
      </section>
    </main>
  );
}
