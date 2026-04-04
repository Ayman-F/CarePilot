export type CallState = {
  appointmentDate?: string;
  appointmentTime?: string;
  patientName?: string;
  healthCardNumber?: string;
  phoneNumber?: string;
  clinicName?: string;
  appointmentSaved?: boolean;
};

export type TranscriptEntry = {
  id: string;
  role: "assistant" | "clinic";
  content: string;
  createdAt: number;
};

type TranscriptState = {
  isActive: boolean;
  messages: TranscriptEntry[];
};

export const callState = new Map<string, CallState>();

const transcriptState = new Map<string, TranscriptState>();

const buildTranscriptId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const getTranscriptState = (callSid: string) => {
  const current =
    transcriptState.get(callSid) ?? { isActive: true, messages: [] };
  transcriptState.set(callSid, current);
  return current;
};

export const initializeTranscript = (
  callSid: string,
  initialMessage?: string,
) => {
  const state = getTranscriptState(callSid);
  state.isActive = true;
  transcriptState.set(callSid, state);

  if (initialMessage) {
    appendTranscriptMessage(callSid, "assistant", initialMessage);
  }
};

export const clearCallArtifacts = (callSid: string) => {
  callState.delete(callSid);
  transcriptState.delete(callSid);
};

export const markTranscriptActive = (callSid: string, isActive: boolean) => {
  const state = getTranscriptState(callSid);
  state.isActive = isActive;
  transcriptState.set(callSid, state);
};

export const appendTranscriptMessage = (
  callSid: string,
  role: TranscriptEntry["role"],
  content: string,
) => {
  const trimmed = content.trim();
  if (!trimmed) return;

  const state = getTranscriptState(callSid);
  const previous = state.messages[state.messages.length - 1];

  if (previous && previous.role === role && previous.content === trimmed) {
    return;
  }

  state.messages.push({
    id: buildTranscriptId(),
    role,
    content: trimmed,
    createdAt: Date.now(),
  });
  transcriptState.set(callSid, state);
};

export const getTranscriptSnapshot = (callSid: string) => {
  const state = transcriptState.get(callSid);
  return {
    isActive: state?.isActive ?? false,
    messages: state?.messages ?? [],
  };
};
