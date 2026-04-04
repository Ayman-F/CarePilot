import { NextResponse } from "next/server";

type Appointment = {
  date: string;
  time: string;
  patientName: string;
  healthCardNumber: string;
};

let latestAppointment: Appointment | null = null;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Appointment>;
    const date = (body.date ?? "").trim();
    const time = (body.time ?? "").trim();
    const patientName = (body.patientName ?? "").trim();
    const healthCardNumber = (body.healthCardNumber ?? "").trim();
    if (!date || !time || !patientName || !healthCardNumber) {
      return NextResponse.json(
        { error: "Missing date, time, patient name, or health card." },
        { status: 400 },
      );
    }
    latestAppointment = { date, time, patientName, healthCardNumber };
    return NextResponse.json({ success: true });
  } catch {
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
