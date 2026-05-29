export type GenderCategory = "women" | "men" | "unisex";
export type ServiceCategory = "cut" | "perm" | "color" | "clinic" | "styling";
export type PriceStatus = "collected" | "partial" | "unavailable";
export type SourceType =
  | "naver_place"
  | "naver_reservation"
  | "instagram"
  | "blog"
  | "official_site"
  | "image_ocr"
  | "manual";

export type StylePrice = {
  menuName: string;
  minPrice: number | null;
  maxPrice: number | null;
  priceText: string;
  status: PriceStatus;
  sourceType: SourceType;
  sourceUrl: string | null;
  capturedText: string | null;
  collectedAt: string | null;
};

export type Shop = {
  id: string;
  name: string;
  category: GenderCategory;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  styleImages: string[];
  supportedStyles: string[];
  serviceCategories: ServiceCategory[];
  stylePrices: StylePrice[];
  reviewSummary: string;
  pros: string[];
  cautions: string[];
  phone: string;
  naverUrl: string | null;
  snsUrl: string | null;
};

export type SearchFilters = {
  locationQuery: string;
  selectedCategory: ServiceCategory;
  selectedMenu: string;
  priceStatuses: PriceStatus[];
  sortBy: "distance" | "rating" | "price" | "reviews";
};

export type ShopSearchResult = Shop & {
  distanceKm: number;
  matchedPrice: StylePrice | null;
};

export type SavedStylePrice = {
  id: string;
  shopName: string;
  stylePrice: StylePrice;
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
};
