# CareFlow

CarePilot is a healthcare triage-and-booking assistant built as a hackathon MVP.

It helps patients describe symptoms in plain language, receive short medical guidance, get routed toward the right nearby clinic, and complete appointment booking through an automated outbound phone flow.

CarePilot uses a lightweight RAG-style triage layer so Claude can combine its own reasoning with trusted medical triage documentation for more grounded recommendations.

## Why This Project Matters

Emergency services are often overloaded by patients who are worried, uncomfortable, and unsure where to go next.

CarePilot is designed to reduce that uncertainty by:

- running a short conversational triage before booking
- identifying urgency as `LOW`, `MEDIUM`, or `HIGH`
- surfacing practical wait-care guidance while the patient is still at home
- showing when emergency evaluation may be safer
- routing non-emergency users toward nearby clinics instead of defaulting everyone to the ER
- reducing friction in the final booking step by placing the clinic call automatically

The goal is not to replace clinicians or emergency services. The goal is to help more patients reach the right level of care faster, with better guidance and less unnecessary emergency congestion.

## What CarePilot Does

### 1. Conversational symptom triage

- The user enters identity and location details.
- The user chats with Claude in a short triage conversation.
- A lightweight retrieval step pulls the most relevant excerpts from medical triage documentation before Claude answers.
- Claude can ask targeted follow-up questions when needed.
- The final result includes:
  - urgency level
  - assistant summary
  - practical recommendations
  - wait-care tips
  - emergency warning flag
  - optional body heatmap data for affected regions

### 2. Visual triage output

- A body heatmap highlights the area involved in the complaint.
- Severity is color-coded:
  - yellow for low
  - orange for medium
  - red for high
- This makes the result easier to scan and feel more tangible to the patient.

### 3. Safer clinic routing

- After triage, the user explicitly continues to clinic search.
- The app looks up nearby clinics based on the user’s location.
- If live clinic lookup is unavailable, the app falls back gracefully to known clinic options so the experience can continue.

### 4. Automated phone booking

- The app uses Twilio to place an outbound booking call.
- The voice flow asks about:
  - availability
  - earliest available date if needed
  - appointment time
  - confirmation that patient details were noted
- Patient name and health card number are repeated carefully during the call.

### 5. Confirmation and SMS

- Once booking is captured, the appointment is stored in memory.
- The app attempts to send an SMS confirmation to the patient.
- A premium confirmation page shows:
  - appointment details
  - a completed booking timeline
  - SMS delivery status

### 6. Premium UX features

The current build also includes:

- chat-style Step 2 symptom interface
- persistent 4-step progress navigation
- branded CarePilot logo
- polished blue-and-white atmospheric background treatment
- live on-screen Twilio conversation panel during the call
- premium confirmation page after booking

## Current User Flow

1. Enter patient information and location
2. Chat with Claude for triage
3. Review urgency, recommendations, and heatmap
4. Continue to nearby clinic search
5. Start the booking call
6. Watch the live phone conversation update on screen
7. Receive appointment confirmation
8. Receive SMS confirmation if Twilio messaging succeeds

## Core Product Value

CarePilot improves triage and clinic access in three important ways:

### Better symptom guidance before booking

Instead of immediately searching randomly for clinics, the user first receives a structured triage conversation and tailored recommendations. These recommendations are improved by combining Claude's general reasoning with relevant medical triage documentation when it applies.

### Better routing away from unnecessary emergency use

Users with lower-acuity or moderate symptoms can be directed toward clinic care instead of defaulting to emergency services, while still clearly warning when symptoms sound unsafe or urgent.

### Better patient confidence while waiting

Even before the booking is completed, the patient already has:

- a clearer understanding of urgency
- guidance on what to monitor
- comfort and safety recommendations while waiting

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Anthropic Claude API for triage
- Lightweight RAG-style retrieval layer for medical triage documentation
- Twilio for outbound voice and SMS
- ElevenLabs for optional TTS
- OpenStreetMap Nominatim + Overpass for clinic lookup

## RAG Triage Layer

CarePilot uses a lightweight Retrieval-Augmented Generation approach for medical triage.

The goal is not to replace Claude with a document-only system. Instead, the app retrieves the most relevant snippets from trusted medical triage documentation and provides them to Claude as optional context before generating recommendations.

This approach improves:

- accuracy of symptom guidance
- consistency of recommendations
- grounding in medical triage documentation
- safety when handling uncertain or borderline cases

The RAG layer stays lightweight:

- no heavy vector database is required
- no full-document injection on every request
- no replacement of Claude's own reasoning
- document context is only used when relevant

In practice, the triage flow is:

1. User sends symptoms and follow-up answers
2. The backend identifies relevant medical triage passages
3. Claude receives both the conversation and the retrieved medical context
4. Claude returns urgency, recommendations, wait-care guidance, and emergency warnings

This keeps the experience fast and flexible while making recommendations more medically grounded.

## Running The Project Locally

The actual app lives inside the `clinic-assistant-mvp` folder.

### 1. Go to the app folder

```bash
cd "/Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp"
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env.local`

Add this file at:

`clinic-assistant-mvp/.env.local`

Example:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

PUBLIC_BASE_URL=https://your-ngrok-subdomain.ngrok-free.dev

ANTHROPIC_API_KEY=sk-ant-...

ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

Notes:

- `ANTHROPIC_API_KEY` is required for triage
- `PUBLIC_BASE_URL` must be publicly reachable by Twilio
- ElevenLabs variables are optional if you want to fall back to Twilio voice
- `.env.local` is ignored by git and should not be committed

### 4. Start the app

```bash
npm run dev
```

By default Next will try port `3000`.

### 5. Start ngrok for Twilio callbacks

In another terminal:

```bash
ngrok http 3000
```

Then set:

```env
PUBLIC_BASE_URL=https://your-current-ngrok-domain.ngrok-free.dev
```

Restart `npm run dev` after changing `.env.local`.

## Local Test Flow

1. Start the app
2. Start ngrok
3. Confirm `PUBLIC_BASE_URL` matches the live ngrok URL
4. Enter patient details, phone number, location, and symptoms
5. Complete the triage conversation
6. Continue to clinic search
7. Start the call
8. Answer the phone and let the Twilio booking flow run
9. Watch the live call transcript on screen
10. Verify the confirmation page and SMS status

## Key Files

- `clinic-assistant-mvp/src/app/page.tsx`
- `clinic-assistant-mvp/src/app/confirmation/page.tsx`
- `clinic-assistant-mvp/src/app/api/triage/route.ts`
- `clinic-assistant-mvp/src/app/api/clinics/route.ts`
- `clinic-assistant-mvp/src/app/api/call/route.ts`
- `clinic-assistant-mvp/src/app/api/call/transcript/route.ts`
- `clinic-assistant-mvp/src/app/api/twilio/voice/route.ts`
- `clinic-assistant-mvp/src/app/api/appointment/confirm/route.ts`
- `clinic-assistant-mvp/src/app/components/body-heatmap.tsx`
- `clinic-assistant-mvp/PROJECT_LOG.md`

## Current Limitations

- Appointment storage is in memory only
- Local Twilio development still depends on ngrok
- Clinic lookup can fall back when OpenStreetMap services are slow or unavailable
- The outbound demo call currently uses a hardcoded destination number in the backend
- Claude triage still depends on Anthropic availability and rate limits

## Disclaimer

CarePilot does not provide diagnosis or replace professional medical judgment.

If symptoms are severe, unsafe, or rapidly worsening, patients should seek emergency care immediately or call emergency services.
