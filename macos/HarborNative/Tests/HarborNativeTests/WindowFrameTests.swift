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
