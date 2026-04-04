import { NextResponse } from "next/server";

const getEnv = (key: string) => process.env[key]?.trim() ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get("text") ?? "").trim();

  if (!text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const apiKey = getEnv("ELEVENLABS_API_KEY");
  const voiceId = getEnv("ELEVENLABS_VOICE_ID");
  const modelId = getEnv("ELEVENLABS_MODEL_ID") || "eleven_flash_v2_5";

  if (!apiKey || !voiceId) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID." },
      { status: 500 },
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("ElevenLabs TTS failed", {
      status: response.status,
      body: details,
    });
    return NextResponse.json(
      { error: "TTS failed.", details },
      { status: 500 },
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
