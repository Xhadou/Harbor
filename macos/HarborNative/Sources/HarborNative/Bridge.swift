import AppKit

// C ABI between the Rust host and this package. Every entry point is called on
// the main thread; Rust guarantees that (see src-tauri/src/mac_native/mod.rs).

/// `callback(kind, json)`: both strings are only valid for the duration of the call.
public typealias HarborNativeCallback =
    @convention(c) (UnsafePointer<CChar>, UnsafePointer<CChar>) -> Void

@MainActor
final class HarborNativeController {
    static var shared: HarborNativeController?

    let window: NSWindow
    private let callback: HarborNativeCallback

    private var fullScreenObservers: [NSObjectProtocol] = []
    /// The state the window last said it is in or going to; nil until it has
    /// said anything. Its style mask is no substitute while a transition runs:
    /// it still reads full screen all the way through leaving.
    private var fullScreenReported: Bool?
    private var fullScreenSettled = true
    private(set) var chrome: ChromeButtons!
    private(set) var sidebar: SidebarHost!
    private(set) var trafficLights: TrafficLights!
    private var lastLayout: LayoutPayload?
    private var webConnected = false
    private var sidebarConnected = false

    init(window: NSWindow, callback: HarborNativeCallback) {
        self.window = window
        self.callback = callback
        applyWindowFrame()
        let emit: (String, any Encodable) -> Void = { [weak self] kind, payload in
            self?.emit(kind, payload)
        }
        sidebar = SidebarHost(
            window: window,
            emit: emit,
            onToggle: { emit("toolbar-toggle-sidebar", EmptyPayload()) },
            layoutChanged: { [weak self] in self?.sidebarChanged() })
        chrome = ChromeButtons(window: window, emit: emit)
        trafficLights = TrafficLights(window: window)
        emitLayout(force: true)
        // The window is the only thing that knows whether it is full screen:
        // the green button, the View menu and Mission Control all change it
        // without the web app's doing. Report every change so the page never
        // keeps a state of its own. The "will" notices come first so the page
        // lays itself out for the new state while the animation runs.
        let center = NotificationCenter.default
        let watch: (Notification.Name, Bool, Bool) -> Void = { [weak self] name, on, settled in
            guard let self else { return }
            let observer = center.addObserver(forName: name, object: window, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    // Leaving full screen restores a saved style mask; make sure the
                    // web content still extends under the title bar afterwards.
                    if name == NSWindow.didExitFullScreenNotification { self.applyWindowFrame() }
                    self.emitFullScreen(on, settled: settled)
                }
            }
            self.fullScreenObservers.append(observer)
        }
        watch(NSWindow.willEnterFullScreenNotification, true, false)
        watch(NSWindow.didEnterFullScreenNotification, true, true)
        watch(NSWindow.willExitFullScreenNotification, false, false)
        watch(NSWindow.didExitFullScreenNotification, false, true)
    }

    private func emitFullScreen(_ on: Bool, settled: Bool) {
        fullScreenReported = on
        fullScreenSettled = settled
        emit("fullscreen", FullScreenPayload(on: on, settled: settled))
    }

    /// System frame with traffic lights, web content running under a clear title bar.
    /// There is deliberately no toolbar: see `ChromeButtons`.
    func applyWindowFrame() {
        window.styleMask.insert(.fullSizeContentView)
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
    }

    private func sidebarChanged() {
        chrome?.sidebarChanged(
            wanted: sidebar.isWanted, shown: sidebar.isShown, slideMs: sidebar.motionMs)
        emitLayout()
    }

    func emit(_ kind: String, _ payload: some Encodable) {
        guard let json = encodeJSON(payload) else { return }
        kind.withCString { kindPtr in
            json.withCString { jsonPtr in callback(kindPtr, jsonPtr) }
        }
    }

    /// Reports the space native chrome takes so the web app can inset its content.
    /// `force` repeats an unchanged value, for a web app that has just (re)loaded.
    func emitLayout(force: Bool = false) {
        guard let sidebar else { return }
        let layout = LayoutPayload(
            titlebarInset: Double(SidebarHost.topZone),
            sidebarWidth: sidebar.isShown ? Double(SidebarHost.width) : 0,
            sidebarVisible: sidebar.isShown,
            controlsInset: Double(ChromeButtons.afterTrafficLights),
            sidebarMotionMs: sidebar.motionMs)
        // The motion says how the state was reached, not what it is: it is left out of the
        // comparison, so a repeat of the same state never follows a slide's report.
        var state = layout
        state.sidebarMotionMs = 0
        guard force || state != lastLayout else { return }
        lastLayout = state
        emit("layout", layout)
    }

    func setSidebar(_ payload: SidebarPayload) {
        sidebar.apply(payload)
        if !sidebarConnected {
            sidebarConnected = true
            NSLog(
                "[HarborNative] sidebar connected: shown=%d items=%d",
                sidebar.isShown ? 1 : 0, payload.items.count)
        }
    }

    func setToolbar(_ payload: ToolbarPayload) {
        if !webConnected {
            webConnected = true
            NSLog(
                "[HarborNative] web bridge connected: controls visible=%d", payload.visible ? 1 : 0)
        }
        chrome.apply(payload)
        sidebar.search.isHidden = !payload.searchVisible
        // The web app sends this on mount, when it may have missed earlier events.
        emitLayout(force: true)
        emitFullScreen(
            fullScreenReported ?? window.styleMask.contains(.fullScreen), settled: fullScreenSettled)
    }

    func setSearch(_ payload: SearchPayload) {
        sidebar.search.apply(payload)
    }
}

func encodeJSON(_ payload: some Encodable) -> String? {
    guard let data = try? JSONEncoder().encode(payload) else { return nil }
    return String(data: data, encoding: .utf8)
}

func decodeJSON<T: Decodable>(_ type: T.Type, from json: UnsafePointer<CChar>) -> T? {
    do {
        return try JSONDecoder().decode(type, from: Data(String(cString: json).utf8))
    } catch {
        NSLog("[HarborNative] ignoring bad %@: %@", String(describing: type), "\(error)")
        return nil
    }
}

@_cdecl("harbor_native_abi_version")
public func harborNativeABIVersion() -> Int32 { 1 }

@_cdecl("harbor_native_install")
public func harborNativeInstall(
    _ nsWindow: UnsafeMutableRawPointer, _ callback: HarborNativeCallback
) {
    // Raw pointers and C function pointers are not Sendable, but this call is
    // already on the main thread, so nothing crosses an isolation boundary.
    nonisolated(unsafe) let windowPointer = nsWindow
    nonisolated(unsafe) let callback = callback
    MainActor.assumeIsolated {
        let window = Unmanaged<NSWindow>.fromOpaque(windowPointer).takeUnretainedValue()
        HarborNativeController.shared = HarborNativeController(window: window, callback: callback)
        NSLog(
            "[HarborNative] installed: titled=%d fullSizeContent=%d trafficLights=%d",
            window.styleMask.contains(.titled) ? 1 : 0,
            window.styleMask.contains(.fullSizeContentView) ? 1 : 0,
            window.standardWindowButton(.closeButton) != nil ? 1 : 0)
    }
}

@_cdecl("harbor_native_sidebar_set")
public func harborNativeSidebarSet(_ json: UnsafePointer<CChar>) {
    guard let payload = decodeJSON(SidebarPayload.self, from: json) else { return }
    MainActor.assumeIsolated { HarborNativeController.shared?.setSidebar(payload) }
}

@_cdecl("harbor_native_toolbar_set")
public func harborNativeToolbarSet(_ json: UnsafePointer<CChar>) {
    guard let payload = decodeJSON(ToolbarPayload.self, from: json) else { return }
    MainActor.assumeIsolated { HarborNativeController.shared?.setToolbar(payload) }
}

@_cdecl("harbor_native_search_set")
public func harborNativeSearchSet(_ json: UnsafePointer<CChar>) {
    guard let payload = decodeJSON(SearchPayload.self, from: json) else { return }
    MainActor.assumeIsolated { HarborNativeController.shared?.setSearch(payload) }
}
