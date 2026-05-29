import { NextResponse } from "next/server";
import { searchNaverHairShops } from "@/services/naverLocalSearch";
import type { ServiceCategory } from "@/types/shop";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location") ?? "";
  const selectedMenu = searchParams.get("menu") ?? "여성 디자인컷";
  const selectedCategory = (searchParams.get("category") ?? "cut") as ServiceCategory;

  try {
    const shops = await searchNaverHairShops({
      location,
      selectedMenu,
      selectedCategory
    });

    return NextResponse.json({ shops });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Naver local search error.";

    return NextResponse.json(
      {
        error: message,
        shops: []
      },
      { status: message === "네이버 API 키가 설정되지 않았습니다" ? 401 : 500 }
    );
  }
}
