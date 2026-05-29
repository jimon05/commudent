"use client";

const preferredMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/wav"
];

export function getSupportedAudioMimeType() {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) return "";
  return preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function createAudioRecorder(stream: MediaStream) {
  const mimeType = getSupportedAudioMimeType();
  if (!mimeType) return new MediaRecorder(stream);
  return new MediaRecorder(stream, { mimeType });
}

export function mediaRecorderUnavailableMessage() {
  return "이 브라우저에서는 녹음을 지원하지 않습니다. iOS Safari는 최신 버전으로 업데이트하거나 Chrome/Edge에서 다시 시도해 주세요.";
}
