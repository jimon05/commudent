import { inflateRawSync, inflateSync } from "node:zlib";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ZipEntry = {
  name: string;
  data: Buffer;
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ text: "", warning: "파일을 찾지 못했습니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const pageCount = countPages(buffer, name);
  const text = extractText(buffer, name).trim();

  return NextResponse.json({
    text,
    pageCount,
    warning: text ? "" : "파일에서 텍스트를 자동 추출하지 못했습니다. 핵심 문장을 입력칸에 붙여넣어 주세요."
  });
}

function extractText(buffer: Buffer, fileName: string) {
  if (/\.(pptx|docx)$/i.test(fileName)) return extractOfficeText(buffer, fileName);
  if (/\.pdf$/i.test(fileName)) return extractPdfText(buffer);
  return buffer.toString("utf8");
}

function extractOfficeText(buffer: Buffer, fileName: string) {
  const entries = readZipEntries(buffer);
  if (fileName.endsWith(".pptx")) {
    return entries
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
      .sort((a, b) => slideNumber(a.name) - slideNumber(b.name))
      .map((entry, index) => {
        const text = xmlText(entry.data.toString("utf8"));
        return text ? `Slide ${index + 1}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  return documentEntry ? officeXmlText(documentEntry.data.toString("utf8")) : "";
}

function countPages(buffer: Buffer, fileName: string) {
  if (fileName.endsWith(".pdf")) return countPdfPages(buffer);
  if (fileName.endsWith(".pptx")) return countPptxSlides(buffer);
  return 0;
}

function countPdfPages(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const streamTexts: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const inflated = tryInflate(Buffer.from(match[1], "latin1"));
    if (inflated) streamTexts.push(inflated.toString("latin1"));
  }

  return Math.max(...[raw, ...streamTexts].map(countPdfPagesInSource), 0);
}

function countPdfPagesInSource(source: string) {
  const explicitPages = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  const pagesTreeCounts = [...source.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,800}?\/Count\s+(\d+)/g)]
    .map((item) => Number(item[1]))
    .filter(Number.isFinite);
  const broadCounts = [...source.matchAll(/\/Count\s+(\d+)/g)]
    .map((item) => Number(item[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1000);

  return Math.max(explicitPages, ...pagesTreeCounts, ...broadCounts, 0);
}

function countPptxSlides(buffer: Buffer) {
  return readZipEntries(buffer).filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name)).length;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findSignatureBackwards(buffer, 0x06054b50);
  if (eocdOffset < 0) return [];

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    try {
      const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0);
      entries.push({ name, data });
    } catch {
      entries.push({ name, data: Buffer.alloc(0) });
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const streamTexts: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const chunk = Buffer.from(match[1], "latin1");
    const inflated = tryInflate(chunk);
    streamTexts.push(inflated?.toString("latin1") ?? match[1]);
  }

  return decodePdfText([...streamTexts, raw].join("\n"));
}

function tryInflate(chunk: Buffer) {
  try {
    return inflateSync(chunk);
  } catch {
    try {
      return inflateRawSync(chunk);
    } catch {
      return null;
    }
  }
}

function decodePdfText(value: string) {
  const parts: string[] = [];
  const literalRegex = /\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g;
  const arrayRegex = /\[((?:\s*\([^()]*(?:\\.[^()]*)*\)\s*)+)\]\s*TJ/g;
  let match: RegExpExecArray | null;

  while ((match = literalRegex.exec(value)) !== null) parts.push(unescapePdfString(match[1]));
  while ((match = arrayRegex.exec(value)) !== null) {
    const inner = match[1].match(/\(([^()]*(?:\\.[^()]*)*)\)/g) ?? [];
    parts.push(inner.map((item) => unescapePdfString(item.slice(1, -1))).join(""));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function xmlText(value: string) {
  return officeXmlText(value);
}

function officeXmlText(value: string) {
  const paragraphs = value
    .split(/<\/(?:w:p|a:p)>/i)
    .map((paragraph) => {
      const textNodes = [...paragraph.matchAll(/<((?:w|a):t)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
      return textNodes.map((match) => decodeXml(match[2])).join("");
    })
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.join("\n").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function unescapePdfString(value: string) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1");
}

function findSignatureBackwards(buffer: Buffer, signature: number) {
  for (let offset = buffer.length - 4; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}

function slideNumber(name: string) {
  return Number(name.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
}
