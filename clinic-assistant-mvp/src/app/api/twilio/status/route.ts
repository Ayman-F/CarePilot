import { NextResponse } from "next/server";
import { markTranscriptActive } from "../voice-store";

const TERMINAL_STATUSES = new Set([
  "completed",
  "busy",
  "failed",
  "no-answer",
  "canceled",
]);

export async function POST(request: Request) {
  const form = await request.formData();
  const callSid = (form.get("CallSid") as string | null)?.trim() ?? "";
  const callStatus = (form.get("CallStatus") as string | null)?.trim() ?? "";

  if (callSid && TERMINAL_STATUSES.has(callStatus)) {
    markTranscriptActive(callSid, false);
  }

  return NextResponse.json({ success: true });
}
