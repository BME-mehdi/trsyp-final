# Roadmap (not built in this phase)

Future work, in no fixed order. Each item needs team and clinical-adviser agreement before it starts.

1. **Extremum-seeking gain tuning (Mode 2).** Planned; needs a force or torque signal, which the brace does not have yet. The spec lists it as "Won't (this phase)".
2. **Force sensing.** A force sensor to relate EMG to force; prerequisite for item 1.
3. **Pain-relief (TENS) mode.** The firmware locks 50 Hz and 250 µs; a new mode needs new parameters, contraindications and clinician approval.
4. **Clinician-assigned home exercise library.** Only with a clinician-approved list with sources.
5. **Secondary app stop request over BLE.** Slower than the hardware STOP and never the main way to stop (docs/OPEN_QUESTIONS.md item 37).
6. **Arabic strings** in `packages/i18n`, with right-to-left layout checks.
