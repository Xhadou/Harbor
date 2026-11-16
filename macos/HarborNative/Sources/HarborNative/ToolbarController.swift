import AppKit
import WebKit

extension NSToolbarItem.Identifier {
    static let harborToggleSidebar = NSToolbarItem.Identifier("harbor.toggleSidebar")
    static let harborBack = NSToolbarItem.Identifier("harbor.back")
    static let harborSearch = NSToolbarItem.Identifier("harbor.search")
}

/// The window toolbar: sidebar toggle, Back, and the search field. Built on the
/// macOS 26 SDK it is drawn in Liquid Glass by the system. The web app stays
/// the source of truth; this only reports what the user did.
@MainActor
final class ToolbarController: NSObject, NSToolbarDelegate, NSSearchFieldDelegate {
    static let itemIdentifiers: [NSToolbarItem.Identifier] = [
        .harborToggleSidebar, .harborBack, .flexibleSpace, .harborSearch,
    ]

    /// Keys the search field hands to the web results instead of handling itself.
    static func searchKey(for selector: Selector) -> String? {
        switch selector {
        case #selector(NSResponder.moveUp(_:)): "ArrowUp"
        case #selector(NSResponder.moveDown(_:)): "ArrowDown"
        case #selector(NSResponder.insertNewline(_:)): "Enter"
        case #selector(NSResponder.cancelOperation(_:)): "Escape"
        default: nil
        }
    }

    private let window: NSWindow
    private let emit: (String, any Encodable) -> Void
    private let layoutChanged: () -> Void
    private let toolbar = NSToolbar(identifier: "harbor.main")
    private let backItem = NSToolbarItem(itemIdentifier: .harborBack)
    private let sidebarItem = NSToolbarItem(itemIdentifier: .harborToggleSidebar)
    private let searchItem = NSSearchToolbarItem(itemIdentifier: .harborSearch)
    private var observers: [NSKeyValueObservation] = []
    private var searching = false

    var isBackEnabled: Bool { backItem.isEnabled }
    var isSearchHidden: Bool { searchItem.isHidden }
    var searchText: String { searchItem.searchField.stringValue }

    /// Height the title bar and toolbar take from the top of the content view.
    var titlebarInset: Double {
        LayoutPayload.titlebarInset(frame: window.frame, contentLayout: window.contentLayoutRect)
    }

    init(
        window: NSWindow,
        emit: @escaping (String, any Encodable) -> Void,
        layoutChanged: @escaping () -> Void
    ) {
        self.window = window
        self.emit = emit
        self.layoutChanged = layoutChanged
        super.init()

        sidebarItem.label = "Sidebar"
        sidebarItem.toolTip = "Show or hide the sidebar"
        sidebarItem.image = NSImage(
            systemSymbolName: "sidebar.left", accessibilityDescription: "Toggle Sidebar")
        sidebarItem.isBordered = true
        sidebarItem.target = self
        sidebarItem.action = #selector(toggleSidebar(_:))

        backItem.label = "Back"
        backItem.toolTip = "Go back"
        backItem.image = NSImage(
            systemSymbolName: "chevron.backward", accessibilityDescription: "Back")
        backItem.isBordered = true
        backItem.isNavigational = true
        // Enabled state comes from the web app's view stack, not the responder chain.
        backItem.autovalidates = false
        backItem.isEnabled = false
        backItem.target = self
        backItem.action = #selector(goBack(_:))

        searchItem.searchField.delegate = self
        searchItem.searchField.placeholderString = "Search"

        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window.toolbarStyle = .unified
        window.toolbar = toolbar

        // Both properties are KVO-compliant and change on the main thread.
        observers.append(
            window.observe(\.contentLayoutRect) { [weak self] _, _ in
                MainActor.assumeIsolated { self?.layoutChanged() }
            })
        observers.append(
            window.observe(\.firstResponder) { [weak self] _, _ in
                MainActor.assumeIsolated { self?.searchFocusMayHaveChanged() }
            })
    }

    func apply(_ payload: ToolbarPayload) {
        toolbar.isVisible = payload.visible
        backItem.isEnabled = payload.canGoBack
        searchItem.isHidden = !payload.searchVisible
        layoutChanged()
    }

    func apply(_ payload: SearchPayload) {
        let field = searchItem.searchField
        if let text = payload.text, field.stringValue != text {
            field.stringValue = text
        }
        switch payload.focused {
        case true?:
            if !searchItem.isHidden, toolbar.isVisible { searchItem.beginSearchInteraction() }
        case false?:
            if field.currentEditor() != nil {
                searchItem.endSearchInteraction()
                focusWebContent()
            }
        case nil:
            break
        }
    }

    // MARK: Actions

    @objc func goBack(_ sender: Any?) {
        emit("toolbar-back", EmptyPayload())
    }

    @objc func toggleSidebar(_ sender: Any?) {
        emit("toolbar-toggle-sidebar", EmptyPayload())
    }

    // MARK: NSToolbarDelegate

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        Self.itemIdentifiers
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        Self.itemIdentifiers
    }

    func toolbar(
        _ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier,
        willBeInsertedIntoToolbar flag: Bool
    ) -> NSToolbarItem? {
        switch itemIdentifier {
        case .harborToggleSidebar: sidebarItem
        case .harborBack: backItem
        case .harborSearch: searchItem
        default: nil
        }
    }

    // MARK: Search field

    func controlTextDidChange(_ notification: Notification) {
        emit("search-text", SearchTextPayload(text: searchItem.searchField.stringValue))
    }

    func control(
        _ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector
    ) -> Bool {
        guard let key = Self.searchKey(for: commandSelector) else { return false }
        let shift = NSApp.currentEvent?.modifierFlags.contains(.shift) ?? false
        emit("search-key", SearchKeyPayload(key: key, shift: shift))
        // Arrow down moves into the results, which live in the web view.
        if key == "ArrowDown" { focusWebContent() }
        return true
    }

    private func searchFocusMayHaveChanged() {
        let now = searchItem.searchField.currentEditor() != nil
        guard now != searching else { return }
        searching = now
        emit(now ? "search-begin" : "search-end", EmptyPayload())
    }

    private func focusWebContent() {
        guard let content = window.contentView, let webView = Self.firstWebView(in: content)
        else { return }
        window.makeFirstResponder(webView)
    }

    private static func firstWebView(in view: NSView) -> WKWebView? {
        if let webView = view as? WKWebView { return webView }
        for subview in view.subviews {
            if let found = firstWebView(in: subview) { return found }
        }
        return nil
    }
}
