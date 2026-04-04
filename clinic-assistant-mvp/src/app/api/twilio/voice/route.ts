import { NextResponse } from "next/server";

type CallState = {
  appointmentDate?: string;
  appointmentTime?: string;
  patientName?: string;
  healthCardNumber?: string;
};

const callState = new Map<string, CallState>();

const getEnv = (key: string) => process.env[key]?.trim() ?? "";

const buildResponse = (twiml: string) =>
  new Response(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });

const shouldUseTts = () =>
  Boolean(getEnv("ELEVENLABS_API_KEY") && getEnv("ELEVENLABS_VOICE_ID"));

const buildPrompt = (baseUrl: string, text: string) => {
  if (shouldUseTts()) {
    const ttsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(text)}`;
    return `<Play>${ttsUrl}</Play>`;
  }
  return `<Say voice="alice">${text}</Say>`;
};

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const gatherTwiml = (baseUrl: string, action: string, prompt: string) => `
<Response>
  <Gather input="speech" timeout="8" speechTimeout="auto" action="${escapeAttr(
    `${baseUrl}${action}`,
  )}" method="POST">
    ${buildPrompt(baseUrl, prompt)}
  </Gather>
</Response>
`.trim();

const redirectTwiml = (baseUrl: string, to: string) => `
<Response>
  <Redirect method="POST">${escapeAttr(`${baseUrl}${to}`)}</Redirect>
</Response>
`.trim();


const formatDateYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const parseDateFromText = async (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/\b(\d{4})[\/-](\d{2})[\/-](\d{2})\b/);
  if (direct) {
    return `${direct[1]}/${direct[2]}/${direct[3]}`;
  }
  const lowered = trimmed.toLowerCase();
  const monthMap: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const monthName = Object.keys(monthMap).find((month) =>
    lowered.includes(month),
  );
  if (monthName) {
    const dayMatch = lowered.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
    if (dayMatch) {
      const day = Number.parseInt(dayMatch[1], 10);
      if (day >= 1 && day <= 31) {
        const now = new Date();
        let year = now.getFullYear();
        const month = monthMap[monthName];
        const candidate = new Date(year, month - 1, day);
        if (candidate.getTime() < now.getTime()) {
          year += 1;
        }
        return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(
          2,
          "0",
        )}`;
      }
    }
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateYYYYMMDD(parsed);
  }
  return null;
};

const parseTimeFromText = (text: string) => {
  const lowered = text.toLowerCase();
  const explicitMeridiem = /\bp\.?m\.?\b/.test(lowered)
    ? "PM"
    : /\ba\.?m\.?\b/.test(lowered)
      ? "AM"
      : "";

  const match = lowered.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (match) {
    let hour = Number.parseInt(match[1], 10);
    const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
    let meridiem = match[3] ? match[3].toUpperCase() : explicitMeridiem;
    if (!meridiem) {
      if (hour === 0) {
        hour = 12;
        meridiem = "AM";
      } else if (hour === 12) {
        meridiem = "PM";
      } else if (hour > 12) {
        hour -= 12;
        meridiem = "PM";
      } else {
        meridiem = "AM";
      }
    } else if (hour > 12) {
      hour -= 12;
    }
    return `${hour}:${String(minutes).padStart(2, "0")} ${meridiem}`;
  }

  const words = lowered.replace(/[^a-z\s]/g, " ").split(/\s+/);
  const wordToNumber: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };
  const minuteMap: Record<string, number> = {
    fifteen: 15,
    thirty: 30,
    forty: 40,
    "forty-five": 45,
    fortyfive: 45,
  };
  const ampm = lowered.includes("pm") ? "PM" : lowered.includes("am") ? "AM" : "";
  const hourWord = words.find((word) => wordToNumber[word] !== undefined);
  if (hourWord && ampm) {
    const hour = wordToNumber[hourWord];
    const minuteWord = words.find((word) => minuteMap[word] !== undefined);
    const minutes = minuteWord ? minuteMap[minuteWord] : 0;
    return `${hour}:${String(minutes).padStart(2, "0")} ${ampm}`;
  }
  return null;
};

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "1";
  const retry = searchParams.get("retry") ?? "0";
  const form = await request.formData();
  const speech = (form.get("SpeechResult") as string | null)?.trim() ?? "";
  const callSid = (form.get("CallSid") as string | null)?.trim() ?? "";
  const baseUrl = getEnv("PUBLIC_BASE_URL") || new URL(request.url).origin;

  if (step === "1") {
    if (callSid) {
      callState.set(callSid, {
        patientName: searchParams.get("patientName") ?? undefined,
        healthCardNumber: searchParams.get("healthCardNumber") ?? undefined,
      });
    }
    const prompt =
      "Hello, I'm calling to book a medical appointment for a patient. Do you have an appointment available for today or tomorrow?";
    return buildResponse(
      gatherTwiml(baseUrl, "/api/twilio/voice?step=2", prompt),
    );
  }

  if (step === "2") {
    const text = (speech || "").toLowerCase();
    const state = callSid ? callState.get(callSid) ?? {} : {};
    const today = formatDateYYYYMMDD(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = formatDateYYYYMMDD(tomorrowDate);

    if (!text) {
      if (retry === "0") {
        const prompt =
          "Sorry—please say 'today', 'tomorrow', or 'no'. Do you have availability today or tomorrow?";
        return buildResponse(
          gatherTwiml(baseUrl, "/api/twilio/voice?step=2&retry=1", prompt),
        );
      }
      return buildResponse(
        `<Response>${buildPrompt(
          baseUrl,
          "Thanks for your time. Goodbye.",
        )}<Hangup/></Response>`,
      );
    }

    if (text.includes("today")) {
      state.appointmentDate = today;
      if (callSid) callState.set(callSid, state);
      return buildResponse(
        redirectTwiml(baseUrl, "/api/twilio/voice?step=4"),
      );
    }

    if (text.includes("tomorrow")) {
      state.appointmentDate = tomorrow;
      if (callSid) callState.set(callSid, state);
      return buildResponse(
        redirectTwiml(baseUrl, "/api/twilio/voice?step=4"),
      );
    }

    if (
      text.includes("no") ||
      text.includes("nope") ||
      text.includes("none") ||
      text.includes("not available")
    ) {
      if (callSid) callState.set(callSid, state);
      const prompt = "No problem. What is the earliest available day?";
      return buildResponse(
        gatherTwiml(baseUrl, "/api/twilio/voice?step=3", prompt),
      );
    }

    if (retry === "0") {
      const prompt =
        "Sorry—please say 'today', 'tomorrow', or 'no'. Do you have availability today or tomorrow?";
      return buildResponse(
        gatherTwiml(baseUrl, "/api/twilio/voice?step=2&retry=1", prompt),
      );
    }

    return buildResponse(
      `<Response>${buildPrompt(
        baseUrl,
        "Thanks for your time. Goodbye.",
      )}<Hangup/></Response>`,
    );
  }

  if (step === "3") {
    const parsedDate = await parseDateFromText(speech);
    const state = callSid ? callState.get(callSid) ?? {} : {};
    if (parsedDate) {
      state.appointmentDate = parsedDate;
      if (callSid) callState.set(callSid, state);
      return buildResponse(
        redirectTwiml(baseUrl, "/api/twilio/voice?step=4"),
      );
    }

    if (retry === "0") {
      const prompt = "Please say the date, for example January 25.";
      return buildResponse(
        gatherTwiml(baseUrl, "/api/twilio/voice?step=3&retry=1", prompt),
      );
    }

    return buildResponse(
      `<Response>${buildPrompt(
        baseUrl,
        "Thanks for your time. Goodbye.",
      )}<Hangup/></Response>`,
    );
  }

  if (step === "4") {
    const parsedTime = parseTimeFromText(speech);
    const state = callSid ? callState.get(callSid) ?? {} : {};

    if (parsedTime) {
      state.appointmentTime = parsedTime;
      if (callSid) callState.set(callSid, state);
      if (state.appointmentDate && state.appointmentTime) {
        const confirmUrl = `${baseUrl}/api/appointment/confirm`;
        fetch(confirmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: state.appointmentDate,
            time: state.appointmentTime,
            patientName: state.patientName || "Unknown",
            healthCardNumber: state.healthCardNumber || "not provided",
          }),
        }).catch(() => {});
      }
      return buildResponse(
        redirectTwiml(baseUrl, "/api/twilio/voice?step=5"),
      );
    }

    if (retry === "0") {
      const prompt =
        "Thanks. What time is the appointment? Please say AM or PM.";
      return buildResponse(
        gatherTwiml(baseUrl, "/api/twilio/voice?step=4&retry=1", prompt),
      );
    }

    return buildResponse(
      `<Response>${buildPrompt(
        baseUrl,
        "Thanks for your time. Goodbye.",
      )}<Hangup/></Response>`,
    );
  }

  if (step === "5") {
    const state = callSid ? callState.get(callSid) ?? {} : {};
    const name = state.patientName || "the patient";
    const healthCard = state.healthCardNumber || "not provided";

    const closing = `
<Response>
  ${buildPrompt(
    baseUrl,
    `Perfect. Confirming ${state.appointmentDate ?? "the appointment"} at ${
      state.appointmentTime ?? "the scheduled time"
    }. Patient name is ${name}. Health card number is ${healthCard}. Thank you, goodbye.`,
  )}
  <Hangup/>
</Response>
`.trim();
    return buildResponse(closing);
  }

  return buildResponse(
    `<Response>${buildPrompt(
      baseUrl,
      "Thanks for your time. Goodbye.",
    )}<Hangup/></Response>`,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "1";
  const baseUrl = getEnv("PUBLIC_BASE_URL") || new URL(request.url).origin;
  if (step === "1") {
    return buildResponse(
      gatherTwiml(
        baseUrl,
        "/api/twilio/voice?step=2",
        "Hello, I'm calling to book a medical appointment for a patient. Do you have an appointment available for today or tomorrow?",
      ),
    );
  }
  return buildResponse(
    `<Response>${buildPrompt(
      baseUrl,
      "Preview only. Use POST for full call flow.",
    )}</Response>`,
  );
}
