import type { Shop } from "@/types/shop";

export type ShopRepository = {
  listShops: () => Promise<Shop[]>;
  getShopById: (id: string) => Promise<Shop | null>;
};

// TODO: Replace and extend this repository with official/public data adapters.
// 1. 네이버 플레이스 공식 상세 데이터 연동 가능 여부 검토
// 2. 미용실이 직접 가격표를 등록할 수 있는 관리자 페이지
// 3. OCR 기반 가격표 이미지 분석
// 4. 블로그/리뷰 기반 후기 요약
// 5. 가격 정보 수동 검수 시스템
// 6. 지도 API 연동
// 7. 사용자 위치 기반 검색
