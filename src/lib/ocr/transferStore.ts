import type { OcrTransferRow, OcrTransferSource, OcrTransferStatus, OcrTransferType } from "@/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const OCR_TRANSFER_SELECT =
  "id, owner_phone, sender_phone, extracted_text, raw_text, normalized_address, source, transfer_type, provider_hint, source_device, target_device, status, created_at, updated_at, consumed_at";

export async function listOcrTransfers(params: {
  ownerPhone: string;
  status?: OcrTransferStatus | "all";
  limit?: number;
}) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("ocr_transfers")
    .select(OCR_TRANSFER_SELECT)
    .eq("owner_phone", params.ownerPhone)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 20);

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OcrTransferRow[];
}

export async function createOcrTransfer(params: {
  ownerPhone: string;
  senderPhone?: string | null;
  extractedText: string;
  rawText?: string | null;
  source: OcrTransferSource;
  transferType?: OcrTransferType;
  normalizedAddress?: string | null;
  providerHint?: string | null;
  sourceDevice?: string | null;
  targetDevice?: string | null;
}) {
  const extractedText = params.extractedText.trim();
  if (!extractedText) {
    throw new Error("전송할 주소가 비어 있습니다.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("ocr_transfers")
    .insert({
      owner_phone: params.ownerPhone,
      sender_phone: params.senderPhone ?? params.ownerPhone,
      extracted_text: extractedText,
      raw_text: params.rawText?.trim() || null,
      normalized_address: params.normalizedAddress?.trim() || extractedText,
      source: params.source,
      transfer_type: params.transferType ?? "ocr",
      provider_hint: params.providerHint?.trim() || null,
      source_device: params.sourceDevice?.trim() || null,
      target_device: params.targetDevice?.trim() || null,
      status: "pending",
    })
    .select(OCR_TRANSFER_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OcrTransferRow;
}

export async function updateOcrTransferStatus(params: {
  ownerPhone: string;
  id: string;
  status: Extract<OcrTransferStatus, "consumed" | "dismissed">;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("ocr_transfers")
    .update({
      status: params.status,
      consumed_at: params.status === "consumed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("owner_phone", params.ownerPhone)
    .select(OCR_TRANSFER_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OcrTransferRow;
}
