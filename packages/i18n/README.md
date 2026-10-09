# @symbiomed/i18n

Patient-facing strings for the mobile app and the patient web view, in English and French (Arabic after the MVP, decision D-10). No patient-facing string lives anywhere else.

- `t(lang, key, vars)` fills `{name}` placeholders; a missing value stays visible.
- `fr` is typed against the English keys. A test also fails when a key or a placeholder exists in one language and not the other, or when a forbidden word (CONTRACT.md §6) appears.
- Comfort anchor words are provisional (docs/OPEN_QUESTIONS.md).
