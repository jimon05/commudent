"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultFilters, searchShops } from "@/services/searchShops";
import type { SavedStylePrice, SearchFilters, Shop } from "@/types/shop";
import { applySavedPricesToShops, readSavedStylePrices } from "@/utils/savedPrices";

export function useShopSearch() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [apiShops, setApiShops] = useState<Shop[]>([]);
  const [savedPrices, setSavedPrices] = useState<SavedStylePrice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pricedShops = useMemo(() => applySavedPricesToShops(apiShops, savedPrices), [apiShops, savedPrices]);
  const results = useMemo(() => searchShops(pricedShops, filters), [pricedShops, filters]);

  useEffect(() => {
    setSavedPrices(readSavedStylePrices());
    void searchNaverShops(defaultFilters);
  }, []);

  useEffect(() => {
    function syncSavedPrices() {
      setSavedPrices(readSavedStylePrices());
    }

    window.addEventListener("storage", syncSavedPrices);
    window.addEventListener("hairpricer:saved-prices-updated", syncSavedPrices);

    return () => {
      window.removeEventListener("storage", syncSavedPrices);
      window.removeEventListener("hairpricer:saved-prices-updated", syncSavedPrices);
    };
  }, []);

  function updateFilters(patch: Partial<SearchFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  async function searchNaverShops(nextFilters: SearchFilters = filters) {
    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams({
      location: nextFilters.locationQuery,
      category: nextFilters.selectedCategory,
      menu: nextFilters.selectedMenu
    });

    try {
      const response = await fetch(`/api/shops/search?${params.toString()}`);
      const data = (await response.json()) as { shops: Shop[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "네이버 지역 검색에 실패했습니다.");
      }

      setApiShops(data.shops);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "네이버 지역 검색에 실패했습니다.");
      setApiShops([]);
    } finally {
      setIsLoading(false);
    }
  }

  return { filters, results, updateFilters, searchNaverShops, isLoading, errorMessage };
}
