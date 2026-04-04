# PROJECT_LOG

## Project Identity

- Product name: `CarePilot`
- Repo app folder: `clinic-assistant-mvp`
- Stack:
  - Next.js 16
  - React 19
  - TypeScript
  - Tailwind CSS
  - Anthropic Claude API
  - Twilio voice + SMS
  - ElevenLabs optional TTS
  - OpenStreetMap / Overpass clinic lookup

## Product Goal

CarePilot is a triage-and-booking assistant designed to help patients reach the right clinic faster without defaulting every uncertain case to emergency care.

Core intent:

- improve front-door medical triage
- reduce unnecessary emergency overload
- route non-emergency users toward appropriate nearby clinics
- give patients useful medical guidance while they wait
- reduce booking friction by automating the clinic call

This is not a diagnosis system. It is a careful routing and booking workflow with medical guidance boundaries.

## Current User Flow

1. User enters patient identity, phone number, and location
2. User chats with Claude in Step 2 for triage
3. Claude returns urgency, recommendations, wait-care guidance, and optional body heatmap
4. User explicitly continues to clinic search
5. App finds nearby clinics or uses fallback clinics
6. User starts a Twilio outbound booking call
7. Live phone conversation appears on screen during the call
8. Appointment date/time is captured and saved in memory
9. App attempts SMS confirmation
10. User is redirected to a dedicated confirmation page

## Important Runtime / Local Setup Notes

### Working project path

Active local app:

- `/Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp`

### Local run commands

From the app root:

```bash
cd "/Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp"
npm install
npm run dev
```

For Twilio local callbacks:

```bash
ngrok http 3000
```

Then set:

- `PUBLIC_BASE_URL=https://<your-ngrok-domain>`

and restart the dev server.

### Required env vars

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `PUBLIC_BASE_URL`
- `ANTHROPIC_API_KEY`

Optional:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`

### Security note

- `.env.local` is ignored by git
- secrets should never be committed

## Major Product Features Implemented

### 1. Claude-powered multi-turn triage

Current behavior:

- Step 2 is a real chat-style symptom conversation
- Claude can ask short follow-up questions
- final triage returns:
  - urgency level
  - assistant summary
  - recommendations
  - wait-care tips
  - emergency warning
  - optional body heatmap

Why it matters:

- patients get guidance before booking
- triage helps determine whether clinic care is appropriate
- severe cases still surface emergency warnings clearly

### 2. Body heatmap visualization

Implemented:

- final triage can highlight affected body areas
- severity is color-coded:
  - low = yellow
  - medium = orange
  - high = red

Current UI result:

- symptom severity is easier to understand at a glance
- the triage output feels more medical and less text-only

### 3. Explicit 4-step booking flow

Implemented:

1. patient info
2. symptoms / triage
3. clinic search / call
4. confirmation

Also added:

- progress bar
- back / change navigation
- cleaner transitions between steps

### 4. Nearby clinic routing

Implemented:

- location-based clinic search
- live geocoding with OpenStreetMap Nominatim
- nearby clinic lookup through Overpass
- fallback clinic list if live services are unavailable

Why it matters:

- the app helps route lower-acuity users toward clinics instead of sending everyone toward emergency care

### 5. Outbound phone booking with Twilio

Implemented:

- server-side outbound call initiation
- multi-step voice flow for availability, date, time, and confirmation
- repeated reading of:
  - patient name
  - health card number
- secretary confirmation step:
  - asks whether details were noted
  - accepts yes / no style replies

### 6. Live call conversation panel

Implemented:

- while the Twilio booking call is active, the screen shows a live premium-style message thread
- prompts and recognized clinic responses appear turn by turn
- this uses a lightweight transcript store and polling endpoint

Why it matters:

- the user can follow the booking call in real time
- the experience feels more premium and transparent

### 7. Confirmation page and SMS

Implemented:

- appointment is saved in memory
- SMS delivery is attempted through Twilio
- app redirects to a dedicated confirmation page after success
- confirmation page shows:
  - appointment details
  - completed booking timeline
  - SMS status

### 8. Branding and visual polish

Implemented:

- CarePilot logo added as persistent branding
- premium blue-and-white atmospheric background treatment
- more polished success and loading states

## Important Reliability / Bug Fix Work Completed

### Twilio webhook / ngrok debugging

Problems encountered:

- stale `PUBLIC_BASE_URL`
- ngrok callback failures
- Twilio `11200` webhook issues

What was clarified:

- local Twilio reliability depends on the active ngrok tunnel and correct public callback URL

### Voice-flow appointment save hardening

Implemented:

- direct in-process appointment save from the Twilio route
- no internal HTTPS round-trip back into the app
- safer retry behavior before the call ends

### ElevenLabs fallback strategy

Implemented:

- optional TTS path remains available
- Twilio built-in voice acts as a reliable fallback

### Claude triage rate-limit hardening

Implemented:

- reduced Claude prompt footprint
- trimmed retained message history
- reduced redundant context
- cleaner user-facing messaging when Anthropic rate limits occur

## Current Key Files

### `src/app/page.tsx`

Responsibilities:

- patient form
- Step 2 chat triage UI
- clinic search UI
- call initiation
- live call conversation panel
- progress navigation

### `src/app/confirmation/page.tsx`

Responsibilities:

- post-booking confirmation experience
- booking timeline
- appointment detail display
- SMS status display

### `src/app/api/triage/route.ts`

Responsibilities:

- Claude triage request handling
- response validation
- body heatmap support
- rate-limit-aware prompt budgeting

### `src/app/api/clinics/route.ts`

Responsibilities:

- location geocoding
- clinic lookup
- fallback clinic response path

### `src/app/api/call/route.ts`

Responsibilities:

- validate booking call request
- create outbound Twilio call
- pass patient context into voice flow

### `src/app/api/twilio/voice/route.ts`

Responsibilities:

- manage Twilio voice steps
- capture date/time
- repeat identity details
- ask confirmation
- save appointment
- feed live transcript messages

### `src/app/api/call/transcript/route.ts`

Responsibilities:

- expose read-only live call transcript for the UI

## Current Constraints / Caveats

### In-memory appointment storage

- server restart clears confirmations
- acceptable for MVP
- not durable enough for production

### Hardcoded demo call destination

Current backend still uses a hardcoded destination number for demo safety.

That means:

- the selected clinic card is part of the routing UX
- but the outbound phone call is still intentionally controlled for demo behavior

### Local development dependency on ngrok

- local Twilio testing still requires a live public callback URL

### Clinic service intermittency

- public OpenStreetMap / Overpass services can occasionally fail or rate-limit
- fallback clinics are used to preserve the flow

### Anthropic dependency

- triage quality depends on Claude availability and org limits

## Current Manual Test Flow

1. Start `npm run dev`
2. Start `ngrok http 3000`
3. Verify `PUBLIC_BASE_URL`
4. Enter patient info, location, and symptoms
5. Complete triage
6. Continue to clinic search
7. Start the call
8. Watch the live call transcript
9. Wait for confirmation redirect
10. Verify SMS status

## Current Summary

The app now does significantly more than a simple booking form.

Current build includes:

- AI triage
- visual body heatmap
- clinic routing
- explicit 4-step UX
- automated phone booking
- live call transcript
- premium confirmation page
- SMS confirmation
- branded polished UI

Most important architectural reality:

- triage helps determine the right level of care
- the product is trying to reduce unnecessary emergency overload by guiding users toward the right clinic path
- booking is still demo-oriented in a few places
- persistence is still in memory
