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
final class ToolbarTests: XCTestCase {
    private func makeWindow() -> NSWindow {
        NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: true)
    }

    override func setUp() {
        EventLog.events = []
    }

    func testToolbarPayloadControlsVisibilityBackAndSearch() {
        let window = makeWindow()
        let controller = HarborNativeController(window: window, callback: EventLog.callback)
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: false))
        XCTAssertEqual(window.toolbar?.isVisible, true)
        XCTAssertFalse(controller.toolbar.isBackEnabled)
        XCTAssertTrue(controller.toolbar.isSearchHidden)
        controller.setToolbar(ToolbarPayload(visible: false, canGoBack: true, searchVisible: true))
        XCTAssertEqual(window.toolbar?.isVisible, false)
        XCTAssertTrue(controller.toolbar.isBackEnabled)
        XCTAssertFalse(controller.toolbar.isSearchHidden)
    }

    func testToolbarActionsEmitEvents() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        EventLog.events = []
        controller.toolbar.goBack(nil)
        controller.toolbar.toggleSidebar(nil)
        XCTAssertEqual(EventLog.kinds(), ["toolbar-back", "toolbar-toggle-sidebar"])
        XCTAssertEqual(EventLog.events[0].json, "{}")
    }

    func testInstallAndToolbarChangesReportLayout() throws {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        XCTAssertEqual(EventLog.kinds().first, "layout")
        EventLog.events = []
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: true))
        let layout = try XCTUnwrap(EventLog.events.last { $0.kind == "layout" })
        let payload = try JSONDecoder().decode(LayoutPayload.self, from: Data(layout.json.utf8))
        XCTAssertFalse(payload.sidebarVisible)
        XCTAssertEqual(payload.sidebarWidth, 0)
    }

    func testSearchSetUpdatesFieldWithoutEchoingText() {
        let controller = HarborNativeController(window: makeWindow(), callback: EventLog.callback)
        EventLog.events = []
        controller.setSearch(SearchPayload(text: "dune", focused: nil))
        XCTAssertEqual(controller.toolbar.searchText, "dune")
        XCTAssertFalse(EventLog.kinds().contains("search-text"))
    }

    func testToolbarItemOrder() {
        XCTAssertEqual(
            ToolbarController.itemIdentifiers,
            [.harborToggleSidebar, .harborBack, .flexibleSpace, .harborSearch])
    }

    func testSearchKeyMapping() {
        XCTAssertEqual(ToolbarController.searchKey(for: #selector(NSResponder.moveUp(_:))), "ArrowUp")
        XCTAssertEqual(
            ToolbarController.searchKey(for: #selector(NSResponder.moveDown(_:))), "ArrowDown")
        XCTAssertEqual(
            ToolbarController.searchKey(for: #selector(NSResponder.insertNewline(_:))), "Enter")
        XCTAssertEqual(
            ToolbarController.searchKey(for: #selector(NSResponder.cancelOperation(_:))), "Escape")
        XCTAssertNil(ToolbarController.searchKey(for: #selector(NSResponder.moveLeft(_:))))
    }

    func testTitlebarInsetIsFrameMinusContentLayout() {
        let frame = NSRect(x: 0, y: 0, width: 800, height: 600)
        let layout = NSRect(x: 0, y: 0, width: 800, height: 548)
        XCTAssertEqual(LayoutPayload.titlebarInset(frame: frame, contentLayout: layout), 52)
        XCTAssertEqual(LayoutPayload.titlebarInset(frame: frame, contentLayout: frame), 0)
    }
}
