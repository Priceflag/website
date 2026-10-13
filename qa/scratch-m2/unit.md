# unit

`node --test qa/tests/**/*.test.mjs` → exit 0; tests 22, pass 22, fail 0.

```
✔ qa harness unit runner works (0.351167ms)
✔ empty submit shows inline errors and sends nothing (279.571208ms)
✔ invalid email and store are rejected (150.242458ms)
✔ success sends text/plain JSON once and shows the success state (235.87975ms)
✔ double-click submits only once (948.794667ms)
✔ endpoint failure keeps the input and offers a prefilled email (238.818541ms)
✔ ok:false from the script is treated as a failure (245.386084ms)
✔ offline shows an error without sending (150.207625ms)
✔ duplicate email is acknowledged honestly (237.505208ms)
✔ very long input is capped and still submits (233.674333ms)
✔ a note that fits is stored whole; a longer one is flagged with a mailto (471.855875ms)
✔ a filled honeypot still sends, flagged, instead of a fake thanks (237.417ms)
✔ mailto fallback stays under 1,800 characters and carries the email (186.084917ms)
✔ coming back after a successful request shows it was sent, with a way to send another (301.232333ms)
✔ a 5xx or non-JSON reply says we could not confirm, and keeps the input (236.997042ms)
✔ email and store validation edge cases (669.090584ms)
✔ without JavaScript the form is replaced by an email link and never puts data in a URL (358.010375ms)
✔ emoji and other astral characters never hang the form (972.993375ms)
✔ honeypot flag survives a long note (236.136292ms)
✔ focus stays on the button while sending, and "too long" names the right field (1015.566333ms)
✔ joiners survive in name and note; marks are stripped from email (292.334125ms)
✔ leaving mid-send and coming back says the request may have arrived (343.488542ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8301.790125
```
