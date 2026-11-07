[Setup]
AppId=TheFillerDashboard
AppName=The Filler
AppVersion=1.1.0
DefaultDirName={localappdata}\Programs\The Filler
DefaultGroupName=The Filler
PrivilegesRequired=lowest
OutputDir=..\releases\windows
OutputBaseFilename=The-Filler-1.1.0-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\TheFiller.exe
[Files]
Source: "..\dist\TheFiller\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\The Filler"; Filename: "{app}\TheFiller.exe"
Name: "{autodesktop}\The Filler"; Filename: "{app}\TheFiller.exe"; Tasks: desktopicon
[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked
[Run]
Filename: "{app}\TheFiller.exe"; Description: "Launch The Filler"; Flags: nowait postinstall skipifsilent
