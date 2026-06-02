import { NextResponse } from "next/server";
import { createFallbackPrepAnalysis } from "@/services/presentationAnalysisService";
import type { PresentationPrepAnalysis, SpeechReport } from "@/types/speech";

export const runtime = "nodejs";

const geminiRequestTimeoutMs = 35000;

type RequestBody = {
  title?: string;
  slides?: string;
  script?: string;
  files?: UploadedPrepFile[];
  timeLimit?: number;
  formalityLevel?: number;
  priorReports?: Array<Pick<SpeechReport, "nextFocus" | "savedInsights" | "slideDeliveryFeedback" | "messageResults">>;
};

type UploadedPrepFile = {
  role?: "slides" | "script";
  name?: string;
  mimeType?: string;
  dataBase64?: string;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

type ProviderDetails = {
  provider: "gemini";
  model: string;
  status?: number;
  message: string;
};

type SlidePrepAnalysis = PresentationPrepAnalysis["slides"][number] & {
  emphasisPoints: string[];
};

type PrepAnalysisResponse = Omit<PresentationPrepAnalysis, "slides"> & {
  slides: SlidePrepAnalysis[];
};

class GeminiPrepError extends Error {
  details: ProviderDetails;

  constructor(message: string, details: Omit<ProviderDetails, "provider" | "message"> & { message?: string }) {
    super(message);
    this.name = "GeminiPrepError";
    this.details = {
      provider: "gemini",
      model: details.model,
      status: details.status,
      message: details.message ?? message
    };
  }
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await readRequestBody(request);
  } catch {
    return prepErrorResponse("요청 본문을 읽을 수 없습니다. 발표 자료와 대본을 다시 확인해 주세요.", {
      provider: "gemini",
      model: getGeminiModel(),
      status: 400,
      message: "Invalid JSON request body."
    });
  }

  const script = cleanInputMaterial(body.script);
  const slides = cleanInputMaterial(body.slides);
  const files = sanitizeUploadedFiles(body.files);

  if (!slides && !script && files.length === 0) {
    return prepErrorResponse("Gemini 분석을 위해 발표 자료, 발표 대본, 또는 분석 가능한 파일 중 하나를 입력해 주세요.", {
      provider: "gemini",
      model: getGeminiModel(),
      status: 400,
      message: "At least one of slides, script, or supported files is required."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    const details = {
      provider: "gemini",
      model: getGeminiModel(),
      status: 503,
      message: "GEMINI_API_KEY is not configured."
    } as const;
    console.warn("[PresentationPrep] Gemini is not configured. Returning material-backed fallback analysis.", details);
    return NextResponse.json(createResilientPrepAnalysis({ ...body, slides, script, files }, details.message));
  }

  try {
    const analysis = await generateWithGemini({ ...body, slides, script, files });
    return NextResponse.json(analysis);
  } catch (error) {
    const details = error instanceof GeminiPrepError
      ? error.details
      : {
        provider: "gemini" as const,
        model: getGeminiModel(),
        status: 502,
        message: error instanceof Error ? error.message : "Unknown Gemini presentation prep failure."
    };
    console.error("[PresentationPrep] Gemini failed", details);
    return NextResponse.json(createResilientPrepAnalysis({ ...body, slides, script, files }, details.message));
  }
}

async function readRequestBody(request: Request): Promise<RequestBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return (await request.json()) as RequestBody;

  const formData = await request.formData();
  const priorReportsRaw = String(formData.get("priorReports") ?? "[]");
  const files: UploadedPrepFile[] = [];
  const slidesFile = formData.get("slidesFile");
  const scriptFile = formData.get("scriptFile");
  const inlineFiles = formData.getAll("files");

  if (slidesFile instanceof File) files.push(await uploadedFileToInline(slidesFile, "slides"));
  if (scriptFile instanceof File) files.push(await uploadedFileToInline(scriptFile, "script"));
  inlineFiles.forEach((item) => {
    if (typeof item !== "string") return;
    try {
      files.push(JSON.parse(item) as UploadedPrepFile);
    } catch {
      // Ignore malformed compatibility payloads.
    }
  });

  return {
    title: String(formData.get("title") ?? ""),
    slides: String(formData.get("slides") ?? ""),
    script: String(formData.get("script") ?? ""),
    timeLimit: Number(formData.get("timeLimit") ?? 0) || undefined,
    formalityLevel: Number(formData.get("formalityLevel") ?? 50),
    priorReports: safeParsePriorReports(priorReportsRaw),
    files
  };
}

async function uploadedFileToInline(file: File, role: "slides" | "script"): Promise<UploadedPrepFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    role,
    name: file.name,
    mimeType: file.type || mimeFromName(file.name),
    dataBase64: buffer.toString("base64")
  };
}

async function generateWithGemini(body: RequestBody & { slides: string; script: string; files: UploadedPrepFile[] }): Promise<PrepAnalysisResponse> {
  const models = getGeminiModels();
  let lastError: GeminiPrepError | null = null;
  let primaryError: GeminiPrepError | null = null;

  for (const model of models) {
    try {
      return await generateWithGeminiModel(body, model);
    } catch (error) {
      if (error instanceof GeminiPrepError) {
        lastError = error;
        if (error.details.status !== 404 && !primaryError) primaryError = error;
        if (error.details.status === 429 || error.details.status === 404 || error.details.status === 503) continue;
      }
      throw error;
    }
  }

  throw primaryError ?? lastError ?? new GeminiPrepError("Gemini presentation prep request failed.", { model: models[0], status: 502 });
}

async function generateWithGeminiModel(body: RequestBody & { slides: string; script: string; files: UploadedPrepFile[] }, model: string): Promise<PrepAnalysisResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), geminiRequestTimeoutMs);
  const parts = [
    { text: buildPrompt(body) },
    ...body.files.map((file) => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.dataBase64
      }
    }))
  ];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: prepSchema()
      }
    })
  }).finally(() => clearTimeout(timer));
  const payload = await readGeminiPayload(response);
  if (!response.ok) {
    throw new GeminiPrepError(payload.error?.message ?? "Gemini presentation prep request failed.", {
      model,
      status: response.status,
      message: payload.error?.message
    });
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new GeminiPrepError("Gemini returned an empty presentation prep response.", { model, status: 502 });
  }

  return mergeWithInputSlides(parseGeminiPrepResponse(text, model), body.slides);
}

async function readGeminiPayload(response: Response): Promise<GeminiResponse> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as GeminiResponse;
  } catch {
    return { error: { message: text.slice(0, 800) } };
  }
}

function safeParsePriorReports(value: string): RequestBody["priorReports"] {
  try {
    const parsed = JSON.parse(value) as RequestBody["priorReports"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildPrompt(body: RequestBody & { slides: string; script: string; files: UploadedPrepFile[] }) {
  const fileSummary = body.files.map((file, index) => `${index + 1}. ${file.role ?? "자료"} file: ${file.name} (${file.mimeType})`).join("\n") || "첨부 파일 없음";
  return [
    "너는 Commudent의 발표 전달력 코치다.",
    "목표는 발표 자료 전체와 발표 대본 전체를 이해한 뒤, 청중이 기억해야 할 요지와 그 요지를 말로 전달하는 방법을 구체적으로 코칭하는 것이다.",
    "절대 이전 발표 예시, 데모 데이터, 일반적인 고정 문구를 답하지 않는다. 입력된 slides_text와 script_text에 직접 등장하는 내용만 근거로 삼는다.",
    "아래 발표 자료, 대본, 첨부 파일을 함께 읽고, 리허설 전에 발표자가 바로 수정하거나 의식할 수 있는 분석을 제공한다.",
    "텍스트 입력이 비어 있어도 첨부 파일이 있으면 첨부 파일 내용을 직접 읽고 분석한다.",
    "발표 자료 또는 대본 중 하나만 제공된 경우에도 제공된 근거 안에서 발표 핵심 메시지와 연습 유의사항을 생성한다.",
    "",
    "반드시 포함할 항목:",
    "1. keyMessages: 발표 자료와 대본 전체를 모두 이해한 뒤, 청중이 발표 후 기억해야 할 핵심 요지 정확히 3개. 단순 문장 복사가 아니라 전체 내용을 압축한 요지여야 한다.",
    "2. overallDeliveryGoal: 발표 전체의 전달 목표 1문장",
    "3. emphasisPoints: 발표 대본에서 핵심 요지와 관련된 실제 문장이나 표현을 인용하거나 요약한 뒤, 그 문장을 어떻게 말해야 전달이 좋아지는지 3~5개로 코칭한다. 예: \"OOO\" 사례는 중요한 근거이므로 이목을 집중시킨 뒤 천천히 말하세요.",
    "4. cautions: 리허설 전에 반드시 확인할 구체적 유의점 3~5개. 추상적인 조언 대신 입력 자료의 누락, 논리 비약, 시간 배분, 강조 위치, 청중 오해 가능성을 짚는다.",
    "5. slides: 슬라이드별 index, title, content, expectedMessage, emphasisPoints",
    "6. slides[].expectedMessage: 해당 슬라이드에서 청중이 기억해야 할 기대 메시지 1문장",
    "7. slides[].content: 입력된 발표 자료의 해당 슬라이드 내용을 보존해서 요약한다. 없는 내용을 새로 만들지 않는다.",
    "8. slides[].emphasisPoints: 해당 슬라이드와 관련된 대본 문장을 어떻게 말해야 하는지 1~3개로 코칭한다. 가능하면 대본 표현을 따옴표로 포함한다.",
    "",
    "작성 규칙:",
    "- keyMessages는 정확히 3개만 작성한다.",
    "- slides는 입력 발표 자료의 순서를 유지한다.",
    "- expectedMessage와 emphasisPoints는 서로 중복 문구를 피하고, 발표자가 실제로 말할 수 있게 구체적으로 쓴다.",
    "- 강조 포인트에는 '결론은 반복하세요', '천천히 말하세요' 같은 일반론만 쓰지 말고 반드시 입력 자료나 대본의 특정 내용과 연결한다.",
    "- 과거 발표 기록이 있으면 반복되는 전달력 문제를 cautions와 emphasisPoints에 반영한다.",
    "- 출력은 지정된 JSON schema에 맞는 JSON만 반환한다.",
    "",
    `title: ${body.title ?? ""}`,
    `time_limit_minutes: ${body.timeLimit ?? ""}`,
    `formality_level_0_informal_100_formal: ${body.formalityLevel ?? 50}`,
    `attached_files:\n${fileSummary}`,
    `slides_text: ${body.slides || "(텍스트 입력 없음. 첨부 파일이 있으면 파일 내용을 우선 분석)"}`,
    `script_text: ${body.script || "(대본 입력 없음. 발표 자료만으로 발표 흐름과 예상 발화 유의점을 분석)"}`,
    `prior_reports: ${JSON.stringify(body.priorReports ?? [])}`
  ].join("\n");
}

function prepSchema() {
  return {
    type: "object",
    properties: {
      keyMessages: { type: "array", items: { type: "string" } },
      emphasisPoints: { type: "array", items: { type: "string" } },
      cautions: { type: "array", items: { type: "string" } },
      overallDeliveryGoal: { type: "string" },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            title: { type: "string" },
            content: { type: "string" },
            expectedMessage: { type: "string" },
            emphasisPoints: { type: "array", items: { type: "string" } }
          },
          required: ["index", "title", "content", "expectedMessage", "emphasisPoints"]
        }
      }
    },
    required: ["keyMessages", "emphasisPoints", "cautions", "overallDeliveryGoal", "slides"]
  };
}

function normalizePrep(value: Partial<PrepAnalysisResponse>): PrepAnalysisResponse {
  const keyMessages = cleanList(value.keyMessages, 3, 3);
  const emphasisPoints = cleanList(value.emphasisPoints, 3, 5);
  const cautions = cleanList(value.cautions, 3, 5);
  const slides = value.slides?.map((slide, index) => {
    const expectedMessage = cleanText(slide.expectedMessage);
    const slideEmphasisPoints = cleanList(slide.emphasisPoints, 1, 3);

    return {
      index: Number(slide.index || index + 1),
      title: cleanText(slide.title) || `Slide ${index + 1}`,
      content: cleanText(slide.content) || expectedMessage,
      expectedMessage,
      emphasisPoints: slideEmphasisPoints
    };
  }).filter((slide) => slide.expectedMessage && slide.emphasisPoints.length) ?? [];

  if (keyMessages.length !== 3) throw new Error("Gemini response must include exactly 3 keyMessages.");
  if (!emphasisPoints.length) throw new Error("Gemini response must include presentation-level emphasisPoints.");
  if (!cautions.length) throw new Error("Gemini response must include concrete cautions.");
  if (!cleanText(value.overallDeliveryGoal)) throw new Error("Gemini response must include overallDeliveryGoal.");
  if (!slides.length) throw new Error("Gemini response must include slide analyses.");

  return {
    keyMessages,
    emphasisPoints,
    cautions,
    overallDeliveryGoal: cleanText(value.overallDeliveryGoal),
    slides
  };
}

function mergeWithInputSlides<T extends PrepAnalysisResponse>(analysis: T, inputSlidesText: string): T {
  const inputSlides = parseInputSlides(inputSlidesText);
  if (!inputSlides.length) return analysis;
  return {
    ...analysis,
    slides: inputSlides.map((inputSlide, index) => {
      const aiSlide = analysis.slides[index];
      return {
        index: inputSlide.index,
        title: inputSlide.title,
        content: inputSlide.content,
        expectedMessage: cleanText(aiSlide?.expectedMessage) || inputSlide.expectedMessage,
        emphasisPoints: aiSlide?.emphasisPoints?.length ? aiSlide.emphasisPoints : [inputSlide.expectedMessage]
      };
    })
  };
}

function parseInputSlides(slides: string): SlidePrepAnalysis[] {
  const cleaned = cleanInputMaterial(slides);
  if (!cleaned) return [];
  const chunks = cleaned
    .split(/\n(?=\s*(?:slide|슬라이드)?\s*\d+[\).:-]?\s+|\s*\d+[\).:-]\s*)/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const source = chunks.length > 1 ? chunks : cleaned.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);

  return source.map((chunk, index) => {
    const lines = chunk.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const first = lines[0] ?? `Slide ${index + 1}`;
    const withoutPrefix = first.replace(/^(?:slide|슬라이드)?\s*\d+[\).:-]?\s*/i, "").trim();
    const [titlePart, ...restTitle] = withoutPrefix.split(":");
    const hasColonTitle = restTitle.length > 0 && titlePart.length <= 36;
    const title = hasColonTitle ? titlePart.trim() : withoutPrefix || `Slide ${index + 1}`;
    const firstBody = hasColonTitle ? restTitle.join(":").trim() : "";
    const content = [firstBody, ...lines.slice(1)].filter(Boolean).join("\n").trim() || title;
    return {
      index: index + 1,
      title,
      content,
      expectedMessage: content.length > 120 ? `${content.slice(0, 120)}...` : content,
      emphasisPoints: []
    };
  });
}

function createResilientPrepAnalysis(body: RequestBody & { slides: string; script: string; files: UploadedPrepFile[] }, reason: string): PrepAnalysisResponse & {
  providerDetails: ProviderDetails;
} {
  const fallback = createFallbackPrepAnalysis({
    script: body.script || uploadedFileSummary(body.files),
    slides: body.slides || uploadedFileSummary(body.files),
    priorReports: body.priorReports
  });
  const normalized = normalizePrep({
    ...fallback,
    cautions: fallback.cautions,
    slides: fallback.slides.map((slide, index) => ({
      ...slide,
      index: slide.index || index + 1,
      title: slide.title || `Slide ${index + 1}`,
      content: slide.content || slide.expectedMessage,
      expectedMessage: slide.expectedMessage || fallback.keyMessages[index % fallback.keyMessages.length] || fallback.keyMessages[0],
      emphasisPoints: slide.emphasisPoints?.length
        ? slide.emphasisPoints
        : [slide.expectedMessage || fallback.keyMessages[index % fallback.keyMessages.length] || fallback.keyMessages[0]]
    }))
  });

  return mergeWithInputSlides({
    ...normalized,
    providerDetails: {
      provider: "gemini",
      model: getGeminiModel(),
      status: 200,
      message: `Resilient fallback returned after Gemini failure: ${reason}`
    }
  }, body.slides);
}

function uploadedFileSummary(files: UploadedPrepFile[]) {
  return files.map((file, index) => `${index + 1}. ${file.role ?? "자료"}: ${file.name ?? "uploaded-file"} (${file.mimeType ?? "unknown"})`).join("\n");
}

function cleanList(value: string[] | undefined, min: number, max: number) {
  const items = value?.map(cleanText).filter(Boolean).slice(0, max) ?? [];
  return items.length >= min ? items : [];
}

function cleanText(value: unknown) {
  return typeof value === "string" ? cleanInputMaterial(value) : "";
}

function cleanInputMaterial(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const officeText = extractOfficeTextFromXml(trimmed);
  if (officeText) return officeText;

  return trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\b(?:w|a|r|wp|mc|o|v):[A-Za-z0-9]+(?:=\"[^\"]*\")?/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractOfficeTextFromXml(value: string) {
  if (!/<(?:w|a):t\b/i.test(value)) return "";
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

function sanitizeUploadedFiles(files: UploadedPrepFile[] | undefined) {
  return (files ?? [])
    .filter((file) => file?.dataBase64 && file.mimeType && isSupportedInlineMime(file.mimeType))
    .slice(0, 2)
    .map((file) => ({
      role: file.role,
      name: file.name?.slice(0, 120) || "uploaded-file",
      mimeType: file.mimeType || "application/octet-stream",
      dataBase64: file.dataBase64 || ""
    }));
}

function isSupportedInlineMime(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/") || mimeType.startsWith("text/");
}

function mimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  return "application/octet-stream";
}

function extractJson(value: string) {
  const stripped = value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) return stripped.slice(start, end + 1);
  return stripped;
}

function parseGeminiPrepResponse(text: string, model: string): PrepAnalysisResponse {
  const jsonText = extractJson(text);
  const attempts = [
    jsonText,
    escapeControlCharactersInJsonStrings(jsonText),
    removeTrailingCommas(escapeControlCharactersInJsonStrings(jsonText))
  ];

  for (const attempt of attempts) {
    try {
      return normalizePrep(JSON.parse(attempt) as Partial<PrepAnalysisResponse>);
    } catch {
      // Try the next repair strategy.
    }
  }

  const partial = recoverPrepFromMalformedJson(jsonText);
  if (partial) return normalizePrep(partial);

  try {
    return normalizePrep(JSON.parse(jsonText) as Partial<PrepAnalysisResponse>);
  } catch (error) {
    throw new GeminiPrepError(error instanceof Error ? error.message : "Gemini returned invalid JSON.", { model, status: 502 });
  }
}

function escapeControlCharactersInJsonStrings(value: string) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      output += char;
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      output += char;
      continue;
    }
    if (inString && char === "\n") {
      output += "\\n";
      continue;
    }
    if (inString && char === "\r") {
      output += "\\r";
      continue;
    }
    if (inString && char === "\t") {
      output += "\\t";
      continue;
    }
    output += char;
  }

  return output;
}

function removeTrailingCommas(value: string) {
  return value.replace(/,\s*([}\]])/g, "$1");
}

function recoverPrepFromMalformedJson(value: string): Partial<PrepAnalysisResponse> | null {
  const keyMessages = extractStringArrayField(value, "keyMessages", 3);
  const emphasisPoints = extractStringArrayField(value, "emphasisPoints", 5);
  const cautions = extractStringArrayField(value, "cautions", 5);
  const overallDeliveryGoal = extractStringField(value, "overallDeliveryGoal");
  const slides = extractSlides(value);
  if (keyMessages.length < 3 || !overallDeliveryGoal || slides.length === 0) return null;
  return { keyMessages, emphasisPoints, cautions, overallDeliveryGoal, slides };
}

function extractStringField(value: string, field: string) {
  const match = value.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)(?:"\\s*[,}]|$)`));
  return cleanRecoveredText(match?.[1] ?? "");
}

function extractStringArrayField(value: string, field: string, max: number) {
  const arrayBody = value.match(new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? "";
  return [...arrayBody.matchAll(/"([\s\S]*?)(?:"\s*,|"(?=\s*$)|$)/g)]
    .map((match) => cleanRecoveredText(match[1]))
    .filter(Boolean)
    .slice(0, max);
}

function extractSlides(value: string): SlidePrepAnalysis[] {
  const slidesBody = value.match(/"slides"\s*:\s*\[([\s\S]*)\]\s*}?$/)?.[1] ?? "";
  const objectMatches = [...slidesBody.matchAll(/\{([\s\S]*?)(?=\}\s*,\s*\{|\}\s*$)/g)];
  return objectMatches.map((match, index) => {
    const objectText = match[1];
    const expectedMessage = extractStringField(objectText, "expectedMessage");
    return {
      index: Number(objectText.match(/"index"\s*:\s*(\d+)/)?.[1] ?? index + 1),
      title: extractStringField(objectText, "title") || `Slide ${index + 1}`,
      content: extractStringField(objectText, "content") || expectedMessage,
      expectedMessage,
      emphasisPoints: extractStringArrayField(objectText, "emphasisPoints", 3)
    };
  }).filter((slide) => slide.expectedMessage && slide.emphasisPoints.length);
}

function cleanRecoveredText(value: string) {
  return value
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

function getGeminiModels() {
  const configured = process.env.GEMINI_MODEL?.split(",").map((model) => model.trim()).filter(Boolean) ?? [];
  return Array.from(new Set([...configured, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"]));
}

function prepErrorResponse(message: string, details: ProviderDetails) {
  return NextResponse.json(
    {
      error: message,
      provider: details.provider,
      providerDetails: details
    },
    { status: details.status && details.status >= 400 ? details.status : 502 }
  );
}
