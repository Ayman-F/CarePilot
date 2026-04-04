# Clinic Assistant MVP

Demo-first medical clinic booking MVP built with Next.js (App Router). It supports:
- Symptom intake + location
- Deterministic safety assessment (no LLMs)
- Nearby clinic discovery (OpenStreetMap)
- Real outbound calls via Twilio
- Interactive voice flow with ElevenLabs TTS
- Appointment confirmation display

## Stack
- Next.js + React + TypeScript
- Tailwind CSS
- OpenStreetMap Nominatim + Overpass API
- Twilio Voice
- ElevenLabs TTS

## Features
- Safe, non-diagnostic triage (rule-based keywords)
- 3 closest clinics (always show address + phone)
- Call clinic CTA (Twilio outbound call)
- Interactive voice flow (Gather speech)
- Appointment confirmation UI

## Setup

### 1) Install
```bash
npm install
```

### 2) Environment variables
Create `.env.local` in the project root:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

PUBLIC_BASE_URL=https://your-ngrok-subdomain.ngrok-free.dev

ELEVENLABS_API_KEY=sk_XXXXXXXXXXXXXXXXXXXXXXXXXXXX
ELEVENLABS_VOICE_ID=your_voice_id
```

Notes:
- `PUBLIC_BASE_URL` must be a public URL reachable by Twilio (use ngrok for local dev).
- ElevenLabs is used for all voice generation.

### 3) Run
```bash
npm run dev
```
Open http://localhost:3000

## Local dev with ngrok
```bash
ngrok http 3000
```
Copy the HTTPS URL into `PUBLIC_BASE_URL` and restart `npm run dev`.

## API Routes (summary)
- `POST /api/triage`
  - Input: `{ symptoms, location }`
  - Output: deterministic safety assessment JSON.
- `POST /api/clinics`
  - Input: `{ location }`
  - Output: closest clinics with address + phone + distance.
- `POST /api/call`
  - Input: `{ clinicName, clinicAddress, symptomsSummary, patientName, healthCardNumber }`
  - Triggers outbound call to demo number via Twilio.
- `POST /api/twilio/voice`
  - Twilio webhook for the interactive voice flow (TwiML).
- `GET /api/tts?text=...`
  - ElevenLabs TTS audio (mp3).
- `POST/GET/DELETE /api/appointment/confirm`
  - In-memory storage for the latest confirmed appointment.

## Safety
This is a demo MVP. It does not diagnose or provide medical advice.
Always display: "This is not medical advice. If this is an emergency, call 911."

## Demo Flow (happy path)
1) Enter patient info + location
2) Enter symptoms and send
3) Review clinics and call
4) Complete the voice flow
5) See appointment confirmation + safety assessment

## Scripts
```bash
npm run dev
npm run build
npm run start
```
