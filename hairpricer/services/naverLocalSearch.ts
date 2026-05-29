import type { ServiceCategory, Shop } from "@/types/shop";

type NaverLocalSearchItem = {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
};

type NaverLocalSearchResponse = {
  total: number;
  start: number;
  display: number;
  items: NaverLocalSearchItem[];
};

type SearchNaverLocalParams = {
  location: string;
  selectedMenu: string;
  selectedCategory: ServiceCategory;
  display?: number;
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80";

export async function searchNaverHairShops({
  location,
  selectedMenu,
  selectedCategory,
  display = 10
}: SearchNaverLocalParams): Promise<Shop[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("네이버 API 키가 설정되지 않았습니다");
  }

  const query = `${location.trim() || "서울"} 미용실`;
  const endpoint = new URL("https://openapi.naver.com/v1/search/local.json");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("display", String(display));
  endpoint.searchParams.set("sort", "random");

  const response = await fetch(endpoint, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    },
    next: { revalidate: 60 * 30 }
  });

  if (!response.ok) {
    throw new Error(`Naver local search failed: ${response.status}`);
  }

  const data = (await response.json()) as NaverLocalSearchResponse;

  return data.items.map((item, index) =>
    mapNaverLocalItemToShop(item, index, location, selectedMenu, selectedCategory)
  );
}

function mapNaverLocalItemToShop(
  item: NaverLocalSearchItem,
  index: number,
  location: string,
  selectedMenu: string,
  selectedCategory: ServiceCategory
): Shop {
  const name = stripHtml(item.title);
  const address = item.roadAddress || item.address || "주소 확인 필요";
  const naverUrl = buildNaverUrl(item, name, address);

  return {
    id: `naver-${index}-${encodeURIComponent(name)}`,
    name,
    category: "unisex",
    address,
    neighborhood: location,
    latitude: 0,
    longitude: 0,
    rating: 0,
    reviewCount: 0,
    styleImages: [PLACEHOLDER_IMAGE],
    supportedStyles: [selectedMenu],
    serviceCategories: [selectedCategory],
    stylePrices: [
      {
        menuName: selectedMenu,
        minPrice: null,
        maxPrice: null,
        priceText: "가격 정보 확인 필요",
        status: "unavailable",
        sourceType: "naver_place",
        sourceUrl: naverUrl,
        capturedText: null,
        collectedAt: null
      }
    ],
    reviewSummary: "네이버 지역 검색으로 확인된 매장입니다. 가격과 후기 요약은 추가 수집 및 검수 후 표시됩니다.",
    pros: ["실제 지역 검색 결과"],
    cautions: ["가격 정보 확인 필요", "평점과 리뷰 수는 상세 데이터 연동 후 표시"],
    phone: item.telephone || "전화번호 확인 필요",
    naverUrl,
    snsUrl: ""
  };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

function buildNaverUrl(item: NaverLocalSearchItem, name: string, address: string): string | null {
  if (isHttpUrl(item.link)) return item.link;

  const searchTarget = [name, address].filter(Boolean).join(" ");
  if (searchTarget) {
    return `https://map.naver.com/p/search/${encodeURIComponent(searchTarget)}`;
  }

  if (item.mapx && item.mapy) {
    return `https://map.naver.com/p/search/${encodeURIComponent(`${item.mapx},${item.mapy}`)}`;
  }

  return null;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
