"use client";

import { getMenusByCategory, menuCatalog } from "@/data/menuCatalog";
import type { PriceStatus, SearchFilters, ServiceCategory } from "@/types/shop";

type Props = {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onSearchNaver: () => void;
  isLoading: boolean;
};

const statusOptions: Array<{ label: string; value: PriceStatus }> = [
  { label: "수집 완료", value: "collected" },
  { label: "일부 수집", value: "partial" },
  { label: "확인 필요", value: "unavailable" }
];

export function SearchControls({ filters, onChange, onSearchNaver, isLoading }: Props) {
  const detailMenus = getMenusByCategory(filters.selectedCategory);

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="grid gap-3 md:grid-cols-[0.9fr_1fr_1fr_auto_auto]">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">지역</span>
          <input
            value={filters.locationQuery}
            onChange={(event) => onChange({ locationQuery: event.target.value })}
            placeholder="신촌, 홍대, 강남, 성수"
            className="mt-2 h-14 w-full rounded-lg border border-line bg-stone-50 px-4 text-base font-semibold outline-none transition focus:border-coral focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">메뉴 대분류</span>
          <select
            value={filters.selectedCategory}
            onChange={(event) => {
              const selectedCategory = event.target.value as ServiceCategory;
              onChange({
                selectedCategory,
                selectedMenu: getMenusByCategory(selectedCategory)[0] ?? ""
              });
            }}
            className="mt-2 h-14 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-coral"
          >
            {menuCatalog.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">메뉴 세부 선택</span>
          <select
            value={filters.selectedMenu}
            onChange={(event) => onChange({ selectedMenu: event.target.value })}
            className="mt-2 h-14 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-coral"
          >
            {detailMenus.map((menu) => (
              <option key={menu} value={menu}>
                {menu}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">정렬</span>
          <select
            value={filters.sortBy}
            onChange={(event) => onChange({ sortBy: event.target.value as SearchFilters["sortBy"] })}
            className="mt-2 h-14 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-coral md:w-36"
          >
            <option value="distance">거리순</option>
            <option value="rating">평점순</option>
            <option value="price">가격순</option>
            <option value="reviews">리뷰 수 순</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={onSearchNaver}
            disabled={isLoading}
            className="h-14 rounded-lg bg-ink px-5 text-sm font-bold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "검색 중" : "검색"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr]">
        <FilterGroup
          label="가격 상태"
          options={statusOptions}
          selected={filters.priceStatuses}
          onChange={(values) => onChange({ priceStatuses: values as PriceStatus[] })}
        />
      </div>
    </section>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: Array<{ label: string; value: T }>;
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-stone-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((value) => value !== option.value)
                    : [...selected, option.value]
                )
              }
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-coral bg-blush text-rose-700"
                  : "border-line bg-white text-stone-600 hover:border-stone-300"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
