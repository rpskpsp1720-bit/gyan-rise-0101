import React, { useRef, useState } from "react";
import { api, API_BASE } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Image as ImageIcon, X, Link2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Reusable cover-image picker.
 * - Lets admin EITHER paste a URL OR upload an image file.
 * - Stores final value into form's cover_url (external URL or "/api/images/{id}").
 * - Displays a thumbnail preview.
 */
export default function ImageUploadField({ label = "Cover Image", value, onChange, testid = "cover-upload" }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const previewSrc = value
    ? value.startsWith("/api/")
      ? API_BASE.replace(/\/api$/, "") + value
      : value
    : null;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Max 4 MB"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="flex items-stretch gap-2">
        <div className="flex-1 relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste image URL or upload"
            className="pl-9 rounded-md"
            data-testid={`${testid}-input`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md"
          data-testid={`${testid}-btn`}
        >
          <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
          data-testid={`${testid}-file`}
        />
      </div>
      {previewSrc ? (
        <div className="relative inline-block">
          <img src={previewSrc} alt="" className="h-24 w-40 object-cover rounded-md border border-slate-200" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-slate-200 grid place-items-center text-slate-500 hover:text-red-600"
            data-testid={`${testid}-clear`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="h-24 w-40 rounded-md border border-dashed border-slate-300 grid place-items-center text-slate-400 text-xs">
          <div className="text-center">
            <ImageIcon className="h-5 w-5 mx-auto mb-1" />
            No image
          </div>
        </div>
      )}
    </div>
  );
}
