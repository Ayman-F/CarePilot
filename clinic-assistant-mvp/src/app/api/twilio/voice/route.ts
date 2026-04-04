import { saveAppointment } from "../../appointment/confirm/route";
import {
  appendTranscriptMessage,
  callState,
  markTranscriptActive,
  type CallState,
} from "../voice-store";

const getEnv = (key: string) => process.env[key]?.trim() ?? "";

const buildResponse = (twiml: string) =>
  new Response(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });

const shouldUseTts = () =>
  // Keep Twilio's built-in voice as the safe default.
  getEnv("ENABLE_ELEVENLABS_TTS") === "true" &&
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
  <Gather input="speech" timeout="4" speechTimeout="2" action="${escapeAttr(
    `${baseUrl}${action}`,
  )}" method="POST">
    ${buildPrompt(baseUrl, prompt)}
  </Gather>
</Response>
`.trim();

const delayedGatherTwiml = (
  baseUrl: string,
  action: string,
  prompt: string,
  pauseLengthSeconds: number,
) => `
<Response>
  <Pause length="${pauseLengthSeconds}"/>
  <Gather input="speech" timeout="4" speechTimeout="2" action="${escapeAttr(
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

const buildPromptResponse = (
  baseUrl: string,
  text: string,
  callSid: string,
) => {
  if (callSid) {
    appendTranscriptMessage(callSid, "assistant", text);
  }
  return buildPrompt(baseUrl, text);
};

const gatherPromptResponse = (
  baseUrl: string,
  action: string,
  prompt: string,
  callSid: string,
) => {
  if (callSid) {
    appendTranscriptMessage(callSid, "assistant", prompt);
  }
  return gatherTwiml(baseUrl, action, prompt);
};

const delayedGatherPromptResponse = (
  baseUrl: string,
  action: string,
  prompt: string,
  pauseLengthSeconds: number,
  callSid: string,
) => {
  if (callSid) {
    appendTranscriptMessage(callSid, "assistant", prompt);
  }
  return delayedGatherTwiml(baseUrl, action, prompt, pauseLengthSeconds);
};

const redirectPromptResponse = (
  baseUrl: string,
  prompt: string,
  to: string,
  callSid: string,
) => {
  if (callSid) {
    appendTranscriptMessage(callSid, "assistant", prompt);
  }
  return `
<Response>
  ${buildPrompt(baseUrl, prompt)}
  <Redirect method="POST">${escapeAttr(`${baseUrl}${to}`)}</Redirect>
</Response>
`.trim();
};

const speakCharacters = (value: string) =>
  value
    .trim()
    .split("")
    .map((char) => {
      if (char === " ") return "pause";
      if (char === "-") return "dash";
      return char;
    })
    .join(", ");


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

const saveAppointmentFromState = async (
  state: CallState,
  callSid: string,
) => {
  if (!state.appointmentDate || !state.appointmentTime) {
    return false;
  }

  const payload = {
    date: state.appointmentDate,
    time: state.appointmentTime,
    patientName: state.patientName?.trim() || "Unknown",
    healthCardNumber: state.healthCardNumber?.trim() || "not provided",
    phoneNumber: state.phoneNumber?.trim() || "not provided",
    clinicName: state.clinicName?.trim() || "Selected clinic",
  };

  const result = await saveAppointment(payload);
  if (!result.success) {
    console.error("Appointment save failed during Twilio voice flow", {
      callSid,
      error: result.error,
      payload,
    });
    return false;
  }

  state.appointmentSaved = true;
  return true;
};

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "1";
  const retry = searchParams.get("retry") ?? "0";
  const form = await request.formData();
  const speech = (form.get("SpeechResult") as string | null)?.trim() ?? "";
  const callSid = (form.get("CallSid") as string | null)?.trim() ?? "";
  const baseUrl = getEnv("PUBLIC_BASE_URL") || new URL(request.url).origin;

  if (callSid && speech) {
    appendTranscriptMessage(callSid, "clinic", speech);
  }

  if (step === "1") {
    if (callSid) {
      callState.set(callSid, {
        patientName: searchParams.get("patientName") ?? undefined,
        healthCardNumber: searchParams.get("healthCardNumber") ?? undefined,
        phoneNumber: searchParams.get("phoneNumber") ?? undefined,
        clinicName: searchParams.get("clinicName") ?? undefined,
      });
      markTranscriptActive(callSid, true);
    }
    const prompt =
      "Hello, I'm calling to book a medical appointment for a patient. Do you have an appointment available for today or tomorrow?";
    return buildResponse(
      delayedGatherPromptResponse(
        baseUrl,
        "/api/twilio/voice?step=2",
        prompt,
        3,
        callSid,
      ),
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
          gatherPromptResponse(
            baseUrl,
            "/api/twilio/voice?step=2&retry=1",
            prompt,
            callSid,
          ),
        );
      }
      if (callSid) markTranscriptActive(callSid, false);
      return buildResponse(
        `<Response>${buildPromptResponse(
          baseUrl,
          "Thanks for your time. Goodbye.",
          callSid,
        )}<Hangup/></Response>`,
      );
    }

    if (text.includes("today")) {
      state.appointmentDate = today;
      if (callSid) callState.set(callSid, state);
      return buildResponse(
        redirectPromptResponse(
          baseUrl,
          "Thanks. What time is the available slot? Please give the time and specify if its AM or PM.",
          "/api/twilio/voice?step=4",
          callSid,
        ),
      );
    }

    if (text.includes("tomorrow")) {
      state.appointmentDate = tomorrow;
      if (callSid) callState.set(callSid, state);
      return buildResponse(
        redirectPromptResponse(
          baseUrl,
          "Thanks. What time is the available slot? Please give the time and specify if its AM or PM.",
          "/api/twilio/voice?step=4",
          callSid,
        ),
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
        gatherPromptResponse(baseUrl, "/api/twilio/voice?step=3", prompt, callSid),
      );
    }

    if (retry === "0") {
      const prompt =
        "Sorry—please say 'today', 'tomorrow', or 'no'. Do you have availability today or tomorrow?";
      return buildResponse(
        gatherPromptResponse(
          baseUrl,
          "/api/twilio/voice?step=2&retry=1",
          prompt,
          callSid,
        ),
      );
    }

    if (callSid) markTranscriptActive(callSid, false);
    return buildResponse(
      `<Response>${buildPromptResponse(
        baseUrl,
        "Thanks for your time. Goodbye.",
        callSid,
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
        redirectPromptResponse(
          baseUrl,
          "Thanks. What time is the available slot? Please give the time and specify if its AM or PM.",
          "/api/twilio/voice?step=4",
          callSid,
        ),
      );
    }

    if (retry === "0") {
      const prompt = "Please say the date, for example January 25.";
      return buildResponse(
        gatherPromptResponse(
          baseUrl,
          "/api/twilio/voice?step=3&retry=1",
          prompt,
          callSid,
        ),
      );
    }

    if (callSid) markTranscriptActive(callSid, false);
    return buildResponse(
      `<Response>${buildPromptResponse(
        baseUrl,
        "Thanks for your time. Goodbye.",
        callSid,
      )}<Hangup/></Response>`,
    );
  }

  if (step === "4") {
    const parsedTime = parseTimeFromText(speech);
    const state = callSid ? callState.get(callSid) ?? {} : {};

    if (parsedTime) {
      state.appointmentTime = parsedTime;
      if (callSid) callState.set(callSid, state);
      if (state.appointmentDate && state.appointmentTime && !state.appointmentSaved) {
        await saveAppointmentFromState(state, callSid);
        if (callSid) callState.set(callSid, state);
      }
      return buildResponse(
        redirectPromptResponse(
          baseUrl,
          `Perfect. Confirming ${
            state.appointmentDate ?? "the appointment"
          } at ${
            state.appointmentTime ?? "the scheduled time"
          }. Patient name is ${
            state.patientName || "the patient"
          }. I will repeat that once more. Patient name is ${
            state.patientName || "the patient"
          }. Health card number is ${
            state.healthCardNumber || "not provided"
          }. I will repeat that once more. Health card number is ${
            state.healthCardNumber || "not provided"
          }. Has that been noted? Please say yes or no.`,
          "/api/twilio/voice?step=5",
          callSid,
        ),
      );
    }

    if (retry === "0") {
      const prompt =
        "Thanks. What time is the available slot? Please give the time and specify if its AM or PM.";
      return buildResponse(
        gatherPromptResponse(
          baseUrl,
          "/api/twilio/voice?step=4&retry=1",
          prompt,
          callSid,
        ),
      );
    }

    if (callSid) markTranscriptActive(callSid, false);
    return buildResponse(
      `<Response>${buildPromptResponse(
        baseUrl,
        "Thanks for your time. Goodbye.",
        callSid,
      )}<Hangup/></Response>`,
    );
  }

  if (step === "5") {
    const state = callSid ? callState.get(callSid) ?? {} : {};
    const name = state.patientName || "the patient";
    const healthCard = state.healthCardNumber || "not provided";
    const spokenName = name === "the patient" ? name : speakCharacters(name);
    const spokenHealthCard =
      healthCard === "not provided" ? healthCard : speakCharacters(healthCard);
    const confirmationPrompt = `Perfect. Confirming ${
      state.appointmentDate ?? "the appointment"
    } at ${
      state.appointmentTime ?? "the scheduled time"
    }. Patient name is ${spokenName}. I will repeat that once more. Patient name is ${spokenName}. Health card number is ${spokenHealthCard}. I will repeat that once more. Health card number is ${spokenHealthCard}. Has that been noted? Please say yes or no.`;

    return buildResponse(
      gatherPromptResponse(baseUrl, "/api/twilio/voice?step=6", confirmationPrompt, callSid),
    );
  }

  if (step === "6") {
    const text = speech.toLowerCase();

    if (
      text.includes("yes") ||
      text.includes("noted") ||
      text.includes("got it") ||
      text.includes("confirmed")
    ) {
      const state = callSid ? callState.get(callSid) ?? {} : {};
      if (!state.appointmentSaved) {
        await saveAppointmentFromState(state, callSid);
        if (callSid) callState.set(callSid, state);
      }
      if (callSid) markTranscriptActive(callSid, false);
      return buildResponse(
        `<Response>${buildPromptResponse(
          baseUrl,
          "Thank you. Goodbye.",
          callSid,
        )}<Hangup/></Response>`,
      );
    }

    if (
      text.includes("no") ||
      text.includes("repeat") ||
      text.includes("again")
    ) {
      return buildResponse(
        redirectPromptResponse(
          baseUrl,
          `Perfect. Confirming ${
            callSid ? (callState.get(callSid)?.appointmentDate ?? "the appointment") : "the appointment"
          } at ${
            callSid ? (callState.get(callSid)?.appointmentTime ?? "the scheduled time") : "the scheduled time"
          }. Patient name is ${
            callSid ? (callState.get(callSid)?.patientName || "the patient") : "the patient"
          }. I will repeat that once more. Patient name is ${
            callSid ? (callState.get(callSid)?.patientName || "the patient") : "the patient"
          }. Health card number is ${
            callSid ? (callState.get(callSid)?.healthCardNumber || "not provided") : "not provided"
          }. I will repeat that once more. Health card number is ${
            callSid ? (callState.get(callSid)?.healthCardNumber || "not provided") : "not provided"
          }. Has that been noted? Please say yes or no.`,
          "/api/twilio/voice?step=5",
          callSid,
        ),
      );
    }

    if (retry === "0") {
      return buildResponse(
        gatherPromptResponse(
          baseUrl,
          "/api/twilio/voice?step=6&retry=1",
          "Has that been noted? Please say yes or no.",
          callSid,
        ),
      );
    }

    if (callSid) markTranscriptActive(callSid, false);
    return buildResponse(
      `<Response>${buildPromptResponse(
        baseUrl,
        "Thank you. Goodbye.",
        callSid,
      )}<Hangup/></Response>`,
    );
  }

  if (callSid) markTranscriptActive(callSid, false);
  return buildResponse(
    `<Response>${buildPromptResponse(
      baseUrl,
      "Thanks for your time. Goodbye.",
      callSid,
    )}<Hangup/></Response>`,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "1";
  const baseUrl = getEnv("PUBLIC_BASE_URL") || new URL(request.url).origin;
  if (step === "1") {
    return buildResponse(
      delayedGatherTwiml(
        baseUrl,
        "/api/twilio/voice?step=2",
        "Hello, I'm calling to book a medical appointment for a patient. Do you have an appointment available for today or tomorrow?",
        3,
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
