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
}

struct SearchPayload: Codable, Equatable, Sendable {
    /// nil leaves the field's current text alone (focus-only requests).
    var text: String?
    var focused: Bool
}
