# AGENTS.md

## Project Overview
Lightweight MVP web app for the Dialogue (medical clinic) hackathon challenge.

## Core Requirements
- Chat-style symptom input.
- Non-diagnostic, safe triage guidance.
- Decide if clinic appointment is needed.
- Show a short list of nearby clinics.
- Trigger outbound phone call to clinic (test number / teammate) via telephony + TTS.
- Return a short call summary after the call ends.
- Demo-first; not production healthcare software.

## Constraints
- Ship vertical slices; implement one slice fully before starting the next.
- Prefer mocks first; replace only if needed.
- Avoid over-engineering; keep code minimal and readable.
- No real-time bidirectional voice unless explicitly requested.
- Keep app working at all times.
- Modify as few files as possible.
- Prefer direct implementations over refactors.
- Stop once the requested slice is complete.

## Current Stack
- Next.js (TypeScript)
- Simple React components (no complex state management)
- LLM API (Gemini or OpenAI) for triage (structured JSON output)
- Twilio Voice API for outbound calls
- TTS: Twilio built-in voice
- Clinics data: mock JSON initially
- No database initially (optional later)

## Safety Rules (Mandatory)
- Do NOT provide medical diagnoses.
- Provide only general guidance and escalation.
- If severe symptoms detected (e.g., chest pain, breathing issues):
  - Show an emergency message.
  - Do NOT place a call.
- Always display:
  - "⚠️ This is not medical advice. If this is an emergency, call 911."

## MVP Definition (Done =)
A user can:
- Enter symptoms + location.
- Receive safe triage result.
- See 3 suggested clinics.
- Click "Call clinic" to trigger outbound phone call to a test number.
- See a simple call summary after the call ends (can be mocked).

## Workflow Notes
- Wait for user instruction per slice.
- Clearly list files created/modified and how to run/test after each slice.
