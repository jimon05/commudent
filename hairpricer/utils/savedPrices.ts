import type { SavedStylePrice, Shop } from "@/types/shop";

export const SAVED_PRICE_STORAGE_KEY = "hairpricer:saved-style-prices";

export function readSavedStylePrices(): SavedStylePrice[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_PRICE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedStylePrice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSavedStylePrices(prices: SavedStylePrice[]) {
  window.localStorage.setItem(SAVED_PRICE_STORAGE_KEY, JSON.stringify(prices));
  window.dispatchEvent(new Event("hairpricer:saved-prices-updated"));
}

export function upsertSavedStylePrice(nextPrice: SavedStylePrice) {
  const current = readSavedStylePrices();
  const next = [
    nextPrice,
    ...current.filter(
      (item) =>
        normalize(item.shopName) !== normalize(nextPrice.shopName) ||
        normalize(item.stylePrice.menuName) !== normalize(nextPrice.stylePrice.menuName)
    )
  ];

  writeSavedStylePrices(next);
}

export function applySavedPricesToShops(shops: Shop[], savedPrices: SavedStylePrice[]): Shop[] {
  if (savedPrices.length === 0) return shops;

  return shops.map((shop) => {
    const matchingPrices = savedPrices.filter(
      (saved) =>
        namesMatch(saved.shopName, shop.name) &&
        shop.supportedStyles.some((menuName) => normalize(menuName) === normalize(saved.stylePrice.menuName))
    );

    if (matchingPrices.length === 0) return shop;

    return {
      ...shop,
      stylePrices: mergeStylePrices(shop.stylePrices, matchingPrices.map((item) => item.stylePrice))
    };
  });
}

function mergeStylePrices(existingPrices: Shop["stylePrices"], savedPrices: Shop["stylePrices"]) {
  const remaining = existingPrices.filter(
    (price) => !savedPrices.some((saved) => normalize(saved.menuName) === normalize(price.menuName))
  );

  return [...savedPrices, ...remaining];
}

function namesMatch(a: string, b: string): boolean {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  return normalizedA === normalizedB || normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

function normalize(value: string): string {
  return value.trim().replace(/\s/g, "").toLowerCase();
}
