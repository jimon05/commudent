import { recognize } from "tesseract.js";

export type PriceOcrInput =
  | {
      type: "imageUrl";
      imageUrl: string;
    }
  | {
      type: "file";
      fileName: string;
      contentType: string;
      bytes: ArrayBuffer;
    };

export type PriceOcrResult = {
  text: string;
  sourceUrl: string | null;
  capturedAt: string;
};

export async function extractTextFromPriceImage(input: PriceOcrInput): Promise<PriceOcrResult> {
  const image = input.type === "imageUrl" ? input.imageUrl : Buffer.from(input.bytes);
  const result = await recognize(image, "kor+eng");

  // TODO: Store raw OCR results for administrator review before marking prices as collected.
  // TODO: Add an upload flow for salons or operators to submit price table images.
  // TODO: Evaluate Google Vision API or CLOVA OCR if Tesseract accuracy is not enough for Korean price tables.
  return {
    text: result.data.text.trim(),
    sourceUrl: input.type === "imageUrl" ? input.imageUrl : null,
    capturedAt: new Date().toISOString()
  };
}
