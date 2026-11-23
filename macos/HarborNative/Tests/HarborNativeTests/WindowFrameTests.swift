import AppKit
import XCTest

@testable import HarborNative

@MainActor
final class WindowFrameTests: XCTestCase {
    private func makeWindow() -> NSWindow {
        NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: true)
    }

    func testInstallExtendsContentUnderTransparentTitleBar() {
        let window = makeWindow()
        _ = HarborNativeController(window: window, callback: { _, _ in })
        XCTAssertTrue(window.styleMask.contains(.fullSizeContentView))
        XCTAssertTrue(window.titlebarAppearsTransparent)
        XCTAssertEqual(window.titleVisibility, .hidden)
    }

    func testFrameIsRestoredAfterStyleMaskIsReplaced() {
        let window = makeWindow()
        let controller = HarborNativeController(window: window, callback: { _, _ in })
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        controller.applyWindowFrame()
        XCTAssertTrue(window.styleMask.contains(.fullSizeContentView))
    }
}

/// The page keeps no full screen state of its own: it follows what the window
/// reports. A report made in the middle of a transition has to name the state
/// the window is going to, or the page turns back and fights the animation.
@MainActor
final class FullScreenReportTests: XCTestCase {
    private func makeWindow() -> NSWindow {
        NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: true)
    }

    /// Decoded, because the order of a report's keys is not part of what it says.
    private func lastFullScreenReport() -> FullScreenPayload? {
        guard let json = EventLog.events.last(where: { $0.kind == "fullscreen" })?.json else {
            return nil
        }
        return try? JSONDecoder().decode(FullScreenPayload.self, from: Data(json.utf8))
    }

    private func post(_ name: Notification.Name, _ window: NSWindow) {
        NotificationCenter.default.post(name: name, object: window)
    }

    func testToolbarUpdateWhileEnteringReportsFullScreen() {
        let window = makeWindow()
        let controller = HarborNativeController(window: window, callback: EventLog.callback)
        post(NSWindow.willEnterFullScreenNotification, window)
        EventLog.events = []
        controller.setToolbar(ToolbarPayload(visible: false, canGoBack: false, searchVisible: false))
        XCTAssertEqual(lastFullScreenReport(), FullScreenPayload(on: true, settled: false))
    }

    func testToolbarUpdateWhileLeavingReportsWindowed() {
        let window = makeWindow()
        let controller = HarborNativeController(window: window, callback: EventLog.callback)
        post(NSWindow.willEnterFullScreenNotification, window)
        post(NSWindow.didEnterFullScreenNotification, window)
        post(NSWindow.willExitFullScreenNotification, window)
        EventLog.events = []
        controller.setToolbar(ToolbarPayload(visible: false, canGoBack: false, searchVisible: false))
        XCTAssertEqual(lastFullScreenReport(), FullScreenPayload(on: false, settled: false))
    }

    /// Whoever waits for the window to be out of full screen (closing it puts it
    /// away only then) has to tell the end of the animation from its start.
    func testLeavingIsReportedSettledOnlyWhenTheAnimationHasEnded() {
        let window = makeWindow()
        let controller = HarborNativeController(window: window, callback: EventLog.callback)
        withExtendedLifetime(controller) {
            post(NSWindow.willEnterFullScreenNotification, window)
            post(NSWindow.didEnterFullScreenNotification, window)
            post(NSWindow.willExitFullScreenNotification, window)
            XCTAssertEqual(lastFullScreenReport(), FullScreenPayload(on: false, settled: false))
            post(NSWindow.didExitFullScreenNotification, window)
            XCTAssertEqual(lastFullScreenReport(), FullScreenPayload(on: false, settled: true))
        }
    }

    func testToolbarUpdateBeforeAnyTransitionReadsTheWindow() {
        let window = makeWindow()
        let controller = HarborNativeController(window: window, callback: EventLog.callback)
        EventLog.events = []
        controller.setToolbar(ToolbarPayload(visible: true, canGoBack: false, searchVisible: true))
        XCTAssertEqual(lastFullScreenReport(), FullScreenPayload(on: false, settled: true))
    }
}
