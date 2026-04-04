import { NextResponse } from "next/server";
import { getTranscriptSnapshot } from "../../twilio/voice-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callSid = searchParams.get("callSid")?.trim() ?? "";

  if (!callSid) {
    return NextResponse.json(
      { error: "Missing callSid." },
      { status: 400 },
    );
  }

  const snapshot = getTranscriptSnapshot(callSid);
  return NextResponse.json({
    callSid,
    isActive: snapshot.isActive,
    messages: snapshot.messages,
  });
}
