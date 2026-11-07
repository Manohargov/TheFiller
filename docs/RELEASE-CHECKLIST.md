# Release checklist

- Run all Chromium and WebKit regression tests with synthetic data.
- Verify the blank config and staged files contain no personal profile, CV, secrets, or local paths.
- Build and verify the macOS DMG; test drag-to-Applications and existing-profile preservation.
- Build the Windows setup EXE on Windows, install and launch it, verify browser selection, preview, filling, and uninstall.
- Check browser permissions and review/no-submit behavior.
- Sign/notarize the macOS release and sign the Windows installer before public distribution.
- Attach DMG and EXE separately to a GitHub release; do not commit binary installers.
