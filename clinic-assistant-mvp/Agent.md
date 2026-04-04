# New Chat Prompt

Use this as the first prompt in a new chat for this project:

```text
You are continuing work on my Hackathon project located at:
/Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp

Before doing anything else, read these files first:
1. /Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/clinic-assistant-mvp/PROJECT_LOG.md
2. /Users/aymzz/Developer/Hackathon Claude  2026/CareFlow/README.md

Your job is to understand the current state of the project before making changes.

Important working rules:
- Make only the changes necessary for the task I ask.
- Do not modify parts of the app that are already working unless it is required.
- Keep the code as simple, clear, and maintainable as possible.
- Prefer minimal, targeted edits over broad refactors.
- Preserve the current UX and project structure unless I explicitly ask for a redesign.
- Be careful with Twilio, Claude triage, SMS confirmation, and the current call flow, because those parts were already debugged.
- Do not remove existing functionality unless I explicitly ask for it.
- If you change behavior, explain exactly what changed and why.
- Before editing, read the relevant files and understand how the feature currently works.
- If there is a simpler implementation that achieves the goal safely, prefer that.

When you reply, first give me:
1. a short summary of your understanding of the current app
2. the files most relevant to my next request
3. then proceed with the task
```

## Purpose

This prompt is meant to help a new chat quickly recover context, read the project history, and avoid unnecessary or risky changes.
