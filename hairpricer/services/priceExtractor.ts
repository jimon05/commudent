import type { SourceType, StylePrice } from "@/types/shop";

type ExtractPriceParams = {
  text: string;
  menuNames: string[];
  sourceType: SourceType;
  sourceUrl: string | null;
  collectedAt?: string;
};

export function extractStylePricesFromText({
  text,
  menuNames,
  sourceType,
  sourceUrl,
  collectedAt = new Date().toISOString()
}: ExtractPriceParams): StylePrice[] {
  return menuNames
    .map((menuName) => extractStylePriceForMenu(text, menuName, sourceType, sourceUrl, collectedAt))
    .filter((price): price is StylePrice => price !== null);
}

export function extractStylePriceForMenu(
  text: string,
  menuName: string,
  sourceType: SourceType,
  sourceUrl: string | null,
  collectedAt = new Date().toISOString()
): StylePrice | null {
  const line = findLineForMenu(text, menuName);
  if (!line) return null;

  const parsed = parsePriceText(line);
  if (!parsed) return null;

  return {
    menuName,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    priceText: parsed.priceText,
    status: parsed.maxPrice === null && parsed.hasFromText ? "partial" : "collected",
    sourceType,
    sourceUrl,
    capturedText: line,
    collectedAt
  };
}

export function createUnavailablePrice(menuName: string, sourceUrl: string | null): StylePrice {
  return {
    menuName,
    minPrice: null,
    maxPrice: null,
    priceText: "가격 정보 확인 필요",
    status: "unavailable",
    sourceType: "naver_place",
    sourceUrl,
    capturedText: null,
    collectedAt: null
  };
}

function findLineForMenu(text: string, menuName: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.find((line) => normalize(line).includes(normalize(menuName))) ?? null;
}

function parsePriceText(line: string): {
  minPrice: number;
  maxPrice: number | null;
  priceText: string;
  hasFromText: boolean;
} | null {
  const numbers = [...line.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,})/g)].map((match) =>
    Number(match[1].replace(/,/g, ""))
  );

  if (numbers.length === 0) return null;

  const hasRange = /~|-|부터|이상/.test(line);
  const hasFromText = /부터|이상/.test(line);
  const minPrice = numbers[0];
  const maxPrice = numbers.length > 1 && hasRange ? numbers[1] : hasFromText ? null : minPrice;

  return {
    minPrice,
    maxPrice,
    priceText: formatParsedPrice(minPrice, maxPrice),
    hasFromText
  };
}

function formatParsedPrice(minPrice: number, maxPrice: number | null): string {
  if (maxPrice === null) return `${minPrice.toLocaleString("ko-KR")}원부터`;
  if (minPrice === maxPrice) return `${minPrice.toLocaleString("ko-KR")}원`;
  return `${minPrice.toLocaleString("ko-KR")}원 ~ ${maxPrice.toLocaleString("ko-KR")}원`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s/g, "").toLowerCase();
}

// TODO: Add administrator review states:
// - OCR 결과 확인
// - 잘못된 가격 수정
// - 메뉴 매칭 수정
// - 검수 완료 표시
