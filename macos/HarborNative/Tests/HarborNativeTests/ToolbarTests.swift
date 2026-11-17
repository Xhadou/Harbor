import AppKit
import XCTest

@testable import HarborNative

/// Collects what the package reports through the C callback.
enum EventLog {
    nonisolated(unsafe) static var events: [(kind: String, json: String)] = []
    static let callback: HarborNativeCallback = { kind, json in
        EventLog.events.append((String(cString: kind), String(cString: json)))
    }
    static func kinds() -> [String] { events.map(\.kind) }
}

@MainActor
final class ChromeTests: XCTestCase {
    private func makeWindow() -> NSWindow {
        NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: true)
    }

    private let home = SidebarItem(
        id: "home", title: "Home", symbol: "house", section: "browse", active: true,
        gated: false, badge: nil)

    override func setUp() {
        EventLog.events = []
    }

    func testNoSystemToolbarSoWebContentAtTheTopStaysClickable() {
        let window = makeWindow()
        _ = HarborNativeController(window: window, callback: EventLog.callback)
        XCTAssertNil(window.toolbar)
    }

    func testSearchKeyMapping() {
        XCTAssertEqual(SearchFieldController.searchKey(for: #selector(NSResponder.moveUp(_:))), "ArrowUp")
        XCTAssertEqual(
            SearchFieldController.searchKey(for: #selector(NSResponder.moveDown(_:))), "ArrowDown")
        XCTAssertEqual(
            SearchFieldController.searchKey(for: #selector(NSResponder.insertNewline(_:))), "Enter")
        XCTAssertEqual(
            SearchFieldController.searchKey(for: #selector(NSResponder.cancelOperation(_:))),
            "Escape")
        XCTAssertNil(SearchFieldController.searchKey(for: #selector(NSResponder.moveLeft(_:))))
    }

    func testBackButtonShowsOnlyWhenThereIsSomewhereToGoBackTo() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: true))
        XCTAssertFalse(controller.chrome.isBackShown)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: true, searchVisible: true))
        XCTAssertTrue(controller.chrome.isBackShown)
        controller.setToolbar(ToolbarPayload(visible: false, canGoBack: true, searchVisible: true))
        XCTAssertFalse(controller.chrome.isBackShown)
    }

    func testFloatingToggleAppearsOnlyWhileTheSidebarIsHidden() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: true))
        controller.setSidebar(SidebarPayload(visible: true, collapsed: false, items: [home]))
        XCTAssertFalse(controller.chrome.isFloatingToggleShown)
        controller.setSidebar(SidebarPayload(visible: true, collapsed: true, items: [home]))
        XCTAssertTrue(controller.chrome.isFloatingToggleShown)
        // The web app hid the sidebar itself (player, settings): no toggle either.
        controller.setSidebar(SidebarPayload(visible: false, collapsed: true, items: [home]))
        XCTAssertFalse(controller.chrome.isFloatingToggleShown)
    }

    func testBackStartsAtTheContentEdge() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: true, searchVisible: true))
        controller.setSidebar(SidebarPayload(visible: true, collapsed: false, items: [home]))
        let beside = controller.chrome.backLeading
        controller.setSidebar(SidebarPayload(visible: true, collapsed: true, items: [home]))
        XCTAssertGreaterThan(beside, SidebarHost.margin + SidebarHost.width)
        XCTAssertLessThan(controller.chrome.backLeading, beside)
    }

    func testButtonsEmitEvents() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        EventLog.events = []
        controller.chrome.goBack(nil)
        controller.chrome.toggleSidebar(nil)
        XCTAssertEqual(EventLog.kinds(), ["toolbar-back", "toolbar-toggle-sidebar"])
        XCTAssertEqual(EventLog.events[0].json, "{}")
    }

    func testLayoutReportsTheTopControlsZone() throws {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        XCTAssertEqual(EventLog.kinds().first, "layout")
        EventLog.events = []
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: true))
        let event = try XCTUnwrap(EventLog.events.last { $0.kind == "layout" })
        let payload = try JSONDecoder().decode(LayoutPayload.self, from: Data(event.json.utf8))
        XCTAssertEqual(payload.titlebarInset, Double(SidebarHost.topZone))
        XCTAssertFalse(payload.sidebarVisible)
        XCTAssertEqual(payload.sidebarWidth, 0)
    }

    func testLayoutReportsWhereControlsClearTheTrafficLights() throws {
        _ = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        let event = try XCTUnwrap(EventLog.events.last { $0.kind == "layout" })
        let payload = try JSONDecoder().decode(LayoutPayload.self, from: Data(event.json.utf8))
        XCTAssertEqual(payload.controlsInset, Double(ChromeButtons.afterTrafficLights))
    }

    func testSearchSetUpdatesFieldWithoutEchoingText() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        EventLog.events = []
        controller.setSearch(SearchPayload(text: "dune", focused: nil))
        XCTAssertEqual(controller.sidebar.search.text, "dune")
        XCTAssertFalse(EventLog.kinds().contains("search-text"))
    }

    func testSearchFieldHidesWhereHarborHasNoGlobalSearch() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: false))
        XCTAssertTrue(controller.sidebar.search.isHidden)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: true))
        XCTAssertFalse(controller.sidebar.search.isHidden)
    }
}
