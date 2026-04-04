import { NextResponse } from "next/server";
import twilio from "twilio";
import { initializeTranscript } from "../twilio/voice-store";

type CallRequest = {
  clinicName?: string;
  clinicAddress?: string;
  symptomsSummary?: string;
  patientName?: string;
  healthCardNumber?: string;
  phoneNumber?: string;
};

const DESTINATION_NUMBER = "+14385068854";

const getEnv = (key: string) => process.env[key]?.trim() ?? "";

const sanitizeForTts = (value: string, maxLength: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

const OPENING_PROMPT =
  "Hello, I'm calling to book a medical appointment for a patient. Do you have an appointment available for today or tomorrow?";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CallRequest;
    const clinicName = sanitizeForTts(body.clinicName ?? "", 80);
    const clinicAddress = sanitizeForTts(body.clinicAddress ?? "", 120);
    const symptomsSummary = sanitizeForTts(body.symptomsSummary ?? "", 160);
    const patientName = sanitizeForTts(body.patientName ?? "", 80);
    const healthCardNumber = sanitizeForTts(body.healthCardNumber ?? "", 40);
    const phoneNumber = sanitizeForTts(body.phoneNumber ?? "", 30);

    if (
      !clinicName ||
      !clinicAddress ||
      !symptomsSummary ||
      !patientName ||
      !healthCardNumber
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing clinic details, summary, or patient information.",
        },
        { status: 400 },
      );
    }

    const accountSid = getEnv("TWILIO_ACCOUNT_SID");
    const authToken = getEnv("TWILIO_AUTH_TOKEN");
    const fromNumber = getEnv("TWILIO_PHONE_NUMBER");
    const publicBaseUrl = getEnv("PUBLIC_BASE_URL");

    if (!accountSid || !authToken || !fromNumber || !publicBaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, or PUBLIC_BASE_URL.",
        },
        { status: 500 },
      );
    }

    const client = twilio(accountSid, authToken);
    const callUrl = new URL(`${publicBaseUrl}/api/twilio/voice`);
    callUrl.searchParams.set("step", "1");
    callUrl.searchParams.set("patientName", patientName);
    callUrl.searchParams.set("healthCardNumber", healthCardNumber);
    callUrl.searchParams.set("phoneNumber", phoneNumber);
    callUrl.searchParams.set("clinicName", clinicName);
    const statusCallbackUrl = new URL(`${publicBaseUrl}/api/twilio/status`);
    const call = await client.calls.create({
      to: DESTINATION_NUMBER,
      from: fromNumber,
      url: callUrl.toString(),
      statusCallback: statusCallbackUrl.toString(),
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed"],
    });

    initializeTranscript(call.sid, OPENING_PROMPT);

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      destinationNumber: DESTINATION_NUMBER,
    });
  } catch (error) {
    console.error("Twilio call route failed", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Twilio call failed.",
      },
      { status: 500 },
    );
  }
}
