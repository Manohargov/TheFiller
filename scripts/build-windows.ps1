$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($env:OS -ne 'Windows_NT') { throw 'Run this build on Windows.' }
function Checked { param([scriptblock]$Command); & $Command; if ($LASTEXITCODE -ne 0) { throw "Build command failed: $Command" } }
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
Checked { python -m pip install -r app/requirements.txt pyinstaller pillow }
Checked { python -m playwright install chromium firefox webkit }
Checked { python -m PyInstaller --noconfirm --clean --onedir --windowed --name TheFiller --icon app/webui/app-icon.png --add-data 'app/webui;webui' --add-data 'config/profile.example.json;.' --add-data 'native/fill.js;native' --collect-all playwright app/main.py }
$compiler = (Get-Command ISCC.exe -ErrorAction SilentlyContinue).Source
if (-not $compiler) { $compiler = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" }
if (-not (Test-Path $compiler)) { throw 'Install Inno Setup 6 to produce the Windows setup EXE.' }
Checked { & $compiler scripts/windows-installer.iss }
