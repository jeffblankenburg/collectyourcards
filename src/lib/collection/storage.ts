"use client";

import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";

const BUCKET = "card-photos";

// Direct browser -> Storage upload (bypasses the 4.5MB function body limit).
// Path: <collector_id>/<user_card_id>/<uuid>.<ext> — the first segment drives the
// per-user object RLS policy. Returns the public URL stored in user_card_photo.
export async function uploadCardPhoto(collectorId: number, userCardId: number, file: File): Promise<string> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${collectorId}/${userCardId}/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Remove the storage object for a photo URL. No-ops for legacy (Azure) URLs.
export async function removeCardPhotoObject(url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  const path = url.slice(idx + marker.length);
  await createClient().storage.from(BUCKET).remove([path]);
}
