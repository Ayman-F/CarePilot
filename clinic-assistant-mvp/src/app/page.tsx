"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { BodyHeatmap } from "./components/body-heatmap";
import type { BodyHeatmapEntry } from "./components/body-heatmap";
import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { RefObject } from "react";
import type { FormEvent } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };

type TriageResult = {
  gravity_level: "LOW" | "MEDIUM" | "HIGH";
  recommendations: string[];
  wait_care_tips: string[];
  emergency_warning: boolean;
  summary_paragraph: string;
  assistant_message: string;
  body_heatmap?: BodyHeatmapEntry[];
};

type TriageResponse =
  | {
      status: "needs_more_info";
      assistant_message: string;
    }
  | ({
      status: "final";
    } & TriageResult);

type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lon: number;
  distance_km: number;
};

type LiveCallMessage = {
  id: string;
  role: "assistant" | "clinic";
  content: string;
  createdAt: number;
};

type ActiveStep = 1 | 2 | 3 | 4;

const FALLBACK_CLINICS: Clinic[] = [
  {
    id: "fallback-1",
    name: "Montreal Walk-In Clinic",
    address: "123 Rue Sainte-Catherine, Montreal, QC",
    phone: "Phone not listed (call main line)",
    lat: 45.5019,
    lon: -73.5674,
    distance_km: 0,
  },
  {
    id: "fallback-2",
    name: "Plateau Community Clinic",
    address: "456 Avenue du Mont-Royal, Montreal, QC",
    phone: "Phone not listed (call main line)",
    lat: 45.5245,
    lon: -73.5832,
    distance_km: 0,
  },
  {
    id: "fallback-3",
    name: "Downtown Medical Clinic",
    address: "789 Boulevard Rene-Levesque, Montreal, QC",
    phone: "Phone not listed (call main line)",
    lat: 45.4996,
    lon: -73.5709,
    distance_km: 0,
  },
];

const SUGGESTED_SYMPTOM_PROMPTS = [
  "I have had a fever and sore throat since yesterday.",
  "I have sharp pain in my lower stomach.",
  "My knee has been swollen and painful after a fall.",
];

export default function Home() {
  const [symptoms, setSymptoms] = useState("");
  const [location, setLocation] = useState("");
  const [patientName, setPatientName] = useState("");
  const [healthCardNumber, setHealthCardNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isClinicsLoading, setIsClinicsLoading] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [callingClinicId, setCallingClinicId] = useState<string | null>(null);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [liveCallMessages, setLiveCallMessages] = useState<LiveCallMessage[]>([]);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [appointment, setAppointment] = useState<{
    date: string;
    time: string;
    patientName: string;
    clinicName: string;
    smsStatus: "sent" | "failed";
    smsError?: string;
  } | null>(null);
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [uiStatus, setUiStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const [activeStep, setActiveStep] = useState<ActiveStep>(1);
  const [viewState, setViewState] = useState<
    "form" | "clinics" | "calling"
  >("form");

  const patientSectionRef = useRef<HTMLDivElement | null>(null);
  const symptomsSectionRef = useRef<HTMLFormElement | null>(null);
  const clinicsSectionRef = useRef<HTMLDivElement | null>(null);
  const patientNameInputRef = useRef<HTMLInputElement | null>(null);
  const symptomsInputRef = useRef<HTMLTextAreaElement | null>(null);
  const liveCallScrollRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const disclaimer =
    "This is not medical advice. If this is an emergency, call 911.";

  const newMessage = (role: Message["role"], content: string): Message => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    role,
    content,
  });

  const appendAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, newMessage("assistant", content)]);
  };

  const resetStepThreeAndFour = () => {
    setClinics([]);
    setClinicError(null);
    setLocationWarning(null);
    setAppointment(null);
    setIsWaitingConfirmation(false);
    setCallingClinicId(null);
    setActiveCallSid(null);
    setLiveCallMessages([]);
    setIsTranscriptLoading(false);
    setViewState("form");
  };

  const resetFromStepOneChange = () => {
    setMessages([]);
    setTriage(null);
    setSymptoms("");
    setIsEmergency(false);
    setUiStatus({ type: "idle" });
    resetStepThreeAndFour();
    setActiveStep(1);
  };

  const updateStepOneField = (
    currentValue: string,
    nextValue: string,
    setter: Dispatch<SetStateAction<string>>,
  ) => {
    if (currentValue === nextValue) return;

    const hasLaterState =
      activeStep > 1 ||
      messages.length > 0 ||
      triage !== null ||
      clinics.length > 0 ||
      appointment !== null ||
      isWaitingConfirmation;

    if (hasLaterState) {
      resetFromStepOneChange();
    }

    setter(nextValue);
  };

  const updateSymptomsDraft = (nextValue: string) => {
    if (symptoms === nextValue) return;

    const hasLaterState =
      clinics.length > 0 || appointment !== null || isWaitingConfirmation;

    if (hasLaterState) {
      resetStepThreeAndFour();
      setActiveStep(2);
    }

    setSymptoms(nextValue);
  };

  const fetchClinics = async (inputLocation: string) => {
    setClinicError(null);
    setClinics([]);
    setIsClinicsLoading(true);
    setUiStatus({ type: "loading", message: "Fetching closest clinics..." });
    if (!inputLocation.trim()) {
      setLocationWarning("Enter a postal code or address.");
      setClinics(FALLBACK_CLINICS);
      setIsClinicsLoading(false);
      setUiStatus({ type: "error", message: "Enter a postal code or address." });
      return;
    }
    setLocationWarning(null);
    try {
      const response = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: inputLocation.trim() }),
      });

      if (!response.ok) {
        setClinicError(
          "We couldn't fetch clinics right now. Showing fallback options.",
        );
        setClinics(FALLBACK_CLINICS);
        setUiStatus({
          type: "error",
          message: "We couldn't fetch clinics. Showing fallback options.",
        });
        return;
      }

      const data = (await response.json()) as { clinics?: Clinic[] };
      if (!data.clinics || data.clinics.length === 0) {
        setClinicError(
          "We couldn't find nearby clinics. Showing fallback options.",
        );
        setClinics(FALLBACK_CLINICS);
        setUiStatus({
          type: "error",
          message: "We couldn't find nearby clinics. Showing fallback options.",
        });
        return;
      }

      setClinics(data.clinics);
      if (response.headers.get("x-fallback") === "1") {
        setClinicError(
          "We couldn't reach the clinic data service. Showing fallback options.",
        );
        setUiStatus({
          type: "error",
          message: "We couldn't reach the clinic data service.",
        });
      } else if (data.clinics.length < 3) {
        setClinicError(
          "Limited results returned. Showing fallback options as well.",
        );
        setUiStatus({
          type: "success",
          message: "Clinics loaded with limited results.",
        });
      } else {
        setUiStatus({ type: "success", message: "Clinics ready." });
      }
    } catch {
      setClinicError(
        "We couldn't fetch clinics right now. Showing fallback options.",
      );
      setClinics(FALLBACK_CLINICS);
      setUiStatus({
        type: "error",
        message: "We couldn't fetch clinics. Showing fallback options.",
      });
    } finally {
      setIsClinicsLoading(false);
    }
  };

  const fetchAppointment = async () => {
    try {
      const response = await fetch("/api/appointment/confirm");
      if (!response.ok) return false;
      const data = (await response.json()) as
        | { appointment: null }
        | {
            date?: string;
            time?: string;
            patientName?: string;
            clinicName?: string;
            smsStatus?: "sent" | "failed";
            smsError?: string;
          };
      if ("appointment" in data) return false;
      if (!data.date || !data.time || !data.patientName) {
        return false;
      }
      setAppointment({
        date: data.date,
        time: data.time,
        patientName: data.patientName,
        clinicName: data.clinicName || "Selected clinic",
        smsStatus: data.smsStatus || "failed",
        smsError: data.smsError,
      });
      return true;
    } catch {
      return false;
    }
  };

  const fetchLiveCallTranscript = async (callSid: string) => {
    try {
      const response = await fetch(
        `/api/call/transcript?callSid=${encodeURIComponent(callSid)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;

      const data = (await response.json()) as {
        messages?: LiveCallMessage[];
      };

      setLiveCallMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      // Keep the last successful transcript on screen if polling fails briefly.
    } finally {
      setIsTranscriptLoading(false);
    }
  };

  const pollAppointment = async (attempt = 0) => {
    const found = await fetchAppointment();
    if (found) {
      setIsWaitingConfirmation(false);
      setActiveCallSid(null);
      setLiveCallMessages([]);
      setIsTranscriptLoading(false);
      setUiStatus({ type: "success", message: "Appointment confirmed ✓" });
      router.replace("/confirmation");
      return;
    }
    if (attempt >= 20) {
      setIsWaitingConfirmation(false);
      setActiveCallSid(null);
      setLiveCallMessages([]);
      setIsTranscriptLoading(false);
      setActiveStep(3);
      setViewState("clinics");
      setUiStatus({
        type: "error",
        message: "No confirmation received yet.",
      });
      return;
    }
    setTimeout(() => {
      void pollAppointment(attempt + 1);
    }, 3000);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending) return;
    const trimmedSymptoms = symptoms.trim();
    if (!trimmedSymptoms) return;

    const hasConversation = messages.length > 0;
    const userContent = !hasConversation && location.trim()
      ? `Symptoms: ${trimmedSymptoms}\nLocation: ${location.trim()}`
      : trimmedSymptoms;

    const nextMessages = [...messages, newMessage("user", userContent)];
    setMessages(nextMessages);
    setIsSending(true);
    setUiStatus({ type: "loading", message: "Assessing symptoms..." });
    setClinics([]);
    setClinicError(null);
    setLocationWarning(null);
    setAppointment(null);
    setIsWaitingConfirmation(false);
    setViewState("form");

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: location.trim(),
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        throw new Error(
          errorData?.details || errorData?.error || "Claude triage is unavailable right now.",
        );
      }

      const data = (await response.json()) as TriageResponse;
      appendAssistantMessage(data.assistant_message);

      if (data.status === "final") {
        setTriage({
          gravity_level: data.gravity_level,
          recommendations: data.recommendations,
          wait_care_tips: data.wait_care_tips,
          emergency_warning: data.emergency_warning,
          summary_paragraph: data.summary_paragraph,
          assistant_message: data.assistant_message,
          body_heatmap: data.body_heatmap,
        });
        setIsEmergency(data.gravity_level === "HIGH" || data.emergency_warning);
        setUiStatus({
          type: data.gravity_level === "HIGH" ? "error" : "success",
          message:
            data.gravity_level === "HIGH"
              ? "Emergency warning. Review advice before continuing."
              : "Triage complete. Review advice before continuing.",
        });
      } else {
        setTriage(null);
        setIsEmergency(false);
        setUiStatus({
          type: "success",
          message: "Claude asked a follow-up question.",
        });
      }
    } catch (error) {
      setTriage(null);
      setUiStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Claude triage is unavailable right now.",
      });
    } finally {
      setIsSending(false);
      setSymptoms("");
    }
  };

  const handleContinueToClinics = async () => {
    if (isClinicsLoading) return;
    await fetchClinics(location.trim());
    setActiveStep(3);
    setViewState("clinics");
  };

  const handleCallClinic = async (clinic: Clinic) => {
    if (callingClinicId) return;
    setCallingClinicId(clinic.id);
    try {
      setAppointment(null);
      setIsWaitingConfirmation(false);
      setActiveCallSid(null);
      setLiveCallMessages([]);
      setIsTranscriptLoading(true);
      setActiveStep(3);
      setViewState("calling");
      setUiStatus({ type: "loading", message: "Calling clinic..." });
      fetch("/api/appointment/confirm", { method: "DELETE" }).catch(() => {});
      const symptomsSummary =
        triage?.summary_paragraph?.trim() ||
        "Patient reported symptoms and is seeking a clinic appointment.";
      const response = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: clinic.name,
          clinicAddress: clinic.address,
          symptomsSummary,
          patientName: patientName.trim(),
          healthCardNumber: healthCardNumber.trim(),
          phoneNumber: phoneNumber.trim(),
        }),
      });

      if (!response.ok) {
        appendAssistantMessage(
          "Call failed. Check Twilio env vars and try again.",
        );
        setActiveCallSid(null);
        setLiveCallMessages([]);
        setIsTranscriptLoading(false);
        setUiStatus({
          type: "error",
          message: "Call failed. Check Twilio env vars and try again.",
        });
        setViewState("clinics");
        return;
      }

      const data = (await response.json()) as {
        success?: boolean;
        callSid?: string;
        destinationNumber?: string;
      };
      if (data.success) {
        setActiveCallSid(data.callSid ?? null);
        setIsTranscriptLoading(Boolean(data.callSid));
        setIsWaitingConfirmation(true);
        setUiStatus({
          type: "loading",
          message: data.destinationNumber
            ? `Calling ${data.destinationNumber}...`
            : "Listening for availability...",
        });
        void pollAppointment();
      } else {
        appendAssistantMessage(
          "Call failed. Check Twilio env vars and try again.",
        );
        setActiveCallSid(null);
        setLiveCallMessages([]);
        setIsTranscriptLoading(false);
        setUiStatus({
          type: "error",
          message: "Call failed. Check Twilio env vars and try again.",
        });
        setViewState("clinics");
      }
    } catch {
      appendAssistantMessage(
        "Call failed. Check Twilio env vars and try again.",
      );
      setActiveCallSid(null);
      setLiveCallMessages([]);
      setIsTranscriptLoading(false);
      setUiStatus({
        type: "error",
        message: "Call failed. Check Twilio env vars and try again.",
      });
      setViewState("clinics");
    } finally {
      setCallingClinicId(null);
    }
  };

  const isIdentityReady =
    patientName.trim().length > 0 &&
    healthCardNumber.trim().length > 0 &&
    phoneNumber.trim().length > 0;

  const handleContinueToSymptoms = () => {
    setActiveStep(2);
    setViewState("form");
  };

  const handleBackToPatientInfo = () => {
    setActiveStep(1);
    setViewState("form");
  };

  const handleBackToSymptoms = () => {
    setActiveStep(2);
    setViewState("form");
  };

  const mainSection = (() => {
    const card =
      "rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-md backdrop-blur";
    const sectionTitle = "text-base font-semibold text-slate-900";
    const sectionHint = "text-xs text-slate-500";
    const primaryButton =
      "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300";
    const secondaryButton =
      "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

    const leftColumn = (
      <div className="space-y-5">
        {activeStep === 1 ? (
          <div className={card} ref={patientSectionRef}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <div className={sectionTitle}>Patient Information</div>
                </div>
                <div className={`${sectionHint} mt-1`}>
                  Used only to identify the patient during booking.
                </div>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                Step 1
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600" htmlFor="patientName">
                  Full Name
                </label>
                <input
                  id="patientName"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                  placeholder="e.g. Jean Tremblay"
                  type="text"
                  value={patientName}
                  onChange={(event) =>
                    updateStepOneField(
                      patientName,
                      event.target.value,
                      setPatientName,
                    )
                  }
                  ref={patientNameInputRef}
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-slate-600"
                  htmlFor="healthCardNumber"
                >
                  Health Card Number
                </label>
                <input
                  id="healthCardNumber"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                  placeholder="RAMQ number"
                  type="text"
                  value={healthCardNumber}
                  onChange={(event) =>
                    updateStepOneField(
                      healthCardNumber,
                      event.target.value,
                      setHealthCardNumber,
                    )
                  }
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-slate-600"
                  htmlFor="phoneNumber"
                >
                  Phone Number
                </label>
                <input
                  id="phoneNumber"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                  placeholder="e.g. +1 514 555 1234"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) =>
                    updateStepOneField(
                      phoneNumber,
                      event.target.value,
                      setPhoneNumber,
                    )
                  }
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  Used to send the appointment confirmation SMS.
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600" htmlFor="location">
                  Location
                </label>
                <input
                  id="location"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                  placeholder="Please enter your postal code or address"
                  type="text"
                  value={location}
                  onChange={(event) =>
                    updateStepOneField(
                      location,
                      event.target.value,
                      setLocation,
                    )
                  }
                  disabled={isSending || triage !== null}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                className={primaryButton}
                type="button"
                onClick={handleContinueToSymptoms}
              >
                Continue to symptoms
              </button>
            </div>
          </div>
        ) : (
          <div className={card} ref={patientSectionRef}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <div className={sectionTitle}>Patient Information</div>
                </div>
                <div className={`${sectionHint} mt-1`}>
                  Review details or go back to make changes.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  Step 1
                </span>
                <button
                  className={secondaryButton}
                  type="button"
                  onClick={handleBackToPatientInfo}
                >
                  Change
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Full Name
                </div>
                <div className="mt-1">{patientName || "Not provided yet"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Health Card
                </div>
                <div className="mt-1">{healthCardNumber || "Not provided yet"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </div>
                <div className="mt-1">{phoneNumber || "Not provided yet"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </div>
                <div className="mt-1">{location || "Not provided yet"}</div>
              </div>
            </div>
          </div>
        )}

        {activeStep === 2 ? (
          <form className={card} onSubmit={handleSend} ref={symptomsSectionRef}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20v-6" />
                    <path d="M9 11h6" />
                    <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                  </svg>
                </span>
                <div className={sectionTitle}>Briefly describe your Symptoms</div>
              </div>
              <div className={`${sectionHint} mt-1`}>
                Chat with the assistant about how you feel.
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Step 2
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50/80">
            <div className="flex min-h-[360px] flex-col">
              <div className="flex-1 space-y-4 px-4 py-4">
            {messages.length === 0 ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm">
                        AI
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-blue-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                        Tell me what symptoms you are having, when they started,
                        and anything that feels unusual. I&apos;ll ask follow-up
                        questions if needed.
                      </div>
                    </div>
                    <div className="pl-12">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Suggested prompts
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_SYMPTOM_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => updateSymptomsDraft(prompt)}
                            disabled={isSending || triage !== null}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          message.role === "user"
                            ? "rounded-br-md bg-gradient-to-r from-teal-600 to-blue-600 text-white"
                            : "rounded-tl-md border border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-wide ${
                            message.role === "user"
                              ? "text-white/75"
                              : "text-slate-500"
                          }`}
                        >
                          {message.role === "user" ? "You" : "Assistant"}
                        </div>
                        <p className="mt-1 whitespace-pre-line text-sm">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {isSending ? (
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm">
                      AI
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-200 bg-white/90 p-3">
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-2 shadow-sm">
                  <label className="sr-only" htmlFor="symptoms">
                    Symptoms
                  </label>
                  <textarea
                    id="symptoms"
                    className="min-h-[96px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder="Message the assistant about your symptoms..."
                    value={symptoms}
                    onChange={(event) => updateSymptomsDraft(event.target.value)}
                    disabled={isSending || triage !== null}
                    ref={symptomsInputRef}
                  />
                  <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-2">
                    <button
                      className={secondaryButton}
                      type="button"
                      onClick={handleBackToPatientInfo}
                    >
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="hidden text-xs text-slate-500 sm:block">
                        Describe timing and anything that makes symptoms better or worse.
                      </div>
                      <button
                        className={`${primaryButton} shrink-0 px-4 py-2`}
                        type="submit"
                        disabled={isSending || triage !== null}
                      >
                        {isSending ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                            Thinking...
                          </span>
                        ) : (
                          "Send"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        ) : null}
      </div>
    );

    const clinicsCard = (
      <div className={card} ref={clinicsSectionRef}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <div className={sectionTitle}>Closest Clinics</div>
            </div>
            <div className={`${sectionHint} mt-1`}>Based on your location.</div>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            Step 3
          </span>
        </div>
        {locationWarning ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {locationWarning}
          </div>
        ) : null}
        {clinicError ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {clinicError}
          </div>
        ) : null}
        {isIdentityReady ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div>Patient: {patientName}</div>
            <div>Health card: {healthCardNumber}</div>
            <div>Phone: {phoneNumber}</div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-slate-500">
            Please enter patient information and a phone number before calling.
          </div>
        )}
        <div className="mt-4 space-y-3">
          {isClinicsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="skeleton h-4 w-1/2"></div>
                  <div className="mt-3 space-y-2">
                    <div className="skeleton h-3 w-5/6"></div>
                    <div className="skeleton h-3 w-2/3"></div>
                    <div className="skeleton h-3 w-1/3"></div>
                  </div>
                  <div className="mt-4 skeleton h-8 w-28"></div>
                </div>
              ))}
            </div>
          ) : clinics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                No clinics loaded yet.
              </div>
            </div>
          ) : (
            clinics.map((clinic) => (
              <div
                key={clinic.id}
                className="rounded-2xl border border-slate-200 border-l-4 border-l-teal-500/80 bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold text-slate-900">
                    {clinic.name}
                  </div>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                    {clinic.distance_km.toFixed(2)} km
                  </span>
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                  <svg
                    className="mt-0.5 h-4 w-4 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{clinic.address}</span>
                </div>
                <div className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                  <svg
                    className="mt-0.5 h-4 w-4 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.66 12.66 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.66 12.66 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
                  </svg>
                  <span>{clinic.phone}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    className={`${primaryButton} flex-1`}
                    type="button"
                    onClick={() => handleCallClinic(clinic)}
                    disabled={callingClinicId === clinic.id || !isIdentityReady}
                  >
                    {callingClinicId === clinic.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                        Calling...
                      </span>
                    ) : (
                      "Call clinic"
                    )}
                  </button>
                  <a
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                    href={`https://www.google.com/maps/search/?api=1&query=${clinic.lat},${clinic.lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in maps
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-5 flex justify-start">
          <button
            className={secondaryButton}
            type="button"
            onClick={handleBackToSymptoms}
          >
            Back
          </button>
        </div>
      </div>
    );

    const triageCard = triage ? (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
        <div className="text-base font-semibold text-slate-900">
          Medical Safety Assessment
        </div>
        <div className="mt-2 text-sm">
          Severity:{" "}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              triage.gravity_level === "HIGH"
                ? "bg-red-100 text-red-700"
                : triage.gravity_level === "MEDIUM"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {triage.gravity_level}
          </span>
        </div>
        {triage.body_heatmap && triage.body_heatmap.length > 0 ? (
          <BodyHeatmap entries={triage.body_heatmap} />
        ) : null}
        <p className="mt-3 text-sm text-slate-700">{triage.summary_paragraph}</p>
        <div className="mt-4 text-sm font-semibold text-slate-900">
          Recommendations
        </div>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {triage.recommendations.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-sm font-semibold text-slate-900">
          While waiting
        </div>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {triage.wait_care_tips.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {triage.gravity_level === "HIGH" ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            These symptoms may require urgent emergency evaluation.
          </div>
        ) : null}
        {activeStep === 2 ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className={secondaryButton}
              type="button"
              onClick={handleBackToPatientInfo}
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="hidden text-xs text-slate-500 sm:block">
                Review the advice, then continue when you are ready to see clinics.
              </div>
              <button
                className={primaryButton}
                type="button"
                onClick={() => void handleContinueToClinics()}
                disabled={isClinicsLoading}
              >
                {isClinicsLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                    Searching for clinics...
                  </span>
                ) : (
                  "Continue to clinic search"
                )}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 text-xs text-slate-500">{disclaimer}</div>
      </div>
    ) : null;

    const rightColumn = (
      <div className="space-y-5">
        {activeStep === 3 && viewState === "calling" ? (
          <div className="overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40">
            <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,_rgba(240,253,250,0.95),_rgba(248,250,252,0.92))] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                    </span>
                    Live booking call in progress
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Watching the call update turn by turn as Twilio gathers responses.
                  </div>
                </div>
                <div className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Active
                </div>
              </div>
            </div>

            <div className="bg-[linear-gradient(180deg,_rgba(248,250,252,0.88),_rgba(255,255,255,1)_24%,_rgba(248,250,252,0.6)_100%)] px-4 py-4">
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/90 p-3 shadow-inner shadow-slate-100/70">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live conversation
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                    Updating automatically
                  </div>
                </div>

                <div className="max-h-[28rem] space-y-3 overflow-y-auto px-1 py-1" ref={liveCallScrollRef}>
                  {isTranscriptLoading && liveCallMessages.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-500" />
                      </div>
                      <div className="mt-4 text-sm font-semibold text-slate-900">
                        Connecting and waiting for the first response...
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        The live transcript will appear here as the clinic answers.
                      </div>
                    </div>
                  ) : liveCallMessages.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                      <div className="text-sm font-semibold text-slate-900">
                        Waiting for the conversation to begin
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Twilio is connected. The first turn will appear here shortly.
                      </div>
                    </div>
                  ) : (
                    liveCallMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "assistant" ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[1.3rem] px-4 py-3 shadow-sm ${
                            message.role === "assistant"
                              ? "border border-slate-200 bg-slate-50 text-slate-800"
                              : "bg-gradient-to-r from-teal-600 to-blue-600 text-white"
                          }`}
                        >
                          <div
                            className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                              message.role === "assistant"
                                ? "text-slate-500"
                                : "text-white/75"
                            }`}
                          >
                            {message.role === "assistant" ? "CarePilot" : "Clinic"}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm leading-6">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {activeStep === 2 && triageCard ? triageCard : null}
        {activeStep === 3 && viewState === "clinics" ? clinicsCard : null}
      </div>
    );

    return (
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {leftColumn}
        {rightColumn}
      </section>
    );
  })();

  const steps = [
    { id: 1, label: "Patient info" },
    { id: 2, label: "Symptoms" },
    { id: 3, label: "Closest clinics" },
    { id: 4, label: "Confirmation" },
  ];

  const progressPercent = (activeStep / steps.length) * 100;

  useEffect(() => {
    if (uiStatus.type !== "success") return;
    const timer = setTimeout(() => {
      setUiStatus({ type: "idle" });
    }, 2000);
    return () => clearTimeout(timer);
  }, [uiStatus.type]);

  useEffect(() => {
    const scrollTo = (
      ref: RefObject<HTMLElement | null>,
      behavior: ScrollBehavior = "smooth",
    ) => {
      ref.current?.scrollIntoView({ behavior, block: "start" });
    };

    if (activeStep === 3) {
      scrollTo(clinicsSectionRef);
    } else if (activeStep === 2) {
      scrollTo(symptomsSectionRef);
    } else {
      scrollTo(patientSectionRef);
    }

    if (activeStep === 1) {
      setTimeout(() => patientNameInputRef.current?.focus(), 0);
    } else if (activeStep === 2) {
      setTimeout(() => symptomsInputRef.current?.focus(), 0);
    }
  }, [activeStep, viewState]);

  useEffect(() => {
    if (viewState !== "calling" || !activeCallSid) return;

    setIsTranscriptLoading(true);
    void fetchLiveCallTranscript(activeCallSid);

    const interval = setInterval(() => {
      void fetchLiveCallTranscript(activeCallSid);
    }, 1500);

    return () => clearInterval(interval);
  }, [activeCallSid, viewState]);

  useEffect(() => {
    const container = liveCallScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [liveCallMessages]);

  return (
    <main className="app-atmosphere min-h-screen">
      <div className="app-atmosphere-shell">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <Image
                src="/carepilot-logo.png"
                alt="CarePilot"
                width={210}
                height={58}
                className="h-auto w-[170px] sm:w-[210px]"
                priority
              />
            </div>
            <div className="text-sm text-slate-600">
              Find a nearby clinic and book faster
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {disclaimer}
          </div>
          {isEmergency ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
              Emergency warning: Your symptoms may be urgent. Please call 911 or
              go to the nearest emergency room. You can still review clinics,
              but emergency care may be the safer option.
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <section className="app-atmosphere-soft mb-6 rounded-2xl border border-slate-200/70 bg-white/72 px-6 py-6 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-2xl font-semibold text-slate-900">
                Book an appointment
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Follow the steps to find a clinic and confirm.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Nearby clinics" },
                { label: "Phone booking" },
                { label: "Safety assessment" },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Booking progress
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {steps.map((step) => (
                  <div key={step.id} className="text-center">
                    <div
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                        step.id < activeStep
                          ? "border-teal-500 bg-teal-500 text-white"
                          : step.id === activeStep
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {step.id}
                    </div>
                    <div
                      className={`mt-2 text-[11px] font-semibold uppercase tracking-wide ${
                        step.id === activeStep
                          ? "text-slate-900"
                          : "text-slate-500"
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {uiStatus.type !== "idle" && uiStatus.message ? (
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                uiStatus.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : uiStatus.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {uiStatus.type === "loading" ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              ) : null}
              <span>{uiStatus.message}</span>
            </div>
          ) : null}
        </section>

        {mainSection}
      </div>
      </div>
    </main>
  );
}
