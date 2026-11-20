import AppKit

// JSON payloads pushed from the web app through Rust. Field names are the
// camelCase keys the TypeScript bridges send.

struct SidebarItem: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var symbol: String
    /// Id of the `SidebarSection` this row belongs to.
    var section: String
    var active: Bool
    var gated: Bool
    var badge: Int?

    /// SF Symbol names vary by OS release; an unknown one would render blank.
    static func resolvedSymbol(for name: String) -> String {
        NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil ? name : "circle"
    }
}

struct SidebarSection: Codable, Equatable, Sendable {
    var id: String
    /// Small heading above the group; nil for the first, unlabelled group.
    var title: String?
}

struct SidebarAccount: Codable, Equatable, Sendable {
    var name: String
    var initials: String
}

struct SidebarPayload: Codable, Equatable, Sendable {
    var visible: Bool
    var collapsed: Bool
    var items: [SidebarItem]
    /// Order and headings of the groups. Sections with no items are skipped.
    var sections: [SidebarSection]? = nil
    /// Profile shown at the foot; nil hides it (parental lock).
    var account: SidebarAccount? = nil
    /// The Settings entry, shown as a button at the foot instead of a row.
    var settings: SidebarItem? = nil
}

/// State of the floating window controls (Back, sidebar toggle, search field).
struct ToolbarPayload: Codable, Equatable, Sendable {
    /// False while the player or an immersive view owns the whole window.
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

struct SidebarSelectPayload: Codable, Equatable, Sendable {
    var id: String
}

struct SearchTextPayload: Codable, Equatable, Sendable {
    var text: String
}

struct SearchKeyPayload: Codable, Equatable, Sendable {
    /// "ArrowUp", "ArrowDown", "Enter" or "Escape".
    var key: String
    var shift: Bool
}

/// Whether the window is in (or on its way into) macOS full screen.
struct FullScreenPayload: Codable, Equatable, Sendable {
    var on: Bool
}

/// How much of the window the native chrome covers, in points.
struct LayoutPayload: Codable, Equatable, Sendable {
    var titlebarInset: Double
    var sidebarWidth: Double
    var sidebarVisible: Bool
    /// Where a web control in the top-left corner can start, clear of the traffic lights.
    var controlsInset: Double
}
