"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

const audioBucket = "recordings";

function extensionFor(blob: Blob) {
  if (blob.type.includes("mp4")) return "mp4";
  if (blob.type.includes("mpeg")) return "mp3";
  if (blob.type.includes("wav")) return "wav";
  return "webm";
}

export async function uploadAudioBlob(input: {
  blob: Blob;
  userId: string;
  folder: "recordings" | "voice-profiles";
}) {
  if (!isSupabaseConfigured) {
    return {
      url: URL.createObjectURL(input.blob),
      storagePath: null,
      warning: "Supabase 환경변수가 없어 브라우저 preview URL만 사용합니다."
    };
  }

  const supabase = await createSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase client를 만들 수 없습니다.");

  const path = `${input.folder}/${input.userId}/${Date.now()}.${extensionFor(input.blob)}`;
  const { error } = await supabase.storage.from(audioBucket).upload(path, input.blob, {
    contentType: input.blob.type || "audio/webm",
    upsert: false
  });

  if (error) throw new Error(`오디오 업로드 실패: ${error.message}`);

  const { data } = supabase.storage.from(audioBucket).getPublicUrl(path);
  return {
    url: data.publicUrl,
    storagePath: path,
    warning: undefined
  };
}

export async function deleteAudioPath(storagePath: string) {
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.storage.from(audioBucket).remove([storagePath]);
}
