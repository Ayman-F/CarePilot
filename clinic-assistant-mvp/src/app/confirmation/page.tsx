"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Appointment = {
  date: string;
  time: string;
  patientName: string;
  clinicName: string;
  smsStatus: "sent" | "failed";
  smsError?: string;
};

const TIMELINE_STEPS = [
  "Patient information submitted",
  "Triage completed",
  "Clinic selected and contacted",
  "Appointment confirmed",
];

export default function ConfirmationPage() {
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAppointment = async () => {
      try {
        const response = await fetch("/api/appointment/confirm", {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setAppointment(null);
          return;
        }

        const data = (await response.json()) as
          | { appointment: null }
          | Partial<Appointment>;

        if (cancelled) return;

        if (
          "appointment" in data ||
          !data.date ||
          !data.time ||
          !data.patientName ||
          !data.clinicName
        ) {
          setAppointment(null);
          return;
        }

        setAppointment({
          date: data.date,
          time: data.time,
          patientName: data.patientName,
          clinicName: data.clinicName,
          smsStatus: data.smsStatus === "sent" ? "sent" : "failed",
          smsError: data.smsError,
        });
      } catch {
        if (!cancelled) setAppointment(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAppointment();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleBookAnother = async () => {
    setIsResetting(true);
    try {
      await fetch("/api/appointment/confirm", { method: "DELETE" });
    } catch {
      // Even if clearing fails, returning home gives the user a clean path to restart.
    } finally {
      router.replace("/");
    }
  };

  const handleReturnHome = () => {
    router.replace("/");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_32%),linear-gradient(180deg,_#f6fffb_0%,_#f8fafc_45%,_#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
          <div className="rounded-3xl border border-emerald-100 bg-white/90 px-8 py-10 text-center shadow-xl shadow-emerald-100/60 backdrop-blur">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
            <div className="mt-4 text-base font-semibold text-slate-900">
              Loading confirmation...
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Retrieving your appointment details.
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/90 px-8 py-10 text-center shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <h1 className="mt-5 text-3xl font-semibold text-slate-900">
              No active confirmation found
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              We could not find a saved appointment confirmation to display right
              now. You can return to the booking flow and start a new appointment.
            </p>
            <button
              className="mt-7 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
              type="button"
              onClick={handleReturnHome}
            >
              Return to booking
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_#f6fffb_0%,_#f8fafc_48%,_#ffffff_100%)]">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="rounded-[2rem] border border-emerald-100/80 bg-white/85 p-6 shadow-2xl shadow-emerald-100/70 backdrop-blur md:p-8">
          <div className="rounded-[1.75rem] border border-emerald-200/80 bg-[linear-gradient(135deg,_rgba(236,253,245,0.95),_rgba(240,253,250,0.88)_48%,_rgba(255,255,255,0.96)_100%)] px-6 py-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Booking complete
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                  Appointment Confirmed
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 md:text-base">
                  Your clinic booking has been recorded successfully. Here is a
                  complete summary of the appointment and the journey that got
                  you there.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-100/60">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Date
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {appointment.date}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-100/60">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Time
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {appointment.time}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="success-check-wrapper">
                  <span className="success-check-ring success-check-ring--outer" />
                  <span className="success-check-ring success-check-ring--inner" />
                  <div className="success-check-core">
                    <svg
                      className="success-check-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Completed timeline
              </div>
              <div className="mt-6 space-y-0">
                {TIMELINE_STEPS.map((step, index) => (
                  <div key={step} className="relative flex gap-4 pb-7 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-white shadow-sm ${
                          index === TIMELINE_STEPS.length - 1
                            ? "border-emerald-500 bg-emerald-500 shadow-emerald-200"
                            : "border-emerald-300 bg-emerald-400"
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                      {index < TIMELINE_STEPS.length - 1 ? (
                        <span className="mt-2 h-full min-h-10 w-px bg-gradient-to-b from-emerald-300 to-emerald-100" />
                      ) : null}
                    </div>
                    <div className="pt-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {step}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {index === TIMELINE_STEPS.length - 1
                          ? "Finalized and ready for the patient."
                          : "Completed successfully during the booking flow."}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Appointment details
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Patient
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {appointment.patientName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Clinic
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {appointment.clinicName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Date
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {appointment.date}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Time
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {appointment.time}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  SMS status
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <span
                    className={`mt-1 h-3 w-3 rounded-full ${
                      appointment.smsStatus === "sent"
                        ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]"
                        : "bg-amber-500 shadow-[0_0_0_6px_rgba(245,158,11,0.12)]"
                    }`}
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {appointment.smsStatus === "sent"
                        ? "Confirmation SMS sent successfully"
                        : "Appointment confirmed, but SMS could not be sent"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {appointment.smsStatus === "sent"
                        ? "The patient has received a text confirmation for this appointment."
                        : appointment.smsError || "No additional SMS details were provided."}
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/80 transition hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                onClick={handleBookAnother}
                disabled={isResetting}
              >
                {isResetting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                    Returning to booking...
                  </span>
                ) : (
                  "Book another appointment"
                )}
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
