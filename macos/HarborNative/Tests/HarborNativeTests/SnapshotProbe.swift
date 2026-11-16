import AppKit
import XCTest

@testable import HarborNative

/// Renders the native chrome off-screen to a PNG, for looking at its layout
/// when the real window cannot be captured (for example while the screen is
/// locked). Opt-in:
///
///     SNAPSHOT_OUT=/path/out.png swift test --filter SnapshotProbe
///
/// Off-screen, glass draws as a flat dark fill and the selected row as a
/// black bar; only the arrangement is meaningful.
@MainActor
final class SnapshotProbe: XCTestCase {
    func testRenderSidebar() throws {
        guard let path = ProcessInfo.processInfo.environment["SNAPSHOT_OUT"] else {
            throw XCTSkip("set SNAPSHOT_OUT to render the native chrome to a PNG")
        }
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        window.appearance = NSAppearance(named: .darkAqua)
        let backdrop = NSView(frame: NSRect(x: 0, y: 0, width: 900, height: 760))
        backdrop.wantsLayer = true
        backdrop.layer?.backgroundColor = NSColor(red: 0.45, green: 0.2, blue: 0.1, alpha: 1).cgColor
        window.contentView = backdrop
        let controller = HarborNativeController(window: window, callback: { _, _ in })
        func item(_ id: String, _ title: String, _ symbol: String, _ section: String, active: Bool = false, badge: Int? = nil) -> SidebarItem {
            SidebarItem(id: id, title: title, symbol: symbol, section: section, active: active, gated: false, badge: badge)
        }
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: true, searchVisible: true))
        controller.setSidebar(
            SidebarPayload(
                visible: true, collapsed: false,
                items: [
                    item("home", "Home", "house", "browse", active: true),
                    item("discover", "Discover", "safari", "browse"),
                    item("movies", "Movies", "film", "browse"),
                    item("shows", "Shows", "tv", "browse"),
                    item("anime", "Anime", "sparkles.tv", "browse"),
                    item("live", "Live TV", "dot.radiowaves.left.and.right", "browse"),
                    item("library", "My Library", "books.vertical", "library"),
                    item("collections", "Collections", "rectangle.stack", "library"),
                    item("downloads", "Downloads", "arrow.down.circle", "library"),
                    item("calendar", "Calendar", "calendar", "library", badge: 3),
                    item("catalogs", "Catalogs", "square.grid.2x2", "more"),
                    item("music", "Music", "music.note", "more"),
                    item("games", "Games", "gamecontroller", "more"),
                    item("manga", "Manga", "book.pages", "more"),
                    item("ebook", "eBook", "book", "more"),
                    item("addons", "Addons", "puzzlepiece", "more"),
                ],
                sections: [
                    SidebarSection(id: "browse", title: nil),
                    SidebarSection(id: "library", title: "Library"),
                    SidebarSection(id: "more", title: "More"),
                ],
                account: SidebarAccount(name: "Pratyush", initials: "PR"),
                settings: item("settings", "Settings", "gearshape", "foot")))
        window.layoutIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.6))
        window.displayIfNeeded()
        let view = try XCTUnwrap(window.contentView)
        let rep = try XCTUnwrap(view.bitmapImageRepForCachingDisplay(in: view.bounds))
        view.cacheDisplay(in: view.bounds, to: rep)
        let data = try XCTUnwrap(rep.representation(using: .png, properties: [:]))
        try data.write(to: URL(fileURLWithPath: path))
    }
}
