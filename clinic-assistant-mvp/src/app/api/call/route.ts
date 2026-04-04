import { NextResponse } from "next/server";
import twilio from "twilio";

type CallRequest = {
  clinicName?: string;
  clinicAddress?: string;
  symptomsSummary?: string;
  patientName?: string;
  healthCardNumber?: string;
};

const DESTINATION_NUMBER = "+14385068854";

const sanitizeForTts = (value: string, maxLength: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CallRequest;
    const clinicName = sanitizeForTts(body.clinicName ?? "", 80);
    const clinicAddress = sanitizeForTts(body.clinicAddress ?? "", 120);
    const symptomsSummary = sanitizeForTts(body.symptomsSummary ?? "", 160);
    const patientName = sanitizeForTts(body.patientName ?? "", 80);
    const healthCardNumber = sanitizeForTts(body.healthCardNumber ?? "", 40);

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

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;

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
    const call = await client.calls.create({
      to: DESTINATION_NUMBER,
      from: fromNumber,
      url: callUrl.toString(),
    });

    return NextResponse.json({ success: true, callSid: call.sid });
  } catch {
    return NextResponse.json(
      { success: false, error: "Twilio call failed." },
      { status: 500 },
    );
  }
}
