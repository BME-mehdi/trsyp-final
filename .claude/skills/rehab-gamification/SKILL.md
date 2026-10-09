---
name: rehab-gamification
description: Rules for motivation and gamification features in the SymbioMed patient app (TKA rehab, patients aged 55 to 85, NMES brace). Read before adding streaks, badges, progress visuals, celebrations or encouraging copy.
---

# Rehab gamification for SymbioMed

The goal is adherence: two seated NMES sessions a day for six weeks, rated after each one. Motivation features exist to make that routine feel visible and worth it. They must never push a patient to do more, hurt more or hide a problem.

## Reward behaviours, never doses

Reward: showing up, completing a session, rating it, doing the checklist, a full day, a full week, coming back after a break.

Never reward or rank: intensity (mA), pain tolerated, number of contractions above the plan, extra sessions, shorter rest, knee bend beyond the clinician's goal. A patient who plays for points must only be able to do more of what the plan already asks.

## Forgiveness by default

- A missed day is neutral. No loss messages, no red X, no "you broke your streak".
- Days with a pain stop, a STOP press, an expired plan, a device fault or a rest day are protected: they never break a streak.
- High pain (4/10 or more) replaces any celebration with the existing safety guidance.
- Coming back after a gap gets a welcome, not a penalty.

## What fits this population (55 to 85, after knee surgery)

- Calm progress: rings, a week-by-week journey path, gentle fills. Think habit app, not arcade.
- One clear next action per screen, large targets, text always next to any icon or visual.
- Celebrations are short (under 1 s), off with reduce motion, paired with a light haptic and one sentence.
- Adult, warm copy. Short sentences. No baby talk, no slang, no exclamation marks in a row.
- No leaderboards or comparison with other patients. Progress is against the patient's own start and the clinician's goal.
- No timers that pressure ("hurry", countdowns to lose a reward).

## Honesty rules

- Every number comes from session data. If data is missing, show "no data yet", never an estimate.
- Milestones tied to recovery (knee bend, walking, straight leg raise) come only from the clinician's plan or a cited protocol confirmed by the team. Otherwise use generic milestones ("Week 2 complete").
- Encouraging text never claims a medical effect ("this is healing your knee", "you are getting stronger"). Describe what the patient did ("You completed 12 sessions this week").
- The claim register in `docs/NOT_CLAIMED.md` applies to every string.

## Implementation pattern

- Badge, streak and journey logic: pure functions in `packages/domain`, input = session summaries and plan, output = state. Unit tests for every protected-day rule.
- Strings: `packages/i18n`, English and French together.
- Motion: one hook that returns static values when reduce motion is on.
- Before shipping a feature, check: can a patient be harmed by chasing this reward? If yes, redesign it.
