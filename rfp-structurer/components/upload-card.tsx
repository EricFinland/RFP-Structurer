"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function UploadCard() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected && selected.type !== "application/pdf") {
      setMessage("Only PDF files are supported");
      return;
    }
    setMessage(null);
    setFile(selected || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setMessage(null);

    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body });
    const json = await res.json();

    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || "Upload failed");
      return;
    }

    // Redirect to the RFP detail page where polling will show progress
    if (json.rfp?.id) {
      router.push(`/rfps/${json.rfp.id}`);
    } else {
      setMessage("Upload started. Refresh to see status updates.");
      setFile(null);
    }
  };

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Upload PDF</h3>
      <p className="mt-1 text-sm text-slate-600">Max 10MB. We do not store raw text logs.</p>
      <div className="mt-4 space-y-3">
        <input
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
        />
        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busy ? "Uploading..." : "Start extraction"}
        </button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    </div>
  );
}
