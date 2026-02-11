"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function RfpPolling({ rfpId, status }: { rfpId: string; status: string }) {
  const router = useRouter();

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfps/${rfpId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "processing") {
        router.refresh();
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [rfpId, router]);

  useEffect(() => {
    if (status !== "processing") return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [status, poll]);

  if (status !== "processing") return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-6 py-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      <div>
        <p className="text-sm font-semibold text-blue-900">Processing your RFP...</p>
        <p className="text-sm text-blue-700">
          Extracting requirements, evaluation criteria, and compliance data. This page will update automatically.
        </p>
      </div>
    </div>
  );
}
