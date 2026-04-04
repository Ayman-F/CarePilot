"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FormEvent } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };

type TriageResponse = {
  gravity_level: "LOW" | "MEDIUM" | "HIGH";
  matched_symptoms: string[];
  recommendations: string[];
  emergency_warning: boolean;
  summary_paragraph: string;
};

type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lon: number;
  distance_km: number;
};

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

export default function Home() {
  const [symptoms, setSymptoms] = useState("");
  const [location, setLocation] = useState("");
  const [patientName, setPatientName] = useState("");
  const [healthCardNumber, setHealthCardNumber] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [triage, setTriage] = useState<TriageResponse | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isClinicsLoading, setIsClinicsLoading] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [callingClinicId, setCallingClinicId] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<{
    date: string;
    time: string;
    patientName: string;
  } | null>(null);
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [uiStatus, setUiStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const [viewState, setViewState] = useState<
    "form" | "clinics" | "calling" | "confirmed"
  >("form");

  const patientSectionRef = useRef<HTMLDivElement | null>(null);
  const symptomsSectionRef = useRef<HTMLFormElement | null>(null);
  const clinicsSectionRef = useRef<HTMLDivElement | null>(null);
  const confirmedSectionRef = useRef<HTMLDivElement | null>(null);
  const patientNameInputRef = useRef<HTMLInputElement | null>(null);
  const symptomsInputRef = useRef<HTMLTextAreaElement | null>(null);

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
        | { date?: string; time?: string; patientName?: string };
      if ("appointment" in data) return false;
      if (!data.date || !data.time || !data.patientName) return false;
      setAppointment({
        date: data.date,
        time: data.time,
        patientName: data.patientName,
      });
      return true;
    } catch {
      return false;
    }
  };

  const pollAppointment = async (attempt = 0) => {
    const found = await fetchAppointment();
    if (found) {
      setIsWaitingConfirmation(false);
      setViewState("confirmed");
      setUiStatus({ type: "success", message: "Appointment confirmed ✓" });
      return;
    }
    if (attempt >= 20) {
      setIsWaitingConfirmation(false);
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
    if (isEmergency || isSending) return;
    const trimmedSymptoms = symptoms.trim();
    if (!trimmedSymptoms) return;

    const userContent = location.trim()
      ? `Symptoms: ${trimmedSymptoms}\nLocation: ${location.trim()}`
      : `Symptoms: ${trimmedSymptoms}`;

    setMessages((prev) => [...prev, newMessage("user", userContent)]);
    setIsSending(true);
    setUiStatus({ type: "loading", message: "Assessing symptoms..." });
    setClinics([]);
    setClinicError(null);
    setLocationWarning(null);
    setAppointment(null);
    setIsWaitingConfirmation(false);
    setViewState("form");
    setIsEmergency(false);

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: trimmedSymptoms,
          location: location.trim(),
        }),
      });

      const data = (await response.json()) as TriageResponse;
      setTriage(data);

      const recommendation =
        data.recommendations?.[0] ??
        "I can help you find a nearby clinic for next steps.";
      const assistantContent = `${data.summary_paragraph}\n\nNext step: ${recommendation}`;
      appendAssistantMessage(assistantContent);

      if (data.gravity_level === "HIGH") {
        setIsEmergency(true);
        setUiStatus({
          type: "error",
          message: "Emergency warning. Please call 911.",
        });
        return;
      }

      await fetchClinics(location.trim());
      setViewState("clinics");
    } catch {
      appendAssistantMessage(
        "Thanks. I can help you find a clinic. In the next step, I'll ask a few questions and suggest nearby options.",
      );
      setUiStatus({
        type: "error",
        message: "Unable to reach triage. Please try again.",
      });
    } finally {
      setIsSending(false);
      setSymptoms("");
    }
  };

  const handleCallClinic = async (clinic: Clinic) => {
    if (isEmergency || callingClinicId) return;
    setCallingClinicId(clinic.id);
    try {
      setAppointment(null);
      setIsWaitingConfirmation(false);
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
        }),
      });

      if (!response.ok) {
        appendAssistantMessage(
          "Call failed. Check Twilio env vars and try again.",
        );
        setUiStatus({
          type: "error",
          message: "Call failed. Check Twilio env vars and try again.",
        });
        return;
      }

      const data = (await response.json()) as { success?: boolean };
      if (data.success) {
        setIsWaitingConfirmation(true);
        setUiStatus({
          type: "loading",
          message: "Listening for availability...",
        });
        void pollAppointment();
      } else {
        appendAssistantMessage(
          "Call failed. Check Twilio env vars and try again.",
        );
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
    patientName.trim().length > 0 && healthCardNumber.trim().length > 0;

  const mainSection = (() => {
    const card =
      "rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-md backdrop-blur";
    const sectionTitle = "text-base font-semibold text-slate-900";
    const sectionHint = "text-xs text-slate-500";
    const primaryButton =
      "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300";

    const leftColumn = (
      <div className="space-y-5">
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
                onChange={(event) => setPatientName(event.target.value)}
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
                onChange={(event) => setHealthCardNumber(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="location">
                Location
              </label>
              <input
                id="location"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                placeholder="City or neighborhood"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                disabled={isEmergency || isSending}
              />
            </div>
          </div>
        </div>

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
                <div className={sectionTitle}>Symptoms & Location</div>
              </div>
              <div className={`${sectionHint} mt-1`}>
                Tell us what you feel and where you are.
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Step 2
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="symptoms">
                Symptoms
              </label>
              <textarea
                id="symptoms"
                className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                placeholder="Describe how you feel..."
                value={symptoms}
                onChange={(event) => setSymptoms(event.target.value)}
                disabled={isEmergency || isSending}
                ref={symptomsInputRef}
              />
            </div>
          </div>
          <div className="mt-4">
            <button className={primaryButton} type="submit" disabled={isEmergency || isSending}>
              {isSending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                  Finding clinics...
                </span>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>

        <div className={card}>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </span>
            <div className={sectionTitle}>Conversation</div>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No messages yet.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {message.role}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-900">
                    {message.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
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
          </div>
        ) : (
          <div className="mt-4 text-xs text-slate-500">
            Please enter patient information before calling.
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
                    disabled={isEmergency || callingClinicId === clinic.id || !isIdentityReady}
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
      </div>
    );

    const handleNewAppointment = () => {
      setAppointment(null);
      setClinics([]);
      setClinicError(null);
      setLocationWarning(null);
      setTriage(null);
      setIsWaitingConfirmation(false);
      setIsEmergency(false);
      setUiStatus({ type: "idle" });
      setViewState("form");
    };

    const confirmationCard = appointment ? (
      <div className="space-y-4" ref={confirmedSectionRef}>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-4 text-sm text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            Appointment Confirmed
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Confirmed ✓
          </div>
          <div className="mt-2">Date: {appointment.date}</div>
          <div>Time: {appointment.time}</div>
          <div>Patient: {appointment.patientName}</div>
          <div className="mt-4">
            <button
              className={primaryButton}
              type="button"
              onClick={handleNewAppointment}
            >
              Book another appointment
            </button>
          </div>
        </div>
        {triage ? (
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
            <div className="mt-2 text-sm text-slate-700">
              Based on reported symptoms:{" "}
              {triage.matched_symptoms.length > 0
                ? triage.matched_symptoms.join(", ")
                : "no specific matches"}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {triage.recommendations.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {triage.gravity_level === "HIGH" ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                Go to emergency services immediately.
              </div>
            ) : null}
            <div className="mt-2 text-xs text-slate-500">
              This is not medical advice.
            </div>
          </div>
        ) : null}
      </div>
    ) : null;

    const rightColumn = (
      <div className="space-y-5">
        {viewState === "confirmed" && confirmationCard ? confirmationCard : null}
        {viewState === "calling" ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
              Calling clinic...
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Waiting for appointment confirmation.
            </div>
          </div>
        ) : null}
        {viewState !== "calling" && viewState !== "confirmed" ? clinicsCard : null}
      </div>
    );

    return (
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {leftColumn}
        {rightColumn}
      </section>
    );
  })();

  const stepIndex =
    viewState === "confirmed"
      ? 4
      : viewState === "clinics" || viewState === "calling"
        ? 3
        : messages.length > 0
          ? 2
          : 1;

  const steps = [
    { id: 1, label: "Patient info" },
    { id: 2, label: "Symptoms & location" },
    { id: 3, label: "Closest clinics" },
    { id: 4, label: "Confirmed" },
  ];

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

    if (stepIndex === 4) {
      scrollTo(confirmedSectionRef);
    } else if (stepIndex === 3) {
      scrollTo(clinicsSectionRef);
    } else if (stepIndex === 2) {
      scrollTo(symptomsSectionRef);
    } else {
      scrollTo(patientSectionRef);
    }

    if (stepIndex === 1) {
      setTimeout(() => patientNameInputRef.current?.focus(), 0);
    } else if (stepIndex === 2) {
      setTimeout(() => symptomsInputRef.current?.focus(), 0);
    }
  }, [stepIndex, viewState]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-semibold text-slate-900">
              Clinic Assistant
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
              go to the nearest emergency room. The chat is locked for safety.
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <section className="mb-6 rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-6 shadow-sm backdrop-blur">
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
            <div className="mt-3 flex items-center gap-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                      step.id <= stepIndex
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    {step.label}
                  </div>
                  {index < steps.length - 1 ? (
                    <div
                      className={`h-[2px] w-10 rounded-full ${
                        step.id < stepIndex ? "bg-teal-500" : "bg-slate-200"
                      }`}
                    />
                  ) : null}
                </div>
              ))}
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
    </main>
  );
}



