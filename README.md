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
