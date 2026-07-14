# Knowledge Hub Audit

Date: 2026-07-13

## Current Verdict

The first Knowledge Hub version had the right structural idea, but it was not useful enough for daily operations or staff onboarding.

After this pass, it is closer to a real task assistant: search a real problem, open one precise guide, see the exact screen, follow exact steps, and know when the task is done. It is still not finished training content. The next bar is longer, deeper recordings with realistic state transitions, not just quick screen confirmations.

## What Is Weak

- Too much is visible at once: guide list, guide summary, outcome, steps, notes, embedded video, animated demo, and sidebar all compete for attention.
- Search was too broad because it matched every word in summaries, steps, and notes. Common terms like payment, customer, and booking returned too many guides.
- Several guide steps were vague. They described the area instead of saying exactly what to open, verify, do, and treat as complete.
- The original videos were schematic mockups, not real UI screenshots or screen recordings. They helped explain the idea, but did not prove how the app really works.
- Voiceover originally used local macOS speech synthesis. That is acceptable for a prototype, not for polished customer/operator training.
- Export scripts originally only targeted one guide by default and did not support batch per-guide video generation.

## What Was Improved In This Pass

- Search now uses weighted matching across title, route, category, and curated tags instead of searching every word in the guide body.
- The page now defaults to a checklist tab and keeps video in a separate tab to reduce information overload.
- Result cards are more compact; inactive results no longer show full summaries.
- Guide copy was rewritten toward SOP-style instructions.
- Each guide now has `beforeStart`, `doneWhen`, and `escalateIf` fields so operators get completion and stop conditions.
- Higgsfield CLI was installed, authenticated, workspace-selected, and tested.
- Voiceover export now supports Higgsfield `text2speech_v2` with the `Sterling` preset voice.
- Scripts now support all-guide asset export and all-guide MP4 rendering.
- A Playwright capture script now records actual customer and dashboard UI into `demo-output/real-ui`.
- A real-video renderer now converts captured WebM files into captioned, downloadable MP4s in `public/knowledge-videos`.
- The full platform demo was replaced with a stitched real UI walkthrough and Higgsfield Sterling voiceover.

## What Still Needs To Be Much Better

1. Deeper real screen captures

   The current captures prove the real UI renders and produce usable MP4s, but most are short. Training-grade recordings should show the actual click path through each workflow, not just the landing screen for that area.

2. Per-guide recordings with operational depth

   The current pass exports MP4 and caption files for these core guides:

   - Customer booking request
   - Booking queue approval
   - Booking detail lifecycle
   - Fleet availability
   - Calendar and check-ins
   - Payments, deposits, refunds
   - Insurance review
   - Customer/portal/long-term workflow
   - Messaging and notification workflow
   - Revenue/reporting workflow
   - Settings/webhook/system health workflow

   Still missing depth: the customer confirmation/payment flow needs to be recorded through agreement, license, insurance, and payment completion rather than stopping around vehicle detail and request context.

3. More precise SOP content per screen

   Each guide now includes:

   - Before you start
   - Steps
   - Done when
   - Escalate if

   Next improvement: split long or risky guides into smaller screen-specific SOPs when one guide contains more than one operational decision.

4. Real data states

   Training recordings need realistic seeded states:

   - Pending booking
   - Approved but unpaid booking
   - Agreement due
   - Active rental
   - Returned rental needing inspection/deposit settlement
   - Failed payment or webhook
   - Insurance pending/rejected/approved

5. Better in-app search UX

   Search should show why a result matched, not just the guide title. Example: `matched: payment due, deposit, refund`.

6. Operator confidence checks

   Add "Do not proceed if..." blockers to money, insurance, pickup, return, and system-health guides.

7. Screenshot and video freshness

   The capture pipeline should regenerate screenshots/videos from the live codebase so training does not drift away from the product.

## Proposed Capture Pipeline

Use Playwright, not AI-generated UI, for screen recordings:

1. Start the customer site and dashboard in local dev mode.
2. Attach route mocks using the existing customer and dashboard e2e fixture patterns.
3. For each guide, run a scripted journey with deliberate pauses, cursor movement, and clicks.
4. Record browser video and capture key screenshots.
5. Generate narration text from the guide steps.
6. Generate voiceover through Higgsfield `text2speech_v2` using the `Sterling` preset.
7. Merge screen recording, captions, and voiceover with ffmpeg.
8. Save outputs into `public/knowledge-videos/{guideId}.mp4` and `public/knowledge-videos/{guideId}.vtt`.

Current commands:

- `npm run capture:knowledge:real`
- `npm run video:knowledge:real`
- `npm run video:knowledge:real:full`
- `npm run video:knowledge:real:voice` only when you intentionally want Higgsfield voiceover for every guide.

## Acceptance Bar

A guide is useful only when a new operator can:

- Search a normal term and find the right guide in the top 3 results.
- Watch a real UI recording for the task.
- Follow the checklist without asking where to click.
- Know when the task is complete.
- Know when to stop and escalate.
