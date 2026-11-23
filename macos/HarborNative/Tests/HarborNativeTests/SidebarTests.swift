import AppKit
import WebKit
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

    private func layout() throws -> LayoutPayload {
        let event = try XCTUnwrap(EventLog.events.last { $0.kind == "layout" })
        return try JSONDecoder().decode(LayoutPayload.self, from: Data(event.json.utf8))
    }

    override func setUp() {
        EventLog.events = []
    }

    func testItemsAreGroupedBySectionInTheOrderSectionsAreListed() {
        let model = SidebarModel(
            payload: SidebarPayload(
                visible: true, collapsed: false,
                items: [
                    item("home", "browse"), item("library", "library"),
                    item("movies", "browse", active: true), item("addons", "more"),
                ],
                sections: [
                    SidebarSection(id: "browse", title: nil),
                    SidebarSection(id: "library", title: "Library"),
                    SidebarSection(id: "more", title: "More"),
                ]))
        XCTAssertEqual(model.groups.map(\.section.id), ["browse", "library", "more"])
        XCTAssertEqual(model.groups[0].items.map(\.id), ["home", "movies"])
        XCTAssertEqual(model.groups[1].section.title, "Library")
        XCTAssertEqual(model.groups[2].items.map(\.id), ["addons"])
        XCTAssertEqual(model.activeID, "movies")
    }

    func testEmptySectionsAndUnlistedSectionsAreHandled() {
        let model = SidebarModel(
            payload: SidebarPayload(
                visible: true, collapsed: false,
                items: [item("home", "browse"), item("odd", "elsewhere")],
                sections: [
                    SidebarSection(id: "browse", title: nil),
                    SidebarSection(id: "library", title: "Library"),
                ]))
        // No empty "Library" heading; an item in an unknown section is not lost.
        XCTAssertEqual(model.groups.map(\.section.id), ["browse", "elsewhere"])
    }

    func testHiddenWhenCollapsed() {
        let items = [item("home", "browse")]
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
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(visible: true, collapsed: false, items: [item("home", "browse")]))
        XCTAssertTrue(try layout().sidebarVisible)
        XCTAssertEqual(try layout().sidebarWidth, 240)

        controller.setSidebar(
            SidebarPayload(visible: true, collapsed: true, items: [item("home", "browse")]))
        XCTAssertFalse(try layout().sidebarVisible)
    }

    func testASidebarNobodyCanSeeChangesAtOnce() throws {
        // The window of a test is never on screen: nothing slides, and the page is told so.
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        let items = [item("home", "browse")]
        controller.setSidebar(SidebarPayload(visible: true, collapsed: false, items: items))
        controller.setSidebar(SidebarPayload(visible: true, collapsed: true, items: items))
        XCTAssertFalse(try layout().sidebarVisible)
        XCTAssertEqual(try layout().sidebarMotionMs, 0)
        controller.setSidebar(SidebarPayload(visible: true, collapsed: false, items: items))
        XCTAssertTrue(try layout().sidebarVisible)
        XCTAssertEqual(try layout().sidebarMotionMs, 0)
    }

    func testSelectingARowReportsItWithoutMovingTheHighlight() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(
                visible: true, collapsed: false,
                items: [item("home", "browse", active: true), item("library", "library")]))
        EventLog.events = []
        controller.sidebar.model.select("library")
        XCTAssertEqual(EventLog.kinds(), ["sidebar-select"])
        XCTAssertEqual(EventLog.events[0].json, #"{"id":"library"}"#)
        XCTAssertEqual(controller.sidebar.model.activeID, "home")
    }

    func testClickingTheHighlightedRowIsReportedButOtherRowsAreLeftToTheList() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(
                visible: true, collapsed: false,
                items: [item("home", "browse", active: true), item("library", "library")]))
        EventLog.events = []
        // The list's own selection reports a click on any other row.
        controller.sidebar.model.rowClicked("library")
        XCTAssertEqual(EventLog.kinds(), [])
        controller.sidebar.model.rowClicked("home")
        XCTAssertEqual(EventLog.kinds(), ["sidebar-select"])
        XCTAssertEqual(EventLog.events[0].json, #"{"id":"home"}"#)
    }

    func testKeyboardFocusReturnsToThePageAfterARowIsSelected() {
        let window = makeWindow()
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 700))
        window.contentView?.addSubview(webView)
        let controller = HarborNativeController(window: window, callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(
                visible: true, collapsed: false,
                items: [item("home", "browse", active: true), item("library", "library")]))
        window.makeFirstResponder(nil)
        controller.sidebar.model.select("library")
        RunLoop.main.run(until: Date().addingTimeInterval(0.1))
        XCTAssertTrue(window.firstResponder === webView)
    }

    func testFootReportsAccountAndSettingsClicks() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setSidebar(
            SidebarPayload(
                visible: true, collapsed: false, items: [item("home", "browse")],
                account: SidebarAccount(name: "Pratyush", initials: "PR"),
                settings: item("settings", "foot")))
        XCTAssertEqual(controller.sidebar.model.account?.initials, "PR")
        EventLog.events = []
        controller.sidebar.model.openAccount()
        controller.sidebar.model.select("settings")
        XCTAssertEqual(EventLog.kinds(), ["sidebar-account", "sidebar-select"])
    }
}

final class TitleBarDoubleClickTests: XCTestCase {
    func testFollowsTheSystemTitleBarSetting() {
        XCTAssertEqual(TitleBarDoubleClick(setting: "Minimize"), .minimize)
        XCTAssertEqual(TitleBarDoubleClick(setting: "None"), .none)
        XCTAssertEqual(TitleBarDoubleClick(setting: "Maximize"), .zoom)
    }

    func testZoomsWhenTheSettingIsUnsetOrUnknown() {
        XCTAssertEqual(TitleBarDoubleClick(setting: nil), .zoom)
        XCTAssertEqual(TitleBarDoubleClick(setting: "Fill"), .zoom)
    }
}
