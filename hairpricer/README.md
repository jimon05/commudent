# HairPricer

사용자가 지역과 실제 미용실 메뉴를 선택하면 네이버 지역 검색 API에서 가져온 주변 미용실 정보를 비교할 수 있는 Next.js MVP입니다.

가격은 절대 추정하지 않습니다. 공개 출처에서 확인된 항목은 `collected`, 일부만 확인된 항목은 `partial`, 가격이 공개되지 않은 항목은 `unavailable`로 표시합니다.

## 설치 방법

```bash
cd hairpricer
npm install
```

## 실행 방법

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 네이버 지역 검색 API

검색 UI의 `검색` 버튼을 누르면 `/app/api/shops/search/route.ts`가 서버에서 네이버 지역 검색 API를 호출합니다.

- 검색 키워드: `{지역명} 미용실`
- 예: `신촌 미용실`, `홍대 미용실`
- 클라이언트에는 네이버 API key를 노출하지 않습니다.
- 실제 네이버 지역 검색 API는 가격 정보를 제공하지 않을 수 있으므로, API 결과의 가격은 `minPrice = null`, `maxPrice = null`, `status = "unavailable"`로 처리합니다.
- 화면 표시 문구는 `가격 정보 확인 필요`입니다.
- `NAVER_CLIENT_ID` 또는 `NAVER_CLIENT_SECRET`이 없으면 화면에 `네이버 API 키가 설정되지 않았습니다`라고 표시합니다.

## .env.local 설정

프로젝트 루트에 `.env.local`을 만들고 네이버 개발자 센터에서 발급받은 값을 넣습니다.

```bash
NAVER_CLIENT_ID=발급받은_CLIENT_ID
NAVER_CLIENT_SECRET=발급받은_CLIENT_SECRET
```

주의:

- `NEXT_PUBLIC_NAVER_CLIENT_ID`를 사용하지 않습니다.
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`은 서버 API route에서만 읽습니다.
- `.env.local` 수정 후에는 dev 서버를 재시작합니다.

## 배포

Vercel에서 `hairpricer` 폴더를 프로젝트 루트로 지정하면 바로 배포할 수 있습니다.

```bash
npm run build
npm run start
```

## 프로젝트 구조

```text
app/          App Router 페이지와 전역 스타일
components/   검색, 카드, 가격 배지, 상세 정보 UI
data/         메뉴 카탈로그
types/        Shop, StylePrice, 검색 필터 타입
services/     검색, 정렬, 거리 계산, 네이버 지역 검색 API 어댑터
hooks/        클라이언트 검색 상태 관리
utils/        가격, 날짜, 출처 라벨 포맷터
```

## 데이터 모델

`StylePrice`는 가격 출처와 수집 날짜를 함께 저장합니다.

```ts
type StylePrice = {
  menuName: string;
  minPrice: number | null;
  maxPrice: number | null;
  priceText: string;
  status: "collected" | "partial" | "unavailable";
  sourceType:
    | "naver_place"
    | "naver_reservation"
    | "instagram"
    | "blog"
    | "official_site"
    | "image_ocr"
    | "manual";
  sourceUrl: string | null;
  capturedText: string | null;
  collectedAt: string | null;
};
```

`unavailable` 상태의 가격은 `minPrice = null`, `maxPrice = null`로 저장해 UI와 정렬 로직에서 임의 금액을 만들지 않도록 했습니다.

가격 표시 규칙:

- `minPrice`와 `maxPrice`가 같으면 `35,000원`
- 둘이 다르면 `80,000원 ~ 150,000원`
- `minPrice`만 있으면 `80,000원부터`
- 가격이 없으면 `가격 정보 확인 필요`

## 가격 수집 파이프라인

현재 네이버 지역 검색 API는 실제 매장 목록 검색에만 사용합니다. 시술 가격은 자동 추정하지 않고, 공개 페이지나 가격표 이미지에서 실제로 확인된 문장만 `StylePrice`로 저장하는 구조입니다.

관련 파일:

- `services/priceOcr.ts`: 이미지 URL 또는 업로드 이미지에서 OCR 텍스트를 반환하는 서비스 계층
- `services/priceExtractor.ts`: OCR/텍스트에서 메뉴명과 가격 범위를 추출해 `StylePrice`로 변환
- `app/admin/price-upload/page.tsx`: 가격표 이미지 업로드 및 검수 화면
- `app/api/price/ocr/route.ts`: OCR 실행 API route

관리자 업로드 흐름:

1. `/admin/price-upload` 접속
2. 미용실명, 메뉴명, 출처 URL 입력
3. 가격표 이미지 업로드
4. OCR 실행
5. OCR 결과 텍스트 확인 및 수정
6. 메뉴명/가격 범위 추출
7. 추출 결과 수동 검수
8. 저장

저장된 가격은 브라우저 `localStorage`에 JSON으로 보관됩니다. 검색 결과에서 네이버 API 매장명과 저장된 미용실명, 선택 메뉴명이 일치하면 `unavailable` 대신 수집된 가격으로 표시합니다.

현재 OCR은 `tesseract.js`로 서버 API route에서 실행합니다. OCR 정확도는 이미지 품질과 한글 가격표 형식에 따라 달라질 수 있으므로, 저장 전 수동 검수 단계를 반드시 거칩니다.

추후 고도화 후보:

- Google Vision API
- CLOVA OCR
- Tesseract.js
- 미용실 관리자 직접 가격표 등록
- OCR 결과 수동 검수 및 수정

## 확장 방법

현재 `/app/api/shops/search/route.ts`의 네이버 지역 검색 API 구조를 기반으로 실제 데이터 수집 파이프라인을 확장할 수 있습니다.

추천 확장 순서:

1. 네이버 플레이스 공식 상세 데이터 연동 가능 여부 검토
2. 미용실이 직접 가격표를 등록할 수 있는 관리자 페이지
3. OCR 기반 가격표 이미지 분석
4. 블로그/리뷰 기반 후기 요약
5. 가격 정보 수동 검수 시스템
6. 지도 API 연동
7. 사용자 위치 기반 검색

## MVP 범위

- 지역명 검색
- 메뉴 대분류 선택
- 메뉴 세부 선택
- 수집 완료, 일부 수집, 확인 필요 가격 상태 필터
- 거리순, 평점순, 가격순, 리뷰 수 순 정렬
- 검색 결과 카드 UI
- 가격 출처, 수집 날짜, 확인 문구 표시
- 네이버 지역 검색 API 연동
