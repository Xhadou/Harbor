import AppKit
import XCTest

@testable import HarborNative

@MainActor
final class SidebarTests: XCTestCase {
    private func item(_ id: String, _ section: String, active: Bool = false) -> SidebarItem {
        SidebarItem(
            id: id, title: id, symbol: "house", section: section, active: active, gated: false,
            badge: nil)
    }

    private func makeWindow() -> NSWindow {
        NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1000, height: 700),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: true)
    }

    func testSectionsSplit() {
        let model = SidebarModel(
            payload: SidebarPayload(
                visible: true, collapsed: false,
                items: [
                    item("home", "primary"), item("library", "collections"),
                    item("movies", "primary", active: true), item("addons", "collections"),
                ]))
        XCTAssertEqual(model.primary.map(\.id), ["home", "movies"])
        XCTAssertEqual(model.collections.map(\.id), ["library", "addons"])
        XCTAssertEqual(model.activeID, "movies")
    }

    func testHiddenWhenCollapsed() {
        let items = [item("home", "primary")]
        XCTAssertFalse(
            SidebarModel(payload: SidebarPayload(visible: true, collapsed: true, items: items))
                .isShown)
        XCTAssertFalse(
            SidebarModel(payload: SidebarPayload(visible: false, collapsed: false, items: items))
                .isShown)
        XCTAssertTrue(
            SidebarModel(payload: SidebarPayload(visible: true, collapsed: false, items: items))
                .isShown)
    }

    func testSidebarVisibilityIsReportedInLayout() throws {
        EventLog.events = []
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(visible: true, collapsed: false, items: [item("home", "primary")]))
        var layout = try XCTUnwrap(EventLog.events.last { $0.kind == "layout" })
        var payload = try JSONDecoder().decode(LayoutPayload.self, from: Data(layout.json.utf8))
        XCTAssertTrue(payload.sidebarVisible)
        XCTAssertEqual(payload.sidebarWidth, 240)

        controller.setSidebar(
            SidebarPayload(visible: true, collapsed: true, items: [item("home", "primary")]))
        layout = try XCTUnwrap(EventLog.events.last { $0.kind == "layout" })
        payload = try JSONDecoder().decode(LayoutPayload.self, from: Data(layout.json.utf8))
        XCTAssertFalse(payload.sidebarVisible)
    }

    func testSelectingARowReportsItWithoutMovingTheHighlight() {
        EventLog.events = []
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(
                visible: true, collapsed: false,
                items: [item("home", "primary", active: true), item("library", "collections")]))
        EventLog.events = []
        controller.sidebar.model.select("library")
        XCTAssertEqual(EventLog.kinds(), ["sidebar-select"])
        XCTAssertEqual(EventLog.events[0].json, #"{"id":"library"}"#)
        XCTAssertEqual(controller.sidebar.model.activeID, "home")
    }
}
