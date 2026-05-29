import { NextResponse } from "next/server";
import { extractTextFromPriceImage } from "@/services/priceOcr";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image");
  const imageUrl = formData.get("imageUrl");

  if (typeof imageUrl === "string" && imageUrl.trim()) {
    const result = await extractTextFromPriceImage({
      type: "imageUrl",
      imageUrl: imageUrl.trim()
    });

    return NextResponse.json(result);
  }

  if (image instanceof File) {
    const result = await extractTextFromPriceImage({
      type: "file",
      fileName: image.name,
      contentType: image.type,
      bytes: await image.arrayBuffer()
    });

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "가격표 이미지가 필요합니다." }, { status: 400 });
}
