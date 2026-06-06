# EduOps AI — Agent Rules

You are building **EduOps AI**, a mobile-first multi-tenant SaaS for Indian schools, coaching centres, preschools and tuition centres.

## Core Principles (Non-negotiable)

- Mobile-first: Every critical flow must work excellently on 5–6 inch Android screens with large touch targets.
- Strict multi-tenant isolation: No data from one institution can ever be visible to another. Enforce at data layer.
- Production quality: Clean TypeScript, proper error handling, optimistic UI where it makes sense, and clear architecture.
- Indian context: Use ₹, DD/MM/YYYY dates, +91 phone numbers, realistic Indian names in demos, and respect local workflows (WhatsApp is primary communication channel).
- Complete vertical slices: Finish one full feature (DB + backend + UI + basic validation) before moving to the next.

## Working Style

- Plan first. Think step by step and share a short plan before writing code.
- Be extremely terse. No fluff, no praise, no unnecessary explanations.
- Output only what is asked. Do not add extra suggestions unless requested.
- Prefer small, focused, well-named components and functions.
- Use clear file structure and consistent naming.

## Token Efficiency Rules

- Keep responses concise and high-signal.
- Do not repeat project context or rules unless explicitly asked.
- When working on a specific module, only reference files relevant to that module.
- Prefer editing existing files over rewriting large sections.
- Use `/compact` mindset internally — stay focused on the current task.

## Key Constraints

- Attendance marking for a class of 40 students must be possible in under 60 seconds on mobile.
- Fee module must handle complex Indian structures (monthly/quarterly/annual, late fees, partial payments, sibling discounts, transport fees).
- Parent communication primarily happens via WhatsApp (with fallback to SMS/email).
- Onboarding must feel self-serve and fast (under 10 minutes for a school admin).
- Role-based access must be flexible but secure (owner, admin, teacher, parent, accountant).

## Output Rules

When making changes:
1. Start with a short plan (2–4 lines).
2. Show complete files when creating or significantly modifying them.
3. After implementation, provide a short manual test checklist.
4. Never leave broken or incomplete code.

## Current Focus (MVP)

Priority order:
1. Authentication + Institution onboarding
2. Student & Class/Batch management
3. Attendance (fast mobile marking + history)
4. Fee Management (invoices, payments, Razorpay, reminders)
5. Admission CRM (leads + pipeline)
6. Dashboard with actionable insights

Only work on Phase 2+ features after the above are solid.

## What Not To Do

- Do not over-engineer early.
- Do not add unnecessary libraries or complex abstractions.
- Do not assume desktop-first UX.
- Do not leak tenant data under any circumstance.
- Do not write verbose or explanatory comments unless the logic is genuinely complex.
