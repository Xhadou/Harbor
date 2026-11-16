import AppKit

// JSON payloads pushed from the web app through Rust. Field names are the
// camelCase keys the TypeScript bridges send.

struct SidebarItem: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var symbol: String
    /// "primary" or "collections".
    var section: String
    var active: Bool
    var gated: Bool
    var badge: Int?

    /// SF Symbol names vary by OS release; an unknown one would render blank.
    static func resolvedSymbol(for name: String) -> String {
        NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil ? name : "circle"
    }
}

struct SidebarPayload: Codable, Equatable, Sendable {
    var visible: Bool
    var collapsed: Bool
    var items: [SidebarItem]
}

struct ToolbarPayload: Codable, Equatable, Sendable {
    var visible: Bool
    var canGoBack: Bool
    /// False on views where the web app offers no global search.
    var searchVisible: Bool
}

struct SearchPayload: Codable, Equatable, Sendable {
    /// nil leaves the field's current text alone (focus-only requests).
    var text: String?
    /// nil leaves keyboard focus where it is (text-only updates).
    var focused: Bool?
}

// Events reported to the web app.

struct EmptyPayload: Codable, Equatable, Sendable {}

struct SearchTextPayload: Codable, Equatable, Sendable {
    var text: String
}

struct SearchKeyPayload: Codable, Equatable, Sendable {
    /// "ArrowUp", "ArrowDown", "Enter" or "Escape".
    var key: String
    var shift: Bool
}

/// How much of the window the native chrome covers, in points.
struct LayoutPayload: Codable, Equatable, Sendable {
    var titlebarInset: Double
    var sidebarWidth: Double
    var sidebarVisible: Bool

    static func titlebarInset(frame: NSRect, contentLayout: NSRect) -> Double {
        max(0, Double(frame.height - contentLayout.height))
    }
}
