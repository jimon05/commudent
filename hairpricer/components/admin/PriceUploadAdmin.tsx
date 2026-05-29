"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { extractStylePriceForMenu } from "@/services/priceExtractor";
import type { PriceStatus, SavedStylePrice, StylePrice } from "@/types/shop";
import { formatPriceRange, priceStatusLabel } from "@/utils/format";
import { readSavedStylePrices, upsertSavedStylePrice } from "@/utils/savedPrices";

type EditablePrice = {
  menuName: string;
  minPrice: string;
  maxPrice: string;
  priceText: string;
  status: PriceStatus;
  sourceUrl: string;
  capturedText: string;
  collectedAt: string;
};

const today = new Date().toISOString();

export function PriceUploadAdmin() {
  const [shopName, setShopName] = useState("");
  const [menuName, setMenuName] = useState("여성 디자인컷");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [editablePrice, setEditablePrice] = useState<EditablePrice>(() =>
    createEditablePrice(menuName, sourceUrl, null)
  );
  const [savedCount, setSavedCount] = useState(() => readSavedStylePrices().length);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const previewPrice: StylePrice = useMemo(
    () => editableToStylePrice(editablePrice),
    [editablePrice]
  );

  function handleFileChange(file: File | null) {
    setImageFile(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function runOcr() {
    if (!imageFile) {
      setOcrMessage("가격표 이미지를 먼저 선택해 주세요.");
      return;
    }

    setIsOcrRunning(true);
    setOcrMessage(null);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const response = await fetch("/api/price/ocr", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { text?: string; error?: string };

      if (!response.ok) throw new Error(data.error ?? "OCR 실행에 실패했습니다.");

      setOcrText(data.text ?? "");
      setOcrMessage(
        data.text
          ? "OCR 결과를 불러왔습니다. 저장 전 반드시 검수해 주세요."
          : "OCR provider가 아직 연결되지 않아 텍스트가 비어 있습니다. 추출할 문장을 직접 입력해 주세요."
      );
    } catch (error) {
      setOcrMessage(error instanceof Error ? error.message : "OCR 실행에 실패했습니다.");
    } finally {
      setIsOcrRunning(false);
    }
  }

  function extractPrice() {
    const extracted = extractStylePriceForMenu(ocrText, menuName, "image_ocr", sourceUrl || null, today);
    const nextPrice = createEditablePrice(menuName, sourceUrl, extracted);
    setEditablePrice(nextPrice);
    setSaveMessage(extracted ? "가격을 추출했습니다. 저장 전 내용을 확인해 주세요." : "메뉴명과 가격을 찾지 못했습니다. OCR 텍스트 또는 추출 결과를 직접 수정해 주세요.");
  }

  function savePrice() {
    if (!shopName.trim()) {
      setSaveMessage("미용실명을 입력해 주세요.");
      return;
    }

    const stylePrice = editableToStylePrice(editablePrice);
    const now = new Date().toISOString();
    const saved: SavedStylePrice = {
      id: `${normalize(shopName)}-${normalize(stylePrice.menuName)}`,
      shopName: shopName.trim(),
      stylePrice,
      reviewed: true,
      createdAt: now,
      updatedAt: now
    };

    upsertSavedStylePrice(saved);
    setSavedCount(readSavedStylePrices().length);
    setSaveMessage("저장했습니다. 검색 결과에서 같은 미용실명과 메뉴명이 일치하면 수집 가격으로 표시됩니다.");
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Link href="/" className="text-sm font-bold text-stone-600 hover:text-ink">
          ← 검색 화면으로 돌아가기
        </Link>

        <header className="mt-5">
          <p className="text-sm font-bold text-coral">HairPricer Admin</p>
          <h1 className="mt-1 text-3xl font-black text-ink">가격표 이미지 업로드</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            업로드된 가격표 이미지에서 OCR 텍스트를 확인하고, 메뉴별 가격을 추출한 뒤 검수된 가격만 저장합니다.
          </p>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-ink">입력 정보</h2>
            <div className="mt-4 space-y-4">
              <Input label="미용실명" value={shopName} onChange={setShopName} placeholder="예: 제오헤어 신촌점" />
              <Input label="메뉴명" value={menuName} onChange={(value) => {
                setMenuName(value);
                setEditablePrice((current) => ({ ...current, menuName: value }));
              }} placeholder="예: 여성 디자인컷" />
              <Input label="출처 URL" value={sourceUrl} onChange={(value) => {
                setSourceUrl(value);
                setEditablePrice((current) => ({ ...current, sourceUrl: value }));
              }} placeholder="가격표가 공개된 페이지 URL" />

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">가격표 이미지</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-lg border border-line bg-white p-3 text-sm"
                />
              </label>

              {imagePreviewUrl && (
                <div className="overflow-hidden rounded-lg border border-line bg-stone-100">
                  <img src={imagePreviewUrl} alt="업로드한 가격표 미리보기" className="max-h-80 w-full object-contain" />
                </div>
              )}

              <button
                type="button"
                onClick={runOcr}
                disabled={isOcrRunning}
                className="h-12 rounded-lg bg-ink px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOcrRunning ? "OCR 실행 중" : "OCR 실행"}
              </button>
              {ocrMessage && <p className="text-sm font-semibold text-amber-700">{ocrMessage}</p>}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-ink">OCR 결과 텍스트</h2>
                <button type="button" onClick={extractPrice} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-stone-700">
                  가격 추출
                </button>
              </div>
              <textarea
                value={ocrText}
                onChange={(event) => setOcrText(event.target.value)}
                placeholder={"예: 여성 디자인컷 35,000원\n전체염색 80,000~150,000\n탈색 1회 100,000원부터"}
                className="mt-3 min-h-44 w-full rounded-lg border border-line bg-stone-50 p-3 text-sm leading-6 outline-none focus:border-coral"
              />
            </section>

            <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-ink">추출 결과 검수</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input label="메뉴명" value={editablePrice.menuName} onChange={(value) => setEditablePrice((current) => ({ ...current, menuName: value }))} />
                <SelectStatus value={editablePrice.status} onChange={(status) => setEditablePrice((current) => ({ ...current, status }))} />
                <Input label="최소 가격" value={editablePrice.minPrice} onChange={(value) => setEditablePrice((current) => ({ ...current, minPrice: onlyDigits(value) }))} placeholder="35000" />
                <Input label="최대 가격" value={editablePrice.maxPrice} onChange={(value) => setEditablePrice((current) => ({ ...current, maxPrice: onlyDigits(value) }))} placeholder="150000" />
                <Input label="표시 가격 문구" value={editablePrice.priceText} onChange={(value) => setEditablePrice((current) => ({ ...current, priceText: value }))} placeholder="35,000원" />
                <Input label="수집 날짜" value={editablePrice.collectedAt} onChange={(value) => setEditablePrice((current) => ({ ...current, collectedAt: value }))} />
              </div>
              <label className="mt-3 block">
                <span className="text-sm font-semibold text-stone-700">수집 문장</span>
                <textarea
                  value={editablePrice.capturedText}
                  onChange={(event) => setEditablePrice((current) => ({ ...current, capturedText: event.target.value }))}
                  className="mt-2 min-h-20 w-full rounded-lg border border-line bg-stone-50 p-3 text-sm outline-none focus:border-coral"
                />
              </label>

              <div className="mt-4 rounded-lg bg-stone-50 p-3">
                <p className="text-xs font-semibold text-stone-500">미리보기</p>
                <p className="mt-1 text-lg font-black text-ink">{formatPriceRange(previewPrice)}</p>
                <p className="mt-1 text-xs font-semibold text-stone-500">{priceStatusLabel(previewPrice.status)}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={savePrice} className="h-12 rounded-lg bg-ink px-5 text-sm font-bold text-white">
                  저장
                </button>
                <p className="text-sm text-stone-500">저장된 가격 {savedCount}개</p>
              </div>
              {saveMessage && <p className="mt-3 text-sm font-semibold text-teal">{saveMessage}</p>}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-lg border border-line bg-stone-50 px-3 text-sm font-semibold outline-none focus:border-coral"
      />
    </label>
  );
}

function SelectStatus({ value, onChange }: { value: PriceStatus; onChange: (status: PriceStatus) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">가격 상태</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as PriceStatus)}
        className="mt-2 h-12 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-coral"
      >
        <option value="collected">수집 완료</option>
        <option value="partial">일부 수집</option>
        <option value="unavailable">확인 필요</option>
      </select>
    </label>
  );
}

function createEditablePrice(menuName: string, sourceUrl: string, price: StylePrice | null): EditablePrice {
  return {
    menuName: price?.menuName ?? menuName,
    minPrice: price?.minPrice?.toString() ?? "",
    maxPrice: price?.maxPrice?.toString() ?? "",
    priceText: price?.priceText ?? "가격 정보 확인 필요",
    status: price?.status ?? "unavailable",
    sourceUrl: price?.sourceUrl ?? sourceUrl,
    capturedText: price?.capturedText ?? "",
    collectedAt: price?.collectedAt ?? today
  };
}

function editableToStylePrice(price: EditablePrice): StylePrice {
  return {
    menuName: price.menuName.trim(),
    minPrice: price.minPrice ? Number(price.minPrice) : null,
    maxPrice: price.maxPrice ? Number(price.maxPrice) : null,
    priceText: price.priceText.trim() || "가격 정보 확인 필요",
    status: price.status,
    sourceType: "image_ocr",
    sourceUrl: price.sourceUrl.trim() || null,
    capturedText: price.capturedText.trim() || null,
    collectedAt: price.collectedAt || null
  };
}

function onlyDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function normalize(value: string): string {
  return value.trim().replace(/\s/g, "").toLowerCase();
}
