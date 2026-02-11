import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { uploadToS3 } from "@/lib/s3";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { processRfp } from "@/lib/process-rfp";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are supported" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File is larger than 10MB limit" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = `${user.id}/${randomUUID()}-${file.name}`;

  await uploadToS3({
    key,
    contentType: file.type,
    body: buffer,
  });

  const { data: insertResult, error: insertError } = await supabase
    .from("rfps")
    .insert({
      id: randomUUID(),
      user_id: user.id,
      file_name: file.name,
      storage_key: key,
      status: "processing",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Fire-and-forget processing; avoid blocking the upload response.
  processRfp({
    rfpId: insertResult.id,
    userId: user.id,
    fileBuffer: buffer,
    fileName: file.name,
  }).catch((processingError) => {
    console.error("Processing failed for RFP", insertResult.id, processingError?.message);
  });

  return NextResponse.json({ rfp: insertResult });
}
