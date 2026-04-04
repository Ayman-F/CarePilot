# CareFlow

CareFlow is a healthcare booking assistant MVP built for a hackathon. It combines conversational triage, clinic lookup, outbound phone booking, and SMS confirmation in a single Next.js app.

The current experience is:

1. User enters patient details, including phone number
2. User chats with Claude for short multi-turn triage
3. Claude returns urgency, recommendations, and wait-care tips
4. User explicitly continues to clinic search
5. App finds nearby clinics
6. User starts an outbound Twilio call to book an appointment
7. Twilio voice flow captures appointment timing
8. App saves the appointment and attempts an SMS confirmation
9. Dashboard shows appointment details and SMS status

## Problem

Booking a medical appointment can be slow, unclear, and stressful. Patients often have to:

- describe symptoms without guidance
- search for clinics manually
- call clinics one by one
- keep track of confirmation details themselves

CareFlow explores a calmer booking flow that gives guidance before booking, automates the clinic call, and surfaces a clean confirmation state afterward.

## What The App Does

### Claude triage chat

- Uses Anthropic Claude for multi-turn symptom triage
- Asks follow-up questions when needed
- Returns a structured final result with:
  - urgency level
  - summary paragraph
  - recommendations
  - what to do while waiting
- Shows stronger warning states for severe cases
- Does not auto-jump to clinics until the user explicitly continues

### Clinic lookup

- Searches for nearby clinics based on user location
- Uses OpenStreetMap geocoding / Overpass lookup
- Falls back to hardcoded Montreal clinics if lookup fails

### Outbound phone booking

- Uses Twilio to place a real outbound call
- Runs a server-side Twilio voice flow to:
  - ask whether there is availability
  - capture date / time
  - repeat patient name
  - repeat health card number
  - ask whether the details were noted
- The opening phone prompt includes a short pause before speaking

### Voice options

- Supports Twilio built-in voice output
- Supports optional ElevenLabs TTS for higher-quality prompts
- Can fall back to Twilio voice if ElevenLabs is disabled or unavailable

### Appointment confirmation

- Stores the most recent appointment confirmation in memory
- Attempts to send an SMS confirmation via Twilio to the patient phone number
- Shows a confirmation box in the dashboard with:
  - patient name
  - clinic name
  - appointment date / time
  - SMS delivery status

## Current Feature Summary

- Single-page booking flow
- Patient info capture
- Required phone number for SMS confirmation
- Claude-powered multi-turn triage
- Explicit continue-to-clinic step
- Nearby clinic search
- Twilio outbound booking call
- Optional ElevenLabs phone voice
- Character-by-character spelling of name and health card during confirmation
- Appointment confirmation dashboard
- SMS confirmation to the patient

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### AI

- Anthropic Claude API for triage conversation

### Voice and telephony

- Twilio for outbound calls and SMS
- ElevenLabs for optional text-to-speech

### Data / services

- OpenStreetMap Nominatim
- Overpass API

## Architecture Notes

- The app is a single Next.js project
- Triage is AI-driven, but booking flow logic is still app-controlled
- Appointment confirmation is stored in memory only
- Twilio handles calling and speech collection
- ElevenLabs is optional and only used for voice generation

## Important Current Limitations

### In-memory appointment storage

Appointment confirmations are not persisted to a database. Restarting the dev server clears them.

### Local development depends on a public callback URL

For Twilio to reach local API routes, `PUBLIC_BASE_URL` must point to a live ngrok URL.

### Selected clinic dialing is still not fully dynamic

The current call route still uses a hardcoded outbound destination number in the backend, so the selected clinic card is not yet guaranteed to be the true number being dialed.

### AI triage depends on Anthropic availability

If Claude is unavailable or misconfigured, triage will surface an explicit error instead of falling back silently.

## Disclaimer

This application does not provide medical advice or diagnosis. If symptoms are severe, unsafe, or urgent, users should seek emergency care or call emergency services immediately.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

In `clinic-assistant-mvp/.env.local` add:

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

- `PUBLIC_BASE_URL` must be publicly reachable by Twilio
- `ANTHROPIC_API_KEY` is required for Claude triage
- ElevenLabs variables are optional if you want to use Twilio built-in voice instead

### 3. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`

### 4. Expose local callbacks for Twilio

If you are developing locally, run:

```bash
ngrok http 3000
```

Then set:

```env
PUBLIC_BASE_URL=https://your-current-ngrok-domain.ngrok-free.dev
```

Restart the app after changing env vars.

## Local Test Flow

1. Start `npm run dev`
2. Start `ngrok http 3000`
3. Verify `PUBLIC_BASE_URL` matches the live ngrok URL
4. Enter patient details, location, and symptoms
5. Complete the Claude triage chat
6. Click `Continue to clinic search`
7. Start the clinic call
8. Answer the phone and complete the booking
9. Check the dashboard confirmation box
10. Check whether the patient phone received the SMS confirmation

## Key App Files

- [`clinic-assistant-mvp/src/app/page.tsx`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/page.tsx)
- [`clinic-assistant-mvp/src/app/api/triage/route.ts`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/api/triage/route.ts)
- [`clinic-assistant-mvp/src/app/api/clinics/route.ts`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/api/clinics/route.ts)
- [`clinic-assistant-mvp/src/app/api/call/route.ts`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/api/call/route.ts)
- [`clinic-assistant-mvp/src/app/api/twilio/voice/route.ts`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/api/twilio/voice/route.ts)
- [`clinic-assistant-mvp/src/app/api/appointment/confirm/route.ts`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/api/appointment/confirm/route.ts)
- [`clinic-assistant-mvp/src/app/api/tts/route.ts`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/src/app/api/tts/route.ts)
- [`clinic-assistant-mvp/PROJECT_LOG.md`](/Users/aymzz/Developer/Hackathon%20Claude%20%202026/CareFlow/clinic-assistant-mvp/PROJECT_LOG.md)
