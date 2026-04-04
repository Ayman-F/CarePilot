import { NextResponse } from "next/server";
import twilio from "twilio";

export type Appointment = {
  date: string;
  time: string;
  patientName: string;
  healthCardNumber: string;
  phoneNumber: string;
  clinicName: string;
  smsStatus: "sent" | "failed";
  smsError?: string;
};

let latestAppointment: Appointment | null = null;

type AppointmentInput = Omit<Appointment, "smsStatus" | "smsError">;

export async function saveAppointment(
  input: Partial<AppointmentInput>,
): Promise<{ success: true } | { success: false; error: string }> {
  const date = (input.date ?? "").trim();
  const time = (input.time ?? "").trim();
  const patientName = (input.patientName ?? "").trim();
  const healthCardNumber = (input.healthCardNumber ?? "").trim();
  const phoneNumber = (input.phoneNumber ?? "").trim();
  const clinicName = (input.clinicName ?? "").trim();

  if (
    !date ||
    !time ||
    !patientName ||
    !healthCardNumber ||
    !phoneNumber ||
    !clinicName
  ) {
    return {
      success: false,
      error:
        "Missing date, time, patient name, health card, phone number, or clinic name.",
    };
  }

  latestAppointment = {
    date,
    time,
    patientName,
    healthCardNumber,
    phoneNumber,
    clinicName,
    smsStatus: "failed",
    smsError: "SMS could not be sent.",
  };

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (accountSid && authToken && fromNumber) {
    try {
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        to: phoneNumber,
        from: fromNumber,
        body: `Medical appointment confirmed: ${clinicName} on ${date} at ${time}. We look forward to seeing you.`,
      });
      latestAppointment.smsStatus = "sent";
      latestAppointment.smsError = undefined;
    } catch (error) {
      latestAppointment.smsStatus = "failed";
      latestAppointment.smsError =
        error instanceof Error ? error.message : "SMS could not be sent.";
    }
  } else {
    latestAppointment.smsError = "Missing Twilio SMS configuration.";
  }

  return { success: true };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppointmentInput>;
    const result = await saveAppointment(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Appointment confirmation failed", error);
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
}

export async function GET() {
  if (!latestAppointment) {
    return NextResponse.json({ appointment: null });
  }
  return NextResponse.json(latestAppointment);
}

export async function DELETE() {
  latestAppointment = null;
  return NextResponse.json({ success: true });
}
