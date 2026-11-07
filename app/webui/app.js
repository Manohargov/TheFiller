(function () {
  const base = "";
  const browserSelect = document.getElementById("browserSelect");
  const browserHint = document.getElementById("browserHint");
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const urlRow = document.getElementById("urlRow");
  const cdpRow = document.getElementById("cdpRow");
  const profileDirRow = document.getElementById("profileDirRow");
  const modeHint = document.getElementById("modeHint");
  const urlInput = document.getElementById("urlInput");
  const cdpUrlInput = document.getElementById("cdpUrlInput");
  const checkCdpButton = document.getElementById("checkCdp");
  const profileDirInput = document.getElementById("profileDirInput");
  const applyCheck = document.getElementById("applyCheck");
  const headedCheck = document.getElementById("headedCheck");
  const toggleBtn = document.getElementById("toggleBtn");
  const toggleText = document.getElementById("toggleText");
  const statusPill = document.getElementById("statusPill");
  const statusChip = document.getElementById("statusChip");
  const logContainer = document.getElementById("logContainer");
  const clearLogs = document.getElementById("clearLogs");
  const profileText = document.getElementById("profileText");
  const loadProfile = document.getElementById("loadProfile");
  const saveProfile = document.getElementById("saveProfile");

  let running = false;
  let pollTimer = null;

  const BROWSER_HINTS = {
    chromium: "Chrome/Edge: supports launching fresh or connecting to an open browser via CDP.",
    firefox: "Firefox: launch mode supported. Uses your Firefox profile if a folder is provided.",
    safari: "WebKit: launches a separate browser engine; does not attach to Safari.app.",
  };

  function onBrowserChange() {
    const b = browserSelect.value;
    browserHint.textContent = BROWSER_HINTS[b] || "";
    const isFirefox = b === "firefox";
    profileDirRow.style.display = isFirefox ? "block" : "none";
    // CDP only meaningful for chromium
    if (b !== "chromium") {
      cdpRow.style.display = "none";
    } else {
      const modeLaunch = document.querySelector('input[name="mode"]:checked').value === "launch";
      cdpRow.style.display = modeLaunch ? "none" : "block";
    }
  }

  function onModeChange(radio) {
    const isLaunch = radio.value === "launch";
    urlRow.style.display = isLaunch ? "flex" : "none";
    const b = browserSelect.value;
    cdpRow.style.display = (b === "chromium" && !isLaunch) ? "block" : "none";
    profileDirRow.style.display = (b === "firefox") ? "block" : "none";
    modeHint.textContent = isLaunch
      ? "Launches a fresh browser window to the URL below."
      : "Reads the currently open tab in your running browser and fills its fields.";
  }

  function log(msg, kind = "info") {
    const div = document.createElement("div");
    div.className = `log-entry ${kind}`;
    const now = new Date().toLocaleTimeString();
    div.textContent = `[${now}] ${msg}`;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function clearLog() {
    logContainer.innerHTML = "";
  }

  function setToggle(on) {
    running = on;
    toggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    toggleText.textContent = on ? "ON" : "OFF";
    statusPill.textContent = on ? "Running" : "Stopped";
    statusChip.textContent = on ? "Active" : "Idle";
    statusPill.className = on ? "status-pill running" : "status-pill";
    toggleBtn.classList.toggle("btn-primary", on);
    const disabled = on;
    browserSelect.disabled = disabled;
    urlInput.disabled = disabled;
    cdpUrlInput.disabled = disabled;
    profileDirInput.disabled = disabled;
    applyCheck.disabled = disabled;
    headedCheck.disabled = disabled;
    checkCdpButton.disabled = disabled;
    Array.from(modeRadios).forEach((r) => (r.disabled = disabled));
  }

  function redrawLogs(logs) {
    logContainer.innerHTML = "";
    (logs || []).forEach((entry) => {
      const kind = entry.includes("Error") ? "err" : entry.includes("Stopped") ? "warn" : "info";
      const div = document.createElement("div");
      div.className = `log-entry ${kind}`;
      div.textContent = entry;
      logContainer.appendChild(div);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  async function pollStatus() {
    try {
      const r = await fetch(`${base}/api/status`);
      const data = await r.json();
      setToggle(data.running || data.status === "running");
      if (data.browser) browserSelect.value = data.browser;
      onBrowserChange();
      if (data.logs && data.logs.length) redrawLogs(data.logs);
      if (data.last_result && data.last_result.error) log(data.last_result.error, "err");
    } catch (e) {
      // ignore poll errors
    }
  }

  async function toggle() {
    const browser = browserSelect.value;
    const mode = document.querySelector('input[name="mode"]:checked').value;

    if (running) {
      const res = await fetch(`${base}/api/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "off" }),
      });
      const data = await res.json();
      log(data.message || "Stopped", data.ok ? "info" : "warn");
      pollStatus();
    } else {
      const apply = applyCheck.checked;
      const headed = headedCheck.checked;
      const payload = { action: "on", browser, mode, apply, headed };

      if (mode === "launch") {
        const url = urlInput.value.trim();
        if (!url) {
          log("Please enter a job application URL", "warn");
          return;
        }
        payload.url = url;
        payload.user_data_dir = profileDirInput.value.trim() || undefined;
      } else {
        payload.cdp_url = cdpUrlInput.value.trim() || "http://127.0.0.1:9222";
      }

      const res = await fetch(`${base}/api/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        log(`Started (${mode}, ${browser}): ${payload.url || payload.cdp_url}`, "info");
      } else {
        log(data.error || "Failed to start", "err");
      }
      pollStatus();
    }
  }

  async function checkCdp() {
    const cdpUrl = cdpUrlInput.value.trim() || "http://127.0.0.1:9222";
    try {
      const res = await fetch(`${base}/api/cdp-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cdp_url: cdpUrl }),
      });
      const data = await res.json();
      if (data.ok) log(`Browser reachable at ${cdpUrl}`, "ok");
      else log(`Browser not reachable: ${data.error}`, "err");
    } catch (e) {
      log("CDP check failed", "err");
    }
  }

  toggleBtn.addEventListener("click", toggle);
  clearLogs.addEventListener("click", clearLog);
  checkCdpButton.addEventListener("click", checkCdp);
  browserSelect.addEventListener("change", onBrowserChange);
  Array.from(modeRadios).forEach((r) => r.addEventListener("change", (e) => onModeChange(e.target)));

  async function loadProfileData() {
    try {
      const r = await fetch(`${base}/api/profile`);
      const prof = await r.json();
      profileText.value = JSON.stringify(prof, null, 2);
      log("Saved profile loaded", "info");
    } catch (e) {
      log("Failed to load profile", "err");
    }
  }

  async function saveProfileData() {
    try {
      const prof = JSON.parse(profileText.value);
      const r = await fetch(`${base}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prof),
      });
      const data = await r.json();
      if (data.ok) log("Profile saved", "info");
      else log(data.error || "Save failed", "err");
    } catch (e) {
      log("Invalid JSON in profile", "err");
    }
  }

  loadProfile.addEventListener("click", loadProfileData);
  saveProfile.addEventListener("click", saveProfileData);

  // Init
  pollStatus();
  pollTimer = setInterval(pollStatus, 2000);
  onBrowserChange();
  loadProfileData();
})();
