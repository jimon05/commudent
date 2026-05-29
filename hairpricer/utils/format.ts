import type { PriceStatus, SourceType, StylePrice } from "@/types/shop";

export function formatWon(price: number | null): string {
  if (price === null) return "가격 정보 확인 필요";
  return `${price.toLocaleString("ko-KR")}원`;
}

export function formatPriceRange(price: Pick<StylePrice, "minPrice" | "maxPrice" | "priceText">): string {
  if (price.priceText) return price.priceText;
  if (price.minPrice !== null && price.maxPrice !== null && price.minPrice === price.maxPrice) {
    return formatWon(price.minPrice);
  }
  if (price.minPrice !== null && price.maxPrice !== null) {
    return `${formatWon(price.minPrice)} ~ ${formatWon(price.maxPrice)}`;
  }
  if (price.minPrice !== null) {
    return `${formatWon(price.minPrice)}부터`;
  }
  return "가격 정보 확인 필요";
}

export function formatDate(date: string | null): string {
  if (!date) return "수집일 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(date));
}

export function priceStatusLabel(status: PriceStatus): string {
  const labels: Record<PriceStatus, string> = {
    collected: "수집 완료",
    partial: "일부 수집",
    unavailable: "확인 필요"
  };

  return labels[status];
}

export function priceStatusDescription(status: PriceStatus): string {
  const descriptions: Record<PriceStatus, string> = {
    collected: "정확한 가격 정보 확보",
    partial: "일부 가격 정보만 확보",
    unavailable: "가격 정보 확인 필요"
  };

  return descriptions[status];
}

export function sourceTypeLabel(sourceType: SourceType): string {
  const labels: Record<SourceType, string> = {
    naver_place: "네이버 플레이스",
    naver_reservation: "네이버 예약",
    instagram: "인스타그램",
    blog: "블로그",
    official_site: "공식 사이트",
    image_ocr: "이미지 OCR",
    manual: "수동 입력"
  };

  return labels[sourceType];
}
