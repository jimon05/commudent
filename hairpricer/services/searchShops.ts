import type {
  PriceStatus,
  SearchFilters,
  Shop,
  ShopSearchResult,
  StylePrice
} from "@/types/shop";

const locationAnchors: Record<string, { latitude: number; longitude: number }> = {
  신촌: { latitude: 37.5552, longitude: 126.9368 },
  창천동: { latitude: 37.5581, longitude: 126.9369 },
  신촌역: { latitude: 37.5551, longitude: 126.9369 },
  홍대: { latitude: 37.5575, longitude: 126.9245 },
  홍대입구: { latitude: 37.5572, longitude: 126.9254 },
  강남: { latitude: 37.4979, longitude: 127.0276 },
  강남역: { latitude: 37.4979, longitude: 127.0276 },
  성수: { latitude: 37.5446, longitude: 127.0557 },
  잠실: { latitude: 37.5133, longitude: 127.1002 }
};

export const defaultFilters: SearchFilters = {
  locationQuery: "신촌",
  selectedCategory: "cut",
  selectedMenu: "여성 디자인컷",
  priceStatuses: [],
  sortBy: "distance"
};

export function searchShops(shops: Shop[], filters: SearchFilters): ShopSearchResult[] {
  const location = normalize(filters.locationQuery);
  const selectedMenu = normalize(filters.selectedMenu);
  const anchor = findLocationAnchor(filters.locationQuery);

  const results = shops
    .filter((shop) => {
      const matchesLocation =
        !location ||
        normalize(shop.neighborhood).includes(location) ||
        normalize(shop.address).includes(location);
      const matchesService = shop.serviceCategories.includes(filters.selectedCategory);
      const matchesStatus =
        filters.priceStatuses.length === 0 ||
        shop.stylePrices.some((price) => filters.priceStatuses.includes(price.status));

      return matchesLocation && matchesService && matchesStatus;
    })
    .map((shop) => {
      const matchedPrice = findMatchedPrice(shop.stylePrices, filters.selectedMenu);
      return {
        ...shop,
        distanceKm: calculateDistanceKm(anchor, shop),
        matchedPrice
      };
    })
    .filter((shop) => !selectedMenu || hasMenu(shop.supportedStyles, selectedMenu) || shop.matchedPrice)
    .sort((a, b) => compareResults(a, b, filters.sortBy));

  return results;
}

export function getPrimaryPriceStatus(shop: ShopSearchResult | Shop): PriceStatus {
  const prices = shop.stylePrices;
  if (prices.some((price) => price.status === "collected")) return "collected";
  if (prices.some((price) => price.status === "partial")) return "partial";
  return "unavailable";
}

function findMatchedPrice(prices: StylePrice[], selectedMenu: string): StylePrice | null {
  const query = normalize(selectedMenu);
  if (!query) return prices.find((price) => price.status === "collected") ?? prices[0] ?? null;

  return (
    prices.find((price) => normalize(price.menuName) === query) ??
    prices.find((price) => normalize(price.menuName).includes(query) || query.includes(normalize(price.menuName))) ??
    prices.find((price) => price.status === "collected") ??
    prices[0] ??
    null
  );
}

function compareResults(
  a: ShopSearchResult,
  b: ShopSearchResult,
  sortBy: SearchFilters["sortBy"]
): number {
  if (sortBy === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
  if (sortBy === "reviews") return b.reviewCount - a.reviewCount || b.rating - a.rating;
  if (sortBy === "price") return getComparablePrice(a) - getComparablePrice(b);
  return a.distanceKm - b.distanceKm || b.rating - a.rating;
}

function getComparablePrice(shop: ShopSearchResult): number {
  const price = shop.matchedPrice?.minPrice;
  return price === null || price === undefined ? Number.MAX_SAFE_INTEGER : price;
}

function findLocationAnchor(locationQuery: string) {
  const query = normalize(locationQuery);
  const key = Object.keys(locationAnchors).find((name) => query.includes(normalize(name)));
  return key ? locationAnchors[key] : locationAnchors.신촌;
}

function calculateDistanceKm(anchor: { latitude: number; longitude: number }, shop: Shop): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(shop.latitude - anchor.latitude);
  const dLon = toRadians(shop.longitude - anchor.longitude);
  const lat1 = toRadians(anchor.latitude);
  const lat2 = toRadians(shop.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function normalize(value: string): string {
  return value.trim().replace(/\s/g, "").toLowerCase();
}

function hasMenu(styles: string[], selectedMenu: string): boolean {
  return styles.some((style) => normalize(style) === selectedMenu);
}
