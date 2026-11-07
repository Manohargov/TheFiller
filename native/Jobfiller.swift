import Cocoa
import UniformTypeIdentifiers

final class OverlayPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}
final class ClickAction: NSObject {
    let callback: () -> Void
    init(_ callback: @escaping () -> Void) { self.callback = callback }
    @objc func invoke(_ sender: Any?) { callback() }
}

final class CircleView: NSView {
    var action: (() -> Void)?
    var menuAction: (() -> Void)?
    var busy = false { didSet { needsDisplay = true } }
    var start = NSPoint.zero
    var origin = NSPoint.zero
    var dragged = false
    override func draw(_ dirtyRect: NSRect) {
        let color = busy
            ? NSColor(calibratedRed: 0.20, green: 0.92, blue: 0.40, alpha: 1)
            : NSColor(calibratedRed: 1.0, green: 0.80, blue: 0.16, alpha: 1)
        let circle = NSBezierPath(ovalIn: bounds.insetBy(dx: 7, dy: 7))
        NSGraphicsContext.saveGraphicsState()
        if busy {
            let glow = NSShadow()
            glow.shadowColor = color.withAlphaComponent(0.9)
            glow.shadowBlurRadius = 7
            glow.shadowOffset = .zero
            glow.set()
        }
        NSColor(calibratedWhite: 0.10, alpha: 0.96).setFill(); circle.fill()
        color.setStroke(); circle.lineWidth = 2; circle.stroke()
        NSGraphicsContext.restoreGraphicsState()
        if let icon = NSImage(named: "AppIcon") {
            icon.draw(in: bounds.insetBy(dx: 11, dy: 11), from: .zero, operation: .sourceOver, fraction: 1)
        }

    }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .button }
    override func accessibilityLabel() -> String? { busy ? "The Filler — filling application" : "The Filler — fill application" }
    override func accessibilityPerformPress() -> Bool {
        guard !busy else { return false }; action?(); return true
    }
    override func mouseDown(with event: NSEvent) { start = NSEvent.mouseLocation; origin = window!.frame.origin; dragged = false }
    override func mouseDragged(with event: NSEvent) {
        let p = NSEvent.mouseLocation
        if hypot(p.x-start.x, p.y-start.y) > 4 { dragged = true }
        if dragged { window?.setFrameOrigin(NSPoint(x: origin.x+p.x-start.x, y: origin.y+p.y-start.y)) }
    }
    override func mouseUp(with event: NSEvent) { if !dragged && !busy { action?() } }
    override func rightMouseDown(with event: NSEvent) { menuAction?() }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel!
    var circle: CircleView!
    var status: NSStatusItem!
    var toast: NSPanel?
    var hideToast: DispatchWorkItem?
    var dialogs: [NSAlert] = []
    var actions: [ClickAction] = []
    var lastBrowser: String?
    var browserObserver: NSObjectProtocol?
    let storage = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Jobfiller")
    let supported = ["com.apple.Safari":"Safari", "com.google.Chrome":"Google Chrome", "com.microsoft.edgemac":"Microsoft Edge", "com.brave.Browser":"Brave Browser"]
    var profileURL: URL { storage.appendingPathComponent("profile.json") }
    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            try FileManager.default.createDirectory(at: storage, withIntermediateDirectories: true)
            for file in ["profile.json", "resume.pdf"] {
                let destination = storage.appendingPathComponent(file)
                if !FileManager.default.fileExists(atPath: destination.path), let source = Bundle.main.resourceURL?.appendingPathComponent(file), FileManager.default.fileExists(atPath: source.path) {
                    try FileManager.default.copyItem(at: source, to: destination)
                }
            }
        } catch { alert("Could not prepare your profile", error.localizedDescription) }
        lastBrowser = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        browserObserver = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let self, let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                  let id = app.bundleIdentifier, self.supported[id] != nil else { return }
            self.lastBrowser = id
        }
        let screen = NSScreen.main!.visibleFrame
        panel = OverlayPanel(contentRect: NSRect(x: screen.maxX-66,y:screen.midY,width:46,height:46), styleMask:[.borderless,.nonactivatingPanel], backing:.buffered, defer:false)
        panel.level = .floating; panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true
        panel.hidesOnDeactivate = false; panel.collectionBehavior = [.canJoinAllSpaces,.fullScreenAuxiliary]
        circle = CircleView(frame:NSRect(x:0,y:0,width:46,height:46))
        circle.toolTip = "Click to fill • Drag to move • Right-click for settings"
        circle.setAccessibilityLabel("The Filler — fill application")
        circle.action = { [weak self] in self?.fill() }
        circle.menuAction = { [weak self] in guard let self else {return}; self.status.button?.performClick(nil) }
        panel.contentView = circle; panel.orderFrontRegardless()
        status = NSStatusBar.system.statusItem(withLength:NSStatusItem.squareLength)
        let menuIcon = NSImage(named: "AppIcon")?.copy() as? NSImage
        menuIcon?.size = NSSize(width: 20, height: 20)
        menuIcon?.isTemplate = false
        status.button?.image = menuIcon
        status.button?.toolTip = "The Filler"
        status.button?.setAccessibilityLabel("The Filler")
        let menu = NSMenu()
        for (title, selector) in [("Fill current browser tab",#selector(fillFromMenu)),("Show floating circle",#selector(showCircle)),("Edit CV profile…",#selector(editProfile)),("Import profile update…",#selector(importProfile)),("Export profile update…",#selector(exportProfile)),("Save question answer…",#selector(saveAnswer)),("Choose resume PDF…",#selector(chooseResume)),("Setup & help…",#selector(help)),("Quit The Filler",#selector(quit))] {
            let item = NSMenuItem(title:title, action:selector, keyEquivalent:""); item.target = self; menu.addItem(item)
        }
        status.menu = menu
        if !UserDefaults.standard.bool(forKey:"hasLaunched") { help(); UserDefaults.standard.set(true,forKey:"hasLaunched") }
    }
    @objc func fillFromMenu() { fill() }
    @objc func exportProfile() {
        let picker = NSSavePanel(); picker.allowedContentTypes = [.json]
        picker.nameFieldStringValue = "The-Filler-Profile-Update.json"
        picker.begin { [weak self] response in
            guard let self, response == .OK, let url = picker.url else { return }
            do {
                let current = try JSONSerialization.jsonObject(with: Data(contentsOf: self.profileURL)) as? [String: Any] ?? [:]
                let personal = current["personal"] as? [String: Any] ?? [:]
                let update: [String: Any] = ["personal": personal.filter { ProfileImport.fields.contains($0.key) }, "application_source": current["application_source"] as? String ?? ""]
                try JSONSerialization.data(withJSONObject: update, options: [.prettyPrinted, .sortedKeys]).write(to: url, options: .atomic)
                self.notify("Profile update file exported.")
            } catch { self.alert("Could not export profile", error.localizedDescription) }
        }
    }
    @objc func showCircle() { panel.orderFrontRegardless() }
    @objc func quit() { NSApp.terminate(nil) }
    @objc func editProfile() { NSWorkspace.shared.open(profileURL) }
    @objc func importProfile() {
        let picker = NSOpenPanel()
        picker.allowedContentTypes = [.json]
        picker.canChooseDirectories = false
        picker.allowsMultipleSelection = false
        picker.message = "Choose your profile update JSON. Non-empty contact fields are merged; your CV and saved answers stay unchanged."
        NSApp.activate(ignoringOtherApps: true)
        picker.begin { [weak self] response in
            guard let self, response == .OK, let url = picker.url else { return }
            do {
                let data = try Data(contentsOf: url)
                guard data.count < 100_000 else { throw NSError(domain: "Profile update is too large", code: 1) }
                guard let current = try JSONSerialization.jsonObject(with: Data(contentsOf: self.profileURL)) as? [String: Any] else { throw NSError(domain: "Current profile is invalid", code: 1) }
                let merged = try ProfileImport.merge(data, into: current)
                try Data(contentsOf: self.profileURL).write(to: self.storage.appendingPathComponent("profile-before-import.json"), options: .atomic)
                try JSONSerialization.data(withJSONObject: merged, options: [.prettyPrinted, .sortedKeys]).write(to: self.profileURL, options: .atomic)
                self.notify("Profile updated. Return to the job form and click The Filler.")
            } catch { self.alert("Profile not imported", error.localizedDescription) }
        }
    }
    @objc func saveAnswer() {
        let dialog = NSAlert()
        dialog.messageText = "The Filler — save an answer"
        dialog.informativeText = "Copy the full question from the form. Enter your answer (Yes / No for options). Salary answers should include currency and period. Saved answers apply only to matching questions. Existing webpage answers are preserved."
        dialog.addButton(withTitle: "Save")
        dialog.addButton(withTitle: "Cancel")
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 460, height: 230))
        func editor(_ title: String, y: CGFloat, height: CGFloat) -> NSTextView {
            let label = NSTextField(labelWithString: title)
            label.frame = NSRect(x: 0, y: y + height + 4, width: 460, height: 20)
            view.addSubview(label)
            let scroll = NSScrollView(frame: NSRect(x: 0, y: y, width: 460, height: height))
            scroll.borderType = .bezelBorder
            scroll.hasVerticalScroller = true
            let text = NSTextView(frame: scroll.bounds)
            text.isRichText = false
            text.font = NSFont.systemFont(ofSize: 13)
            text.isVerticallyResizable = true
            text.autoresizingMask = [.width]
            text.textContainer?.widthTracksTextView = true
            scroll.documentView = text
            view.addSubview(scroll)
            return text
        }
        let question = editor("Exact question", y: 140, height: 65)
        let answer = editor("Your answer", y: 0, height: 110)
        dialog.accessoryView = view
        NSApp.activate(ignoringOtherApps: true)
        dialog.window.initialFirstResponder = question
        let save = ClickAction { [self, dialog] in
        dialog.window.orderOut(nil)
        let q = question.string.trimmingCharacters(in: .whitespacesAndNewlines)
        let a = answer.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !a.isEmpty else { alert("Answer not saved", "Both the question and answer are required."); return }
        do {
            var profile = try JSONSerialization.jsonObject(with: Data(contentsOf: profileURL)) as! [String: Any]
            var answers = profile["saved_answers"] as? [[String: String]] ?? []
            answers.removeAll { $0["question"]?.lowercased() == q.lowercased() }
            answers.append(["question": q, "answer": a])
            profile["saved_answers"] = answers
            try JSONSerialization.data(withJSONObject: profile, options: [.prettyPrinted, .sortedKeys]).write(to: profileURL, options: .atomic)
            notify("Answer saved. Return to the application tab and click The Filler button to fill it.")
        } catch { alert("Could not save answer", error.localizedDescription) }
        }
        let cancel = ClickAction { [dialog] in dialog.window.orderOut(nil) }
        actions += [save, cancel]; dialogs.append(dialog)
        dialog.buttons[0].target = save; dialog.buttons[0].action = #selector(ClickAction.invoke(_:))
        dialog.buttons[1].target = cancel; dialog.buttons[1].action = #selector(ClickAction.invoke(_:))
        dialog.window.level = .normal
        dialog.window.makeKeyAndOrderFront(nil)
    }
    @objc func chooseResume() {
        let picker = NSOpenPanel(); picker.allowedContentTypes = [.pdf]; picker.canChooseDirectories = false
        NSApp.activate(ignoringOtherApps:true)
        picker.begin { [weak self] response in
            guard let self, response == .OK, let url = picker.url else { return }
            do { let data = try Data(contentsOf:url); guard data.starts(with:Data("%PDF-".utf8)) else {throw NSError(domain:"Resume must be a PDF",code:1)}; try data.write(to:self.storage.appendingPathComponent("resume.pdf"),options:.atomic) }
            catch { self.alert("Could not save resume",error.localizedDescription) }
        }
    }
    @objc func help() {
        alert("Your CV, one click away", "1. Safari: Settings → Advanced → Show features for web developers. Then Settings → Developer → Allow JavaScript from Apple Events.\n\nChrome / Edge / Brave: View → Developer → Allow JavaScript from Apple Events.\n\n2. Open the application form and click The Filler icon with the yellow ring. Allow macOS Automation access when prompted.\n\nDrag to move. Right-click for profile, resume and quit. Existing answers stay unchanged. Review before submitting.\n\nUse Import profile update to update LinkedIn and address details from your JSON file. Custom dropdowns and cross-origin frames may need manual entry. Firefox is not supported by this lightweight mode.")
    }
    func alert(_ title:String,_ message:String) {
        let a=NSAlert(); a.messageText="The Filler — " + title; a.informativeText=message
        a.addButton(withTitle: "Close")
        let close = ClickAction { [a] in a.window.orderOut(nil) }
        actions.append(close); dialogs.append(a)
        a.buttons[0].target=close; a.buttons[0].action=#selector(ClickAction.invoke(_:))
        a.window.level = .normal
        a.window.orderFront(nil)
    }
    func notify(_ message:String) {
        hideToast?.cancel(); toast?.orderOut(nil)
        let frame=panel.frame
        let box=OverlayPanel(contentRect:NSRect(x: max(NSScreen.main!.visibleFrame.minX,frame.maxX-360),y:frame.minY-114,width:360,height:106),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
        box.ignoresMouseEvents = true; box.level = .floating; box.backgroundColor = NSColor.windowBackgroundColor; box.hasShadow=true; box.hidesOnDeactivate=false; box.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary]
        let label=NSTextField(wrappingLabelWithString:message); label.frame=NSRect(x:14,y:10,width:332,height:86); label.font=NSFont.systemFont(ofSize:13); box.contentView?.addSubview(label); box.orderFrontRegardless(); toast=box
        let task=DispatchWorkItem { [weak box] in box?.orderOut(nil) }; hideToast=task; DispatchQueue.main.asyncAfter(deadline:.now()+8,execute:task)
    }
    func fill() {
        guard !circle.busy else { return }
        let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        let candidate = front == Bundle.main.bundleIdentifier ? lastBrowser : front
        guard let id=candidate, let browser=supported[id] else { notify("Open a job form in Safari, Chrome, Edge or Brave, then click the circle."); return }
        circle.busy=true
        // Run off the UI thread so the circle stays responsive while macOS requests permission.
        DispatchQueue.global(qos:.userInitiated).async { [self] in
            do {
                let profileData=try Data(contentsOf:profileURL)
                guard let profile=try JSONSerialization.jsonObject(with:profileData) as? [String:Any], profile["personal"] is [String:Any] else { throw NSError(domain:"Invalid profile: expected a personal object",code:1) }
                let resumeURL=storage.appendingPathComponent("resume.pdf")
                var payload:[String:Any]=["profile":profile]
                if FileManager.default.fileExists(atPath:resumeURL.path) {
                    let data=try Data(contentsOf:resumeURL)
                    guard data.count <= 15*1024*1024 else {throw NSError(domain:"Resume exceeds 15 MB. Choose a smaller PDF.",code:1)}
                    payload["resume"]=["name":"resume.pdf","base64":data.base64EncodedString()]
                }
                let json=String(data:try JSONSerialization.data(withJSONObject:payload),encoding:.utf8)!
                let engine=try String(contentsOf:Bundle.main.resourceURL!.appendingPathComponent("fill.js"),encoding:.utf8)
                let token = UUID().uuidString
                let js="(() => { \(engine)\n const payload = \(json); return jobfillerStart(payload.profile, payload.resume, '\(token)'); })()"
                let escaped=js.replacingOccurrences(of:"\\",with:"\\\\").replacingOccurrences(of:"\"",with:"\\\"")
                let safari = id == "com.apple.Safari"
                let target = safari ? "current tab of front window" : "active tab of front window"
                let command = safari ? "do JavaScript \"\(escaped)\" in targetTab" : "execute targetTab javascript \"\(escaped)\""
                let pollJS = "(() => {const t=window.__theFillerTask; if (!t || t.token !== '\(token)') return 'NAVIGATED'; return t.done ? JSON.stringify(t.result) : 'WAIT';})()"
                let poll = safari ? "do JavaScript \"\(pollJS)\" in targetTab" : "execute targetTab javascript \"\(pollJS)\""
                let script="with timeout of 25 seconds\ntell application \"\(browser)\"\nif (count of windows) is 0 then error \"Open an application tab first.\"\nset targetTab to \(target)\n\(command)\nrepeat 70 times\nset fillResult to \(poll)\nif fillResult is not \"WAIT\" then return fillResult\ndelay 0.25\nend repeat\nerror \"Timed out waiting for the form.\"\nend tell\nend timeout"
                // A private temporary file avoids command-line size limits for CV attachments.
                let temp=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString+".applescript")
                FileManager.default.createFile(atPath:temp.path,contents:Data(script.utf8),attributes:[.posixPermissions:0o600])
                defer {try? FileManager.default.removeItem(at:temp)}
                let process=Process(); process.executableURL=URL(fileURLWithPath:"/usr/bin/osascript"); process.arguments=[temp.path]
                let pipe=Pipe(); process.standardOutput=pipe; process.standardError=pipe
                try process.run(); let output=pipe.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
                guard process.terminationStatus == 0 else {
                    // Do not expose the script or CV content from an interpreter diagnostic.
                    let raw=String(data:output,encoding:.utf8) ?? ""
                    let reason = raw.contains("1743") ? "Allow The Filler to control your browser in System Settings → Privacy & Security → Automation." : "Enable Allow JavaScript from Apple Events in your browser, and keep the application tab open. See Setup & help in the menu."
                    DispatchQueue.main.async { self.circle.busy=false; self.notify(reason) }; return
                }
                if String(data:output,encoding:.utf8)?.trimmingCharacters(in:.whitespacesAndNewlines) == "NAVIGATED" {
                    DispatchQueue.main.async {self.circle.busy=false; self.notify("The application page changed. Wait for it to load, then click The Filler again.")}; return
                }
                let result=(try JSONSerialization.jsonObject(with:output)) as? [String:Int] ?? [:]
                let filled=result["filled",default:0], attached=result["attached",default:0]
                let message="\(filled) fields filled · \(attached) CV attached\n\(result["drafted",default:0]) drafts: review wording. \(result["needsAnswer",default:0]) need saved answers. \(result["disabled",default:0]) locked fields. \(result["failed",default:0]) failed; \(result["unmatched",default:0]) unmatched; \(result["blockedFrames",default:0]) blocked frames."
                DispatchQueue.main.async {self.circle.busy=false; self.notify(message)}
            } catch {DispatchQueue.main.async {self.circle.busy=false; self.notify("Could not fill: " + error.localizedDescription)}}
        }
    }
}
let app=NSApplication.shared
app.setActivationPolicy(.regular)
let delegate=AppDelegate()
app.delegate=delegate
app.run()
