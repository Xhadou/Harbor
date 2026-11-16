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

    private var fullScreenObserver: NSObjectProtocol?
    private(set) var toolbar: ToolbarController!
    private(set) var sidebar: SidebarHost!
    private var lastLayout: LayoutPayload?
    private var webConnected = false
    private var sidebarConnected = false

    init(window: NSWindow, callback: HarborNativeCallback) {
        self.window = window
        self.callback = callback
        applyWindowFrame()
        sidebar = SidebarHost(
            window: window,
            onSelect: { [weak self] id in
                self?.emit("sidebar-select", SidebarSelectPayload(id: id))
            },
            layoutChanged: { [weak self] in self?.emitLayout() })
        toolbar = ToolbarController(
            window: window,
            emit: { [weak self] kind, payload in self?.emit(kind, payload) },
            layoutChanged: { [weak self] in self?.emitLayout() })
        emitLayout(force: true)
        // Leaving full screen restores a saved style mask; make sure the web
        // content still extends under the title bar afterwards.
        fullScreenObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.didExitFullScreenNotification, object: window, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.applyWindowFrame() }
        }
    }

    /// System frame with traffic lights, web content running under a clear title bar.
    func applyWindowFrame() {
        window.styleMask.insert(.fullSizeContentView)
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
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
        guard let toolbar, let sidebar else { return }
        let layout = LayoutPayload(
            titlebarInset: toolbar.titlebarInset,
            sidebarWidth: sidebar.isShown ? Double(SidebarHost.width) : 0,
            sidebarVisible: sidebar.isShown)
        guard force || layout != lastLayout else { return }
        lastLayout = layout
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
                "[HarborNative] web bridge connected: toolbar visible=%d titlebarInset=%.0f",
                payload.visible ? 1 : 0, toolbar.titlebarInset)
        }
        toolbar.apply(payload)
        // The web app sends this on mount, when it may have missed earlier events.
        emitLayout(force: true)
    }

    func setSearch(_ payload: SearchPayload) {
        toolbar.apply(payload)
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
            "[HarborNative] installed: titled=%d fullSizeContent=%d trafficLights=%d toolbarItems=%d",
            window.styleMask.contains(.titled) ? 1 : 0,
            window.styleMask.contains(.fullSizeContentView) ? 1 : 0,
            window.standardWindowButton(.closeButton) != nil ? 1 : 0,
            window.toolbar?.items.count ?? 0)
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
