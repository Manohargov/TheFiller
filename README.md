# The Filler

<p align="center"><img src="native/AppIcon-3D.png" width="160" alt="The Filler app icon"></p>

A local job-application helper that fills supported fields from your saved profile. It preserves existing answers and never clicks Next, Submit, or consent checkboxes.

## Editions

| | macOS | Windows |
|---|---|---|
| Interface | Native Swift floating icon, menu bar and Dock | Python browser dashboard |
| Installer | `.dmg` | Setup `.exe`, built on Windows |
| Existing browser | Safari, Chrome, Edge, Brave via Apple Events | Chrome/Edge via a dedicated remote-debugging session |
| Firefox | Not supported by native edition | Separate Playwright-launched browser |
| Current status | Built and tested on Apple Silicon | Build workflow provided; Windows runtime validation required |

The Windows edition preserves the original dashboard implementation. It does **not** provide the macOS floating overlay or attach to an ordinary existing Safari/Firefox window.

## Installers

Installer binaries are kept **outside Git history**:

- `releases/macos/The-Filler-1.1.0-macOS-arm64.dmg` (or `x86_64`, according to the build host).
- `releases/windows/The-Filler-1.1.0-Windows-Setup.exe` after the Windows build succeeds.

GitHub **Actions → Build installers** creates separate downloadable DMG and EXE artifacts. No installer is published automatically to GitHub Releases. Build success and runtime validation are different: test each artifact on its target OS before a public release.

### macOS

1. Open the DMG and drag **The Filler** to **Applications**.
2. Launch the app. Use **Import profile update…** or **Edit CV profile…** to enter your details; use **Choose resume PDF…** for your CV.
3. Safari: enable **Show features for web developers** under Settings → Advanced, then **Allow JavaScript from Apple Events** under Settings → Developer. Chrome/Edge/Brave: View → Developer → Allow JavaScript from Apple Events.
4. Allow the requested macOS Automation access for the browser.
5. Open a job form and click the small icon. Yellow means idle; green means filling. Drag it to move it, or right-click for the menu.

The app appears in Cmd-Tab and the Dock. Notifications do not intercept clicks. It captures the selected tab before filling; changing tabs does not redirect an ongoing fill.

These builds use ad-hoc signing, not Apple Developer ID signing or notarization. Public distribution requires a Developer ID certificate and notarization. The local macOS build targets macOS 13+ on the build machine's architecture; it is not a universal binary.

### Windows

Run the setup EXE, then open **The Filler**. It opens a local dashboard in your default browser. Choose a browser and either launch a dedicated browser or connect to an existing debugging session.

For Chrome, close the dedicated test session before launching:

```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\TheFiller\ChromeProfile"
```

Open the job form in that window. In the dashboard select **Connect to open browser**. Keep one browser window visible and the target application tab selected. Review Preview mode before enabling Apply. Connecting does not close your browser on stop.

The Windows dashboard stores the profile under `%APPDATA%\TheFiller\profile.json`. Edit it in the profile panel. Set `resume_path` to an absolute PDF path to attach a CV. The setup EXE bundles Python and Playwright browsers; no Python installation is needed to run it. Windows code signing is not configured.

## Profile and answers

See [the profile format](docs/profile-format.md). Public builds contain a blank template, never a candidate's real CV, phone, email, address, or saved answers.

The native macOS app retains its original `~/Library/Application Support/Jobfiller` data directory for compatibility. Upgrading preserves that data. Internal identifiers remain unchanged to preserve preferences and browser permissions.

Supported fields include name, email, phone, LinkedIn, website, street address, second address line, city, state, postal code, and country. Standard selects and recognized Yes/No controls are supported. The app finds hidden CV inputs from their surrounding section and retries newly unlocked fields for up to 15 seconds. Custom controls and cross-origin frames can require manual entry.

Motivation and cover-letter drafts are **local templates based on your saved CV summary**, not language-model output. They do not invent company facts. Salary, work authorization and other personal preferences require saved answers. Review all drafts, uploads, and validation messages before submitting yourself.

## Build

### macOS DMG

Requires macOS and Xcode Command Line Tools:

```bash
./scripts/build-macos-dmg.sh
```

For the app bundle alone, run `./native/build.sh`. The DMG build always uses a blank profile and excludes resumes. A private development build may opt in with `THE_FILLER_PROFILE` and `THE_FILLER_RESUME`; do not distribute that private build.

### Windows EXE

Requires Windows x64, Python 3.12+, and Inno Setup 6:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1
```

The workflow in `.github/workflows/build.yml` runs this on `windows-latest`. PyInstaller cannot build a Windows executable on macOS.

## Tests

```bash
npm ci
npx playwright install chromium webkit
npm test
npm run test:webkit
python3 -m compileall -q app
```

On Linux, use `npx playwright install --with-deps chromium webkit`. Tests use synthetic profiles and an in-memory dummy resume. They cover contact fields, uploads, delayed unlocks, saved choices, drafts, repeated fills, preservation, and no submission. `CHROME_PATH` optionally selects an installed Chrome for local testing.

## Repository layout

```text
native/                 macOS Swift app, shared JS filler and final icons
app/                    Windows dashboard and browser drivers
config/                 Blank public profile template
scripts/                DMG, Windows packaging and installer definition
tests/                  Synthetic regression tests and fixtures
.github/workflows/      Tests and separate platform builds
releases/macos/          Local DMG output (ignored)
releases/windows/        Local EXE output (ignored)
local/                  Private development profile/CV (ignored)
```

## Privacy and limitations

The application has no hosted backend. Filling places profile data and your chosen CV into the active site; that site's scripts may process or upload them immediately. Do not fill a site you do not intend to share with. The Windows dashboard binds only to `127.0.0.1`.

`.gitignore` excludes personal profiles, resumes, secrets, build directories, installers, caches, and scratch work. Avoid force-adding ignored files. This repository does not grant an open-source license; add an appropriate license before public redistribution.
