# @symbiomed/fixtures

Synthetic data for mocks and tests, generated from fixed seeds (identical on every run). No names, no dates of birth; all dates sit on a synthetic calendar.

Five patients, six weeks of twice-daily sessions each, with daily approvals that go through the real `clampSuggestion` rules:
- SYN-01 typical (shows the +10 mA clamp)
- SYN-02 one degraded session and one lead-off stop; reaches the 50 mA cap
- SYN-03 pain-related STOP on day 42; its next suggestion is clamped by −5 mA and waits for review
- SYN-04 no approval after day 40: its plan has expired at `FIXTURE_NOW`
- SYN-05 low adherence, Mode 0 at a fixed dose

Exports: `FIXTURE_NOW`, `patients`, `braces`, `plans`, `suggestions`, `decisions`, `sessions`, `PRACTITIONERS`.
