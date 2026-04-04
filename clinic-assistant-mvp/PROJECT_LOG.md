# PROJECT_LOG

## Project Identity

- Project name: `clinic-assistant-mvp`
- Stack:
  - Next.js 16
  - React 19
  - TypeScript
  - Tailwind CSS
  - Twilio for outbound voice calls and SMS
  - Anthropic Claude API for conversational triage
  - ElevenLabs optional TTS layer for phone voice prompts

## High-Level Goal

This project is a healthcare booking assistant MVP.

Current intended user flow:

1. User enters patient identity details
2. User chats with Claude for triage
3. Claude returns urgency + recommendations + wait-care tips
4. User manually continues to clinic search
5. User selects a clinic and starts a Twilio outbound call
6. Twilio phone flow captures appointment date/time
7. Appointment is stored locally in memory
8. Confirmation SMS is sent to the patient phone number
9. Confirmation details are shown in the dashboard

## Current Folder Reality

There were two similar hackathon folders discovered during work:

- `Hackathon Claude Builder Club 2026/...`
- `Hackathon Claude  2026/...`

The active working project is the one with the double space:

- `/Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp`

This matters because earlier environment variable confusion came from editing/running the wrong copy.

## Important Runtime / Environment Setup

### Required runtime tools

- Node.js / npm installed locally on the Mac
- Homebrew installed
- ngrok installed and authenticated if running locally with Twilio callbacks

### Current important env vars

The app depends on:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `PUBLIC_BASE_URL`
- `ANTHROPIC_API_KEY`

Optional:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`

### Local Twilio callback requirement

When running locally:

- Next app runs on local port `3000`
- ngrok must expose the app publicly
- `PUBLIC_BASE_URL` must match the current live ngrok HTTPS URL

If `PUBLIC_BASE_URL` is stale or placeholder text, Twilio voice webhooks fail.

## Major Features Implemented So Far

### 1. Full project understanding and run guidance

What was established:

- the app is a single Next.js app, not a multi-service monorepo
- main frontend lives in `src/app/page.tsx`
- voice flow lives in `src/app/api/twilio/voice/route.ts`
- clinic lookup lives in `src/app/api/clinics/route.ts`
- call initiation lives in `src/app/api/call/route.ts`
- appointment persistence lives in `src/app/api/appointment/confirm/route.ts`

### 2. Local machine setup help

Completed:

- identified that the new Mac did not have `node`, `npm`, or Homebrew available initially
- guided Homebrew install
- guided Node setup
- guided ngrok setup and auth token installation
- clarified where tools install on macOS and how they interact with the project

### 3. Twilio voice booking flow debugging

Issues encountered and resolved:

- missing / wrong env vars
- placeholder `PUBLIC_BASE_URL`
- ngrok offline / invalid token
- Twilio webhook failures
- ElevenLabs causing voice route failures

Key outcome:

- Twilio call flow is functioning
- first prompt is reachable through the Twilio webhook
- call can progress through multi-step appointment booking

### 4. ElevenLabs integration and fallback strategy

What happened:

- `/api/tts` originally failed with generic errors
- route was improved to return provider error details
- default ElevenLabs model was updated to `eleven_flash_v2_5`
- discovered free-tier restriction on certain voice library voices
- confirmed that Twilio built-in `<Say voice="alice">` works as a fallback

Important practical result:

- the call flow can work without ElevenLabs
- ElevenLabs is optional for better voice quality, not required for booking logic

### 5. Twilio voice flow customization

Implemented voice-flow changes:

- conservative latency improvement:
  - gather timeout reduced from `8` to `4`
  - speech timeout reduced from `auto` to `2`
- added 3-second pause before the very first spoken prompt after pickup
- added repeated reading of:
  - patient name
  - health card number
- added explicit secretary confirmation:
  - asks if details were noted
  - accepts yes / no style responses
  - repeats when asked again

Speech formatting changes:

- health card number is spoken character-by-character
- patient name is spoken character-by-character
- spaces become pauses
- hyphens become `dash`

### 6. Claude multi-turn triage feature

The old deterministic keyword-only triage route was replaced.

Current behavior:

- frontend sends chat history + location to `/api/triage`
- backend calls Anthropic Claude
- Claude can either:
  - ask a short follow-up question
  - return a final triage result

Current Claude response shape:

- `status`
- `assistant_message`
- `gravity_level` for final result
- `recommendations`
- `summary_paragraph`
- `wait_care_tips`
- `emergency_warning`

Current frontend behavior:

- uses the existing conversation panel
- supports multi-turn symptom discussion
- does not auto-jump to clinics after final triage
- shows a final triage card first
- user must explicitly click `Continue to clinic search`
- severe cases show warning but still allow progression

Claude route details:

- model currently set to `claude-haiku-4-5`
- API key read from `ANTHROPIC_API_KEY`
- hard validation exists on returned JSON shape
- malformed AI output surfaces as explicit Claude-unavailable errors

### 7. SMS confirmation feature

Implemented end-to-end:

- added patient phone number input in Step 1
- phone number is now required before calling a clinic
- phone number is passed into `/api/call`
- Twilio voice route carries:
  - `phoneNumber`
  - `clinicName`
- appointment confirmation now stores:
  - date
  - time
  - patient name
  - health card number
  - patient phone number
  - clinic name
  - SMS status
  - SMS error text if sending fails

SMS sending behavior:

- uses Twilio `client.messages.create(...)`
- message is sent from `TWILIO_PHONE_NUMBER`
- SMS content includes:
  - clinic name
  - date
  - time

UI updates:

- dashboard confirmation card now shows:
  - date
  - time
  - patient name
  - clinic name
  - SMS delivery status
  - SMS error warning if sending failed

### 8. Body heatmap triage visualization

Implemented:

- final triage results can now include an optional structured body heatmap
- frontend renders a segmented human-body heatmap tied to the diagnosis
- severity coloring is visual and intuitive:
  - low = yellow
  - medium = orange
  - high = red

Current behavior:

- the body is rendered as a collection of separately colorable shapes
- each body region has its own stable identifier
- only affected areas are highlighted
- the heatmap is visual-only and does not change booking logic

Important UI result:

- triage now communicates not only urgency and recommendations
- it also shows where the issue is located on the body in a fast, glanceable way

### 9. Step 2 chat-style symptom experience

Implemented:

- merged the symptom input box and conversation panel into one single chat-style Step 2 experience
- users now feel like they are talking directly to a chatbot instead of filling a separate form then reading messages
- added a bottom chat composer while preserving the existing triage request flow

Current UX behavior:

- Step 2 starts as a chat panel
- the user sends symptoms directly in the conversation area
- follow-up questions and final triage responses stay in the same thread
- the triage result card still appears after the conversation completes

### 10. Explicit 4-step navigation and progress tracking

Implemented:

- converted the flow into a clearer explicit 4-step journey:
  1. patient info
  2. triage chat
  3. clinic search / call
  4. confirmation
- added forward / back / change navigation between steps
- added a persistent progress bar with labeled stages at the top

Current behavior:

- Step 1 can collapse into a compact summary after completion
- users can go back and revise prior steps more safely
- downstream state is reset when earlier critical inputs change
- overall transitions between steps are smoother and easier to understand

### 11. Step 2 to Step 3 transition micro-loader

Implemented:

- when the user clicks `Continue to clinic search`, the button now shows a small loading spinner
- loading copy now reads:
  - `Searching for clinics...`

Important UX result:

- the user now gets immediate feedback that clinic search has started
- this avoids the transition feeling abrupt or inactive while Step 3 begins loading

## Important Bug Fixes Already Made

### Appointment confirmation polling bug

Problem:

- the app showed `No confirmation received yet`
- polling never found a saved appointment

Root causes addressed:

1. appointment save was originally fire-and-forget from the Twilio step
2. later, an internal HTTPS self-call hit certificate issues through ngrok

Fixes made:

- appointment save logic was extracted into shared function:
  - `saveAppointment(...)`
- Twilio voice route now calls `saveAppointment(...)` directly in-process
- this removed dependency on internal `fetch` back through ngrok / self-signed certificates
- frontend polling was made less strict about optional SMS/clinic fields

### Local HTTPS self-signed certificate bug

Observed error:

- `DEPTH_ZERO_SELF_SIGNED_CERT`

Resolution:

- removed internal round-trip from Twilio route to `/api/appointment/confirm`
- switched to direct server-side function call instead

### ElevenLabs blocking call flow

Observed behavior:

- phone call said an application error occurred

Resolution path:

- tested `/api/twilio/voice?step=1`
- isolated `/api/tts`
- temporarily disabled ElevenLabs in env to fall back to Twilio built-in voice

### First-call Twilio webhook reliability / ngrok debugging

Observed behavior:

- outbound call sometimes failed on the first attempt
- Twilio console showed webhook error `11200`
- Twilio received HTTP `404` from the public ngrok callback URL

What was clarified:

- the phone call itself could be created successfully
- the failure was caused by Twilio not reaching `/api/twilio/voice` through the active public URL
- local callback reliability depends on:
  - correct ngrok tunnel
  - correct `PUBLIC_BASE_URL`
  - restarting the app after updating `.env.local`

### Voice-flow save hardening

Implemented:

- Twilio voice booking save logic was made more fault-tolerant
- appointment save failures during the voice flow are now logged with more useful backend detail
- save is retried safely at final confirmation instead of immediately ending the call with a vague application error

## Current Key Files and Their Roles

### `src/app/page.tsx`

Current responsibilities:

- patient info form
- phone number capture
- Claude triage chat UI
- body heatmap display for final triage
- clinic lookup continuation
- explicit step navigation and progress bar
- clinic calling action
- appointment polling
- dashboard confirmation box with SMS status

### `src/app/api/triage/route.ts`

Current responsibilities:

- receive triage chat history
- call Anthropic Claude
- validate Claude structured output
- return either:
  - follow-up question
  - final triage result

### `src/app/api/call/route.ts`

Current responsibilities:

- validate booking call request
- create Twilio outbound call
- pass patient name, health card, phone number, clinic name into Twilio voice route
- trim env vars before creating callback URL
- always call the demo hardcoded destination number

### `src/app/api/twilio/voice/route.ts`

Current responsibilities:

- manage all call steps
- ask availability questions
- parse dates/times
- repeat identity details
- ask secretary confirmation
- save appointment after time capture
- retry / harden appointment save during voice flow
- no longer calls appointment route over HTTPS internally

### `src/app/api/appointment/confirm/route.ts`

Current responsibilities:

- store latest appointment in memory
- send SMS confirmation via Twilio
- expose GET endpoint for frontend polling
- expose DELETE endpoint to clear prior appointment before starting a new call

### `src/app/api/tts/route.ts`

Current responsibilities:

- optional ElevenLabs TTS audio generation
- returns useful error details when provider rejects request

## Current Known Constraints / Caveats

### 1. In-memory appointment storage

Appointments are stored in memory only.

That means:

- a server restart clears the confirmation
- not suitable for real persistence
- acceptable for MVP / demo

### 2. Hardcoded call destination

`src/app/api/call/route.ts` still uses a hardcoded destination number:

- `DESTINATION_NUMBER = "+14385068854"`

This means the selected clinic card is not actually called by its displayed phone number.
The clinic selection is currently more of a UI / workflow step than a real dynamic outbound destination.

### 3. Local dev latency still exists

Even with optimizations, local phone latency is still affected by:

- ngrok tunnel
- local machine hosting
- ElevenLabs generation time when enabled
- webhook round trips

### 4. Twilio / SMS operational caveats

SMS can still fail because of:

- Twilio messaging permissions
- invalid destination format
- account restrictions
- carrier / region / verified-number constraints

The app now handles this by preserving the appointment and surfacing SMS status instead of blocking confirmation.

### 5. Claude cost / availability dependency

Current triage now depends on Anthropic API availability.

No silent fallback to deterministic triage currently exists.

If Claude is unavailable, the UI shows an explicit error.

## Recent UX Decisions That Are Intentionally Preserved

- keep the current layout instead of redesigning the page
- keep clinic lookup and call flow as separate existing steps
- require explicit user action to continue from triage to clinic search
- show warnings for severe cases but still allow booking flow continuation
- keep SMS optional from a success perspective:
  - appointment confirmation should not fail if SMS fails
- keep clinic calling in demo mode:
  - always dial the hardcoded test number, not the real clinic phone

## How To Run Locally

From the app root:

```bash
cd "/Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp"
npm run dev
```

To support Twilio callbacks locally:

```bash
ngrok http 3000
```

Then set:

- `PUBLIC_BASE_URL=https://<your-ngrok-domain>`

and restart `npm run dev`.

## Current Manual Test Flow

1. Start app locally
2. Start ngrok
3. Ensure `PUBLIC_BASE_URL` matches current ngrok URL
4. Enter:
   - full name
   - health card number
   - phone number
   - location
   - symptoms
5. Complete Claude triage conversation
6. Click `Continue to clinic search`
7. Click `Call clinic`
8. Answer the phone
9. Let Twilio collect availability
10. After appointment time is captured:
    - appointment should confirm in dashboard
    - SMS should attempt delivery
    - confirmation card should show SMS status

## Pending / Possible Next Improvements

These are not yet implemented, but they were discussed or are natural next steps:

- deploy app publicly to reduce voice latency and remove ngrok dependency
- optionally switch live phone flow fully to Twilio built-in voice for speed
- shorten long voice prompts, especially confirmation prompts
- possibly make TTS strategy hybrid:
  - static / cached audio for repeated prompts
  - dynamic generation only when needed
- replace hardcoded destination clinic number with real selected clinic phone routing
- add persistent storage if the project moves beyond demo state

## Current Git/Workspace Snapshot

Observed modified files during logging:

- `clinic-assistant-mvp/package-lock.json`
- `clinic-assistant-mvp/src/app/api/appointment/confirm/route.ts`
- `clinic-assistant-mvp/src/app/api/call/route.ts`
- `clinic-assistant-mvp/src/app/api/triage/route.ts`
- `clinic-assistant-mvp/src/app/api/tts/route.ts`
- `clinic-assistant-mvp/src/app/api/twilio/voice/route.ts`
- `clinic-assistant-mvp/src/app/page.tsx`

Untracked / unrelated:

- `.DS_Store`

## Practical Summary

At this point, the app has moved well beyond the original static MVP.

The current build now includes:

- conversational AI triage with Claude
- chat-style symptom conversation UI
- body heatmap visualization for diagnosis areas
- explicit 4-step booking navigation with progress bar
- clinic lookup continuation after triage
- smoother transition loader when moving into clinic search
- outbound Twilio call booking flow
- custom secretary confirmation logic
- repeated spelling of patient details
- configurable TTS path with Twilio fallback
- automatic SMS appointment confirmation
- dashboard confirmation status including SMS outcome

The most important architectural reality to remember is:

- triage is now AI-driven
- booking confirmation is still stored in memory
- voice and SMS rely on Twilio
- local development still depends on ngrok
