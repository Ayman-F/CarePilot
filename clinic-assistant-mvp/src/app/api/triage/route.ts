import { NextResponse } from "next/server";

type GravityLevel = "LOW" | "MEDIUM" | "HIGH";

type TriageResponse = {
  gravity_level: GravityLevel;
  matched_symptoms: string[];
  recommendations: string[];
  emergency_warning: boolean;
  summary_paragraph: string;
};

const HIGH_KEYWORDS = [
  "chest pain",
  "difficulty breathing",
  "shortness of breath",
  "fainting",
  "loss of consciousness",
  "confusion",
  "slurred speech",
  "severe bleeding",
];

const MEDIUM_KEYWORDS = [
  "dizziness",
  "headache",
  "fever",
  "nausea",
  "vomiting",
  "abdominal pain",
];

const buildSummary = (symptoms: string, location: string) => {
  const locText = location ? ` in ${location}` : "";
  const trimmed = symptoms.slice(0, 220).trim();
  return `Reported symptoms: ${trimmed}${locText}. I can help with safe next steps and finding a clinic if needed.`.slice(
    0,
    350,
  );
};

const assessSeverity = (symptoms: string) => {
  const lowered = symptoms.toLowerCase();
  const matchedHigh = HIGH_KEYWORDS.filter((keyword) =>
    lowered.includes(keyword),
  );
  if (matchedHigh.length > 0) {
    return {
      gravity_level: "HIGH" as const,
      matched_symptoms: matchedHigh,
      recommendations: [
        "Go to emergency services immediately or call 911.",
        "Do not delay seeking urgent care.",
      ],
      emergency_warning: true,
    };
  }

  const matchedMedium = MEDIUM_KEYWORDS.filter((keyword) =>
    lowered.includes(keyword),
  );
  if (matchedMedium.length > 0) {
    return {
      gravity_level: "MEDIUM" as const,
      matched_symptoms: matchedMedium,
      recommendations: [
        "Consider a clinic visit if symptoms persist or worsen.",
        "Monitor symptoms and rest as needed.",
      ],
      emergency_warning: false,
    };
  }

  return {
    gravity_level: "LOW" as const,
    matched_symptoms: [],
    recommendations: [
      "Monitor symptoms and consider a clinic visit if they persist.",
    ],
    emergency_warning: false,
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      symptoms?: string;
      location?: string;
    };

    const symptoms = (body.symptoms ?? "").trim();
    const location = (body.location ?? "").trim();

    if (!symptoms) {
      const fallback: TriageResponse = {
        gravity_level: "MEDIUM",
        matched_symptoms: [],
        recommendations: [
          "Please describe your symptoms so I can guide next steps.",
        ],
        emergency_warning: false,
        summary_paragraph:
          "Please share your symptoms so I can provide safe next steps and help locate a clinic if needed.",
      };
      return NextResponse.json(fallback);
    }

    const assessment = assessSeverity(symptoms);

    const response: TriageResponse = {
      gravity_level: assessment.gravity_level,
      matched_symptoms: assessment.matched_symptoms,
      recommendations: assessment.recommendations,
      emergency_warning: assessment.emergency_warning,
      summary_paragraph: buildSummary(symptoms, location),
    };

    return NextResponse.json(response);
  } catch {
    const fallback: TriageResponse = {
      gravity_level: "MEDIUM",
      matched_symptoms: [],
      recommendations: [
        "Consider a clinic visit if symptoms persist or worsen.",
      ],
      emergency_warning: false,
      summary_paragraph:
        "I can help with safe next steps and finding a clinic if needed.",
    };
    return NextResponse.json(fallback);
  }
}
