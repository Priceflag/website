# console

**Browser launch failures (not tested):** firefox: browserType.launch: Failed to launch the browser process. | Browser logs: | <launching> /Users/NithinAwasome/Library/Caches/ms-playwright/firefox-1555/firefox/Nightly.app/Contents/MacOS/firefox -no-remote -headless -profile /var/folders/4s/vdv4x3r57mld7kh6gr3s0l640000gp/T/playwright_firefoxdev_profile-5hx8M2 -juggler-pipe -silent | <launched> pid=45384 | [pid=45384][err] *** You are running in headless mode. | [pid=45384][err] Could not find profile folder.

| page | browser | status | console errors | warnings | page errors | failed requests | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| index | chromium | PASS | 0 | 0 | 0 | 0 |  |
| index | firefox | WARN | - | - | - | - | firefox failed to launch |
| index | webkit | PASS | 0 | 0 | 0 | 0 |  |
| about | chromium | PASS | 0 | 0 | 0 | 0 |  |
| about | firefox | WARN | - | - | - | - | firefox failed to launch |
| about | webkit | PASS | 0 | 0 | 0 | 0 |  |
| contact | chromium | PASS | 0 | 0 | 0 | 0 |  |
| contact | firefox | WARN | - | - | - | - | firefox failed to launch |
| contact | webkit | PASS | 0 | 0 | 0 | 0 |  |
| legal | chromium | PASS | 0 | 0 | 0 | 0 |  |
| legal | firefox | WARN | - | - | - | - | firefox failed to launch |
| legal | webkit | PASS | 0 | 0 | 0 | 0 |  |
| signin | chromium | FAIL | 1 | 0 | 0 | 1 |  |
| signin | firefox | WARN | - | - | - | - | firefox failed to launch |
| signin | webkit | FAIL | 1 | 0 | 0 | 1 |  |

## signin / chromium

- **error**: Failed to load resource: the server responded with a status of 404 () (https://priceflag.org/uploads/signin-hero.webp)
- **request** 404: https://priceflag.org/uploads/signin-hero.webp

## signin / webkit

- **error**: Failed to load resource: the server responded with a status of 404 () (https://priceflag.org/uploads/signin-hero.webp)
- **request** 404: https://priceflag.org/uploads/signin-hero.webp
