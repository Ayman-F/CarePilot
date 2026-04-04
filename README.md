# CareFlow 🩺  
**A real-world clinic booking assistant built with voice automation and modern UX**

CareFlow is a hackathon-built MVP that demonstrates how **frontend engineering, product thinking, and voice automation** can reduce friction in healthcare appointment booking.

The project focuses on **clear UX**, **deterministic logic**, and **real phone-based workflows** rather than speculative AI features.

---

## 🧠 Problem

Booking a medical appointment is often slow and frustrating:
- Long wait times on the phone  
- Unclear clinic availability  
- Poor feedback after booking  

CareFlow explores how a **guided digital flow + automated phone calls** can streamline this experience.

---

## ✅ Solution

CareFlow guides a user through a complete booking flow:

1. Collects patient and symptom information  
2. Finds the closest clinics based on location  
3. Automatically calls clinics to check availability  
4. Confirms appointment details  
5. Presents a clear post-booking summary and safety guidance  

The entire flow is designed to feel **calm, professional, and trustworthy**, similar to real medical platforms like Clic Santé or TELUS Santé.

---

## ✨ Key Features

### Product & UX
- Step-based booking wizard (single-page, no reloads)
- Dynamic progress indicator
- Micro-feedback during async actions (calling, loading, confirming)
- Auto-scroll and focus management
- Clear completion state with “Book another appointment”
- Fully responsive, production-style UI

### Engineering
- Deterministic, rule-based medical severity assessment
- Real outbound phone calls using Twilio
- Natural voice output using ElevenLabs
- Strong separation of concerns (UI, logic, voice)
- No backend over-engineering
- No silent failures or ambiguous states

---

## 🛠 Tech Stack

### Frontend
- **Next.js 16**
- **React 19**
- **TypeScript**
- **Tailwind CSS**

### Voice & Telephony
- **Twilio** – real outbound phone calls
- **ElevenLabs** – low-latency text-to-speech

### Architecture Choices
- Single-page wizard instead of multi-route complexity
- Deterministic logic over opaque AI for safety-critical decisions
- Frontend-driven UX polish over backend-heavy design

---

## 🧩 Design Decisions (What this project demonstrates)

- **Product sense**: knowing when *not* to add complexity  
- **UX thinking**: no dead ends, no “refresh to continue”  
- **Engineering judgment**: deterministic rules for healthcare safety  
- **Pragmatism**: built for demo reliability, not hype  

This project intentionally avoids:
- speculative AI diagnoses  
- unnecessary backend abstractions  
- fragile multi-page flows  

---

## ⚠️ Disclaimer

> **This application does not provide medical advice.**  
> If symptoms are severe or feel unsafe, users are advised to seek emergency care or call emergency services immediately.

---


## Setup🚀

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
