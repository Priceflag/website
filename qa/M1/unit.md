# unit

`node --test qa/tests/**/*.test.mjs` → exit 0; tests 22, pass 22, fail 0.

```
✔ qa harness unit runner works (0.334292ms)
✔ empty submit shows inline errors and sends nothing (309.188542ms)
✔ invalid email and store are rejected (154.400416ms)
✔ success sends text/plain JSON once and shows the success state (245.978875ms)
✔ double-click submits only once (948.401292ms)
✔ endpoint failure keeps the input and offers a prefilled email (205.115166ms)
✔ ok:false from the script is treated as a failure (250.194625ms)
✔ offline shows an error without sending (155.39075ms)
✔ duplicate email is acknowledged honestly (241.993917ms)
✔ very long input is capped and still submits (263.810834ms)
✔ a note that fits is stored whole; a longer one is flagged with a mailto (488.809625ms)
✔ a filled honeypot still sends, flagged, instead of a fake thanks (240.937209ms)
✔ mailto fallback stays under 1,800 characters and carries the email (188.685792ms)
✔ coming back after a successful request shows it was sent, with a way to send another (301.948333ms)
✔ a 5xx or non-JSON reply says we could not confirm, and keeps the input (242.714833ms)
✔ email and store validation edge cases (667.393667ms)
✔ without the script the form posts to a mail client, never a GET with data in the URL (287.021666ms)
✔ emoji and other astral characters never hang the form (922.870792ms)
✔ honeypot flag survives a long note (241.235958ms)
✔ focus stays on the button while sending, and "too long" names the right field (1018.403333ms)
✔ joiners survive in name and note; marks are stripped from email (302.824458ms)
✔ leaving mid-send and coming back says the request may have arrived (346.038917ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8287.713208
```
