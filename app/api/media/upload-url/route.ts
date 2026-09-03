import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestUploadUrlSchema, maxSizeForMime } from "@/lib/validation/media";
import { getUploadUrl, buildStorageKey } from "@/lib/storage/r2";
import { getScreenRole } from "@/lib/screen/access";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestUploadUrlSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { screenId, filename, mimeType, size } = parsed.data;

  if (size > maxSizeForMime(mimeType)) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  // Owner or contributor can upload — never trust that the client-supplied
  // screenId belongs to them without checking.
  const role = await getScreenRole(user.id, screenId);
  if (!role) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const mediaId = crypto.randomUUID();
  const storageKey = buildStorageKey(user.id, mediaId, filename);

  try {
    const uploadUrl = await getUploadUrl(storageKey, mimeType);
    return NextResponse.json({ mediaId, storageKey, uploadUrl });
  } catch (err) {
    console.error("[media/upload-url]", err);
    return NextResponse.json(
      { error: "Storage is not configured. Check R2 environment variables." },
      { status: 500 }
    );
  }
}
