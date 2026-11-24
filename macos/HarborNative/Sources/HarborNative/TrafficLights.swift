import AppKit

/// Puts the traffic lights back where the window was made to have them.
///
/// The window is created with the lights moved in from the corner
/// (`trafficLightPosition` in `src-tauri/tauri.macos.conf.json`), and the
/// windowing library puts them back there when the window is redrawn or
/// resized. The system also lays the title bar out again on its own, with no
/// redraw, and that returns the lights to the corner until the next resize:
/// seen when the window is recorded or shared on its own, which puts a sharing
/// badge in the title bar. This watches the lights and moves them back.
@MainActor
final class TrafficLights {
    /// The same two numbers as `trafficLightPosition` in the Tauri config.
    static let x: CGFloat = 22
    static let y: CGFloat = 32
    /// A layout that keeps undoing the move must not turn into a loop.
    private static let mostPerSecond = 6

    private weak var window: NSWindow?
    private var observers: [NSObjectProtocol] = []
    private var pending = false
    private var recent: [Date] = []

    init(window: NSWindow) {
        self.window = window
        guard let close = window.standardWindowButton(.closeButton),
            let container = close.superview?.superview
        else { return }
        for view in [close, container] {
            view.postsFrameChangedNotifications = true
            observers.append(
                NotificationCenter.default.addObserver(
                    forName: NSView.frameDidChangeNotification, object: view, queue: .main
                ) { [weak self] _ in
                    MainActor.assumeIsolated { self?.schedule() }
                })
        }
    }

    /// After the layout that moved them has finished, not inside it.
    private func schedule() {
        guard !pending else { return }
        pending = true
        DispatchQueue.main.async { [weak self] in
            MainActor.assumeIsolated {
                self?.pending = false
                self?.restore()
            }
        }
    }

    /// Whether the lights are somewhere other than where they belong.
    var isDisplaced: Bool {
        guard let window, let close = window.standardWindowButton(.closeButton),
            let container = close.superview?.superview
        else { return false }
        return abs(close.frame.origin.x - Self.x) > 0.5
            || abs(container.frame.height - (close.frame.height + Self.y)) > 0.5
    }

    func restore() {
        guard let window, !window.styleMask.contains(.fullScreen), isDisplaced,
            let close = window.standardWindowButton(.closeButton),
            let miniaturize = window.standardWindowButton(.miniaturizeButton),
            let zoom = window.standardWindowButton(.zoomButton),
            let container = close.superview?.superview
        else { return }
        let now = Date()
        recent = recent.filter { now.timeIntervalSince($0) < 1 }
        guard recent.count < Self.mostPerSecond else { return }
        recent.append(now)

        // The same arithmetic the windowing library uses, so the two agree.
        let height = close.frame.height + Self.y
        var frame = container.frame
        frame.size.height = height
        frame.origin.y = window.frame.height - height
        container.frame = frame
        let spacing = miniaturize.frame.origin.x - close.frame.origin.x
        for (index, button) in [close, miniaturize, zoom].enumerated() {
            button.setFrameOrigin(
                NSPoint(x: Self.x + CGFloat(index) * spacing, y: button.frame.origin.y))
        }
    }
}
