# unit

`node --test qa/tests/**/*.test.mjs` → exit 0; tests 22, pass 22, fail 0.

```
✔ qa harness unit runner works (0.328084ms)
✔ empty submit shows inline errors and sends nothing (280.941458ms)
✔ invalid email and store are rejected (150.773875ms)
✔ success sends text/plain JSON once and shows the success state (240.141584ms)
✔ double-click submits only once (945.914333ms)
✔ endpoint failure keeps the input and offers a prefilled email (231.11575ms)
✔ ok:false from the script is treated as a failure (239.484209ms)
✔ offline shows an error without sending (148.89025ms)
✔ duplicate email is acknowledged honestly (239.936709ms)
✔ very long input is capped and still submits (235.125917ms)
✔ a note that fits is stored whole; a longer one is flagged with a mailto (483.705292ms)
✔ a filled honeypot still sends, flagged, instead of a fake thanks (246.663125ms)
✔ mailto fallback stays under 1,800 characters and carries the email (187.273791ms)
✔ coming back after a successful request shows it was sent, with a way to send another (305.389292ms)
✔ a 5xx or non-JSON reply says we could not confirm, and keeps the input (235.3315ms)
✔ email and store validation edge cases (313.573417ms)
✔ without JavaScript the form is replaced by an email link and never puts data in a URL (259.31625ms)
✔ emoji and other astral characters never hang the form (914.198709ms)
✔ honeypot flag survives a long note (233.64275ms)
✔ focus stays on the button while sending, and "too long" names the right field (1020.870291ms)
✔ joiners survive in name and note; marks are stripped from email (300.861875ms)
✔ leaving mid-send and coming back says the request may have arrived (345.806875ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7812.244625
```
