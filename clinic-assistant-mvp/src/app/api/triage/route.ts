import { NextResponse } from "next/server";

type GravityLevel = "LOW" | "MEDIUM" | "HIGH";

const BODY_REGIONS = [
  "head",
  "neck",
  "chest",
  "left_arm",
  "right_arm",
  "abdomen",
  "pelvis",
  "left_leg",
  "right_leg",
] as const;

type BodyRegion = (typeof BODY_REGIONS)[number];

type BodyHeatmapEntry = {
  region: BodyRegion;
  severity: GravityLevel;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type TriageRequest = {
  location?: string;
  messages?: ChatMessage[];
};

type TriageFollowUpResponse = {
  status: "needs_more_info";
  assistant_message: string;
};

type TriageFinalResponse = {
  status: "final";
  assistant_message: string;
  gravity_level: GravityLevel;
  recommendations: string[];
  summary_paragraph: string;
  wait_care_tips: string[];
  emergency_warning: boolean;
  body_heatmap?: BodyHeatmapEntry[];
};

type TriageResponse = TriageFollowUpResponse | TriageFinalResponse;

const MAX_ASSISTANT_FOLLOW_UPS = 4;
const DEFAULT_MODEL = "claude-haiku-4-5";

const getEnv = (key: string) => process.env[key]?.trim() ?? "";

const sanitizeMessages = (messages: TriageRequest["messages"]): ChatMessage[] =>
  (messages ?? [])
    .filter(
      (message): message is ChatMessage =>
        Boolean(
          message &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim(),
        ),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }))
    .slice(-10);

const extractTextBlocks = (
  content: Array<{ type?: string; text?: string }> | undefined,
) =>
  (content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .join("\n")
    .trim();

const stripCodeFence = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
};

const parseModelJson = (value: string) => {
  const cleaned = stripCodeFence(value);
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      return null;
    }
  }
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && item.trim().length > 0);

const isGravityLevel = (value: unknown): value is GravityLevel =>
  value === "LOW" || value === "MEDIUM" || value === "HIGH";

const sanitizeBodyHeatmap = (value: unknown): BodyHeatmapEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const uniqueEntries = new Map<BodyRegion, BodyHeatmapEntry>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const region = candidate.region;
    const severity = candidate.severity;

    if (
      typeof region !== "string" ||
      !BODY_REGIONS.includes(region as BodyRegion) ||
      !isGravityLevel(severity)
    ) {
      continue;
    }

    uniqueEntries.set(region as BodyRegion, {
      region: region as BodyRegion,
      severity,
    });
  }

  const sanitized = [...uniqueEntries.values()];
  return sanitized.length > 0 ? sanitized : undefined;
};

const validateResponse = (value: unknown): TriageResponse | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const status = candidate.status;
  const assistantMessage = candidate.assistant_message;

  if (
    status === "needs_more_info" &&
    typeof assistantMessage === "string" &&
    assistantMessage.trim()
  ) {
    return {
      status,
      assistant_message: assistantMessage.trim(),
    };
  }

  if (
    status === "final" &&
    typeof assistantMessage === "string" &&
    assistantMessage.trim() &&
    isGravityLevel(candidate.gravity_level) &&
    isStringArray(candidate.recommendations) &&
    typeof candidate.summary_paragraph === "string" &&
    candidate.summary_paragraph.trim() &&
    isStringArray(candidate.wait_care_tips) &&
    typeof candidate.emergency_warning === "boolean"
  ) {
    const bodyHeatmap = sanitizeBodyHeatmap(candidate.body_heatmap);

    return {
      status,
      assistant_message: assistantMessage.trim(),
      gravity_level: candidate.gravity_level,
      recommendations: candidate.recommendations.map((item) => item.trim()),
      summary_paragraph: candidate.summary_paragraph.trim(),
      wait_care_tips: candidate.wait_care_tips.map((item) => item.trim()),
      emergency_warning: candidate.emergency_warning,
      ...(bodyHeatmap ? { body_heatmap: bodyHeatmap } : {}),
    };
  }

  return null;
};

const buildSystemPrompt = (location: string, forceFinal: boolean) => `
You are a careful clinic triage assistant inside a healthcare booking app.
Your job is to run a short triage conversation, not to provide a diagnosis.

Goals:
- Ask only short, necessary follow-up questions.
- Decide urgency as LOW, MEDIUM, or HIGH.
- If symptoms sound severe or unsafe, clearly recommend emergency care.
- Give practical self-care or comfort guidance while waiting for an appointment.
- Keep your language calm, brief, and plain.
- Avoid diagnosis claims and avoid pretending certainty.
- When there is a clearly affected body area, include it in body_heatmap using only the allowed region keys.
- If the affected area is unclear, omit body_heatmap entirely.

Known location: ${location || "Unknown"}.
${forceFinal ? "You must return a final triage result now. Do not ask another question." : "If you already have enough information, return a final triage result. Otherwise ask one short follow-up question."}

Return JSON only, with no markdown fences, no extra text, and no commentary outside JSON.

Allowed JSON shapes:

For a follow-up question:
{
  "status": "needs_more_info",
  "assistant_message": "one short follow-up question"
}

For a final result:
{
  "status": "final",
  "assistant_message": "brief conversational response summarizing urgency and next steps",
  "gravity_level": "LOW" | "MEDIUM" | "HIGH",
  "recommendations": ["short recommendation", "short recommendation"],
  "summary_paragraph": "2-3 sentence summary of the situation and next step",
  "wait_care_tips": ["short tip", "short tip"],
  "emergency_warning": true | false,
  "body_heatmap": [
    {
      "region": "head" | "neck" | "chest" | "left_arm" | "right_arm" | "abdomen" | "pelvis" | "left_leg" | "right_leg",
      "severity": "LOW" | "MEDIUM" | "HIGH"
    }
  ]
}
`.trim();

export async function POST(request: Request) {
  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Claude triage is unavailable. Missing ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as TriageRequest;
    const location = (body.location ?? "").trim();
    const messages = sanitizeMessages(body.messages);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Please share your symptoms to start triage." },
        { status: 400 },
      );
    }

    const assistantTurns = messages.filter(
      (message) => message.role === "assistant",
    ).length;
    const forceFinal = assistantTurns >= MAX_ASSISTANT_FOLLOW_UPS;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 700,
        temperature: 0.3,
        system: buildSystemPrompt(location, forceFinal),
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!anthropicResponse.ok) {
      const details = await anthropicResponse.text();
      console.error("Anthropic triage failed", {
        status: anthropicResponse.status,
        body: details,
      });
      return NextResponse.json(
        {
          error: "Claude triage is unavailable right now.",
          details,
        },
        { status: anthropicResponse.status },
      );
    }

    const data = (await anthropicResponse.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const rawText = extractTextBlocks(data.content);
    const parsed = parseModelJson(rawText);
    const validated = validateResponse(parsed);

    if (!validated) {
      console.error("Anthropic triage returned invalid JSON", { rawText });
      return NextResponse.json(
        {
          error: "Claude triage is unavailable right now.",
          details: "Claude returned an unexpected response shape.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(validated);
  } catch (error) {
    console.error("Claude triage route crashed", error);
    return NextResponse.json(
      {
        error: "Claude triage is unavailable right now.",
        details: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 503 },
    );
  }
}
