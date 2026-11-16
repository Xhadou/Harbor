import AppKit
import WebKit

/// The sidebar's search field. It is only the text input: Harbor's web search
/// does the searching and shows the results, so every change is reported and
/// the keys that act on results are handed over.
@MainActor
final class SearchFieldController: NSObject, NSSearchFieldDelegate {
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

    let field = NSSearchField()
    private weak var window: NSWindow?
    private let emit: (String, any Encodable) -> Void
    private var focusObservation: NSKeyValueObservation?
    private var searching = false

    var text: String { field.stringValue }
    var isHidden: Bool {
        get { field.isHidden }
        set { field.isHidden = newValue }
    }

    init(window: NSWindow, emit: @escaping (String, any Encodable) -> Void) {
        self.window = window
        self.emit = emit
        super.init()
        field.delegate = self
        field.placeholderString = "Search"
        field.controlSize = .large
        // KVO-compliant, and only ever changed on the main thread.
        focusObservation = window.observe(\.firstResponder) { [weak self] _, _ in
            MainActor.assumeIsolated { self?.focusMayHaveChanged() }
        }
    }

    func apply(_ payload: SearchPayload) {
        if let text = payload.text, field.stringValue != text {
            field.stringValue = text
        }
        switch payload.focused {
        case true?:
            if canTakeFocus { window?.makeFirstResponder(field) }
        case false?:
            if field.currentEditor() != nil { focusWebContent() }
        case nil:
            break
        }
    }

    /// False while the field or the pane holding it is hidden.
    private var canTakeFocus: Bool {
        field.window != nil && !field.isHiddenOrHasHiddenAncestor
    }

    func controlTextDidChange(_ notification: Notification) {
        emit("search-text", SearchTextPayload(text: field.stringValue))
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

    private func focusMayHaveChanged() {
        let now = field.currentEditor() != nil
        guard now != searching else { return }
        searching = now
        emit(now ? "search-begin" : "search-end", EmptyPayload())
    }

    private func focusWebContent() {
        guard let window, let content = window.contentView,
            let webView = Self.firstWebView(in: content)
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
