"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hashFile, readVideoDuration } from "@/lib/media/client-file";
import { ALLOWED_MIME_TYPES, maxSizeForMime } from "@/lib/validation/media";

interface UploadItem {
  id: string;
  filename: string;
  progress: number; // 0-100
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function UploadMedia({ screenId }: { screenId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const uploadOne = useCallback(
    async (file: File) => {
      const itemId = crypto.randomUUID();
      setItems((prev) => [
        ...prev,
        { id: itemId, filename: file.name, progress: 0, status: "uploading" },
      ]);

      const update = (patch: Partial<UploadItem>) =>
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
        );

      try {
        if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
          throw new Error("Unsupported file type");
        }
        if (file.size > maxSizeForMime(file.type)) {
          throw new Error("File is too large");
        }

        const urlRes = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenId,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error ?? "Couldn't start upload");

        await putWithProgress(urlData.uploadUrl, file, (pct) => update({ progress: pct }));

        update({ status: "processing", progress: 100 });

        const [hash, durationSeconds] = await Promise.all([
          hashFile(file),
          file.type.startsWith("video/") ? readVideoDuration(file) : Promise.resolve(null),
        ]);

        const confirmRes = await fetch("/api/media/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenId,
            mediaId: urlData.mediaId,
            storageKey: urlData.storageKey,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            hash,
            durationSeconds,
          }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmData.error ?? "Couldn't finish upload");

        update({ status: "done" });
        router.refresh();
      } catch (err) {
        update({
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [screenId, router]
  );

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach(uploadOne);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-foreground bg-muted" : "border-border bg-background"
        }`}
      >
        <p className="font-medium">Upload media</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag & drop images or MP4 videos, or tap to choose files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="truncate">{item.filename}</span>
              {item.status === "uploading" && (
                <span className="text-muted-foreground">{item.progress}%</span>
              )}
              {item.status === "processing" && (
                <span className="text-muted-foreground">Processing…</span>
              )}
              {item.status === "done" && <span className="text-green-600">Done</span>}
              {item.status === "error" && (
                <span className="text-red-600">{item.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
