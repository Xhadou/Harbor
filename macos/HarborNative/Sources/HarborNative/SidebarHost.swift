import AppKit
import QuartzCore
import SwiftUI

/// The floating Liquid Glass sidebar: a full-height pane above the web view.
/// From the top it holds the traffic lights' zone with the sidebar toggle,
/// the search field, the grouped navigation, and the account foot.
@MainActor
final class SidebarHost: NSObject {
    static let width: CGFloat = 240
    /// Gap between the pane and the window's left, top and bottom edges.
    static let margin: CGFloat = 8
    /// Height at the top of the pane kept for the traffic lights and toggle.
    static let headerHeight: CGFloat = 44
    /// How far down from the window's top edge floating controls reach.
    static let topZone: CGFloat = margin + headerHeight
    /// How long the pane takes to slide in or out when the person shows or hides it.
    static let slideDuration: TimeInterval = 0.34
    /// It moves off without a pause and takes most of its time to settle. The page's
    /// content follows on the same curve (`SIDEBAR_SLIDE_EASE` in native-layout.ts).
    static let slideCurve = CAMediaTimingFunction(controlPoints: 0.3, 0, 0.1, 1)
    /// The pane's leading edge when it is out of the window.
    private static let awayLeading: CGFloat = -(width + margin)

    let model = SidebarModel()
    let search: SearchFieldController
    private let glass = NSGlassEffectView()
    private var mount: GlassMount!
    private weak var window: NSWindow?
    private var leading: NSLayoutConstraint?
    /// Counts the changes of state, so a slide that was overtaken does not finish the old one.
    private var slideCount = 0
    private let onToggle: () -> Void
    private let layoutChanged: () -> Void

    var isShown: Bool { model.isShown }
    var isWanted: Bool { model.isWanted }
    /// How long the last change of state takes on screen, in milliseconds; 0 when it was at once.
    private(set) var motionMs: Double = 0

    init(
        window: NSWindow,
        emit: @escaping (String, any Encodable) -> Void,
        onToggle: @escaping () -> Void,
        layoutChanged: @escaping () -> Void
    ) {
        self.onToggle = onToggle
        self.layoutChanged = layoutChanged
        self.window = window
        search = SearchFieldController(window: window, emit: emit)
        super.init()
        model.onSelect = { [search] id in
            emit("sidebar-select", SidebarSelectPayload(id: id))
            // The list took the keyboard with the click. Hand it back, or the
            // arrow keys would walk the sidebar instead of the page.
            DispatchQueue.main.async { search.focusWebContent() }
        }
        model.onAccount = { emit("sidebar-account", EmptyPayload()) }

        let header = WindowDragView()
        let toggle = NSButton(
            image: NSImage(
                systemSymbolName: "sidebar.left", accessibilityDescription: "Hide Sidebar")
                ?? NSImage(),
            target: self, action: #selector(toggleClicked(_:)))
        toggle.isBordered = false
        toggle.contentTintColor = .secondaryLabelColor
        toggle.symbolConfiguration = .init(pointSize: 15, weight: .medium)
        toggle.toolTip = "Hide Sidebar"

        let list = NSHostingView(rootView: SidebarList(model: model))
        let foot = NSHostingView(rootView: SidebarFoot(model: model))
        let pane = NSView()
        for view in [header, toggle, search.field, list, foot] {
            view.translatesAutoresizingMaskIntoConstraints = false
            pane.addSubview(view)
        }
        // With the field hidden the list moves up to the header.
        let listUnderField = list.topAnchor.constraint(
            equalTo: search.field.bottomAnchor, constant: 6)
        listUnderField.priority = .defaultHigh
        let listUnderHeader = list.topAnchor.constraint(
            greaterThanOrEqualTo: header.bottomAnchor)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: pane.topAnchor),
            header.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: pane.trailingAnchor),
            header.heightAnchor.constraint(equalToConstant: Self.headerHeight),
            toggle.trailingAnchor.constraint(equalTo: pane.trailingAnchor, constant: -12),
            toggle.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            search.field.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 2),
            search.field.leadingAnchor.constraint(equalTo: pane.leadingAnchor, constant: 12),
            search.field.trailingAnchor.constraint(equalTo: pane.trailingAnchor, constant: -12),
            listUnderField, listUnderHeader,
            list.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            list.trailingAnchor.constraint(equalTo: pane.trailingAnchor),
            list.bottomAnchor.constraint(equalTo: foot.topAnchor),
            foot.leadingAnchor.constraint(equalTo: pane.leadingAnchor),
            foot.trailingAnchor.constraint(equalTo: pane.trailingAnchor),
            foot.bottomAnchor.constraint(equalTo: pane.bottomAnchor),
        ])

        glass.contentView = pane
        glass.cornerRadius = 18
        mount = GlassMount(glass, in: window.contentView) { [weak self] glass, content in
            let leading = glass.leadingAnchor.constraint(
                equalTo: content.leadingAnchor, constant: Self.margin)
            self?.leading = leading
            return [
                glass.topAnchor.constraint(equalTo: content.topAnchor, constant: Self.margin),
                leading,
                glass.bottomAnchor.constraint(
                    equalTo: content.bottomAnchor, constant: -Self.margin),
                glass.widthAnchor.constraint(equalToConstant: Self.width),
            ]
        }
    }

    func apply(_ payload: SidebarPayload) {
        let wasWanted = model.isWanted
        let wasShown = model.isShown
        model.apply(payload)
        // The pane slides only when the person shows or hides it on a view that has a
        // sidebar. A view without one (the player) takes it away, and gives it back, at once.
        let slides =
            wasWanted && model.isWanted && wasShown != model.isShown && Self.canSlide(in: window)
        setShown(model.isShown, sliding: slides)
        motionMs = slides ? Self.slideDuration * 1000 : 0
        layoutChanged()
        motionMs = 0
    }

    /// Nothing slides in a window nobody can see, or for someone who asked for less motion.
    private static func canSlide(in window: NSWindow?) -> Bool {
        guard let window, window.isVisible, window.occlusionState.contains(.visible) else {
            return false
        }
        return !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    private func setShown(_ shown: Bool, sliding: Bool) {
        slideCount += 1
        let count = slideCount
        guard sliding else {
            mount.setMounted(shown)
            leading?.constant = Self.margin
            return
        }
        if shown {
            // A pane still on its way out turns round from where it is.
            if !mount.isMounted {
                mount.setMounted(true)
                leading?.constant = Self.awayLeading
                glass.superview?.layoutSubtreeIfNeeded()
            }
            slide(to: Self.margin) {}
        } else {
            guard mount.isMounted else { return }
            slide(to: Self.awayLeading) { [weak self] in
                guard let self, self.slideCount == count else { return }
                self.mount.setMounted(false)
            }
        }
    }

    private func slide(to constant: CGFloat, then finish: @escaping @MainActor () -> Void) {
        NSAnimationContext.runAnimationGroup(
            { context in
                context.duration = Self.slideDuration
                context.timingFunction = Self.slideCurve
                context.allowsImplicitAnimation = true
                leading?.animator().constant = constant
                glass.superview?.layoutSubtreeIfNeeded()
            },
            completionHandler: { MainActor.assumeIsolated { finish() } })
    }

    @objc private func toggleClicked(_ sender: Any?) {
        onToggle()
    }
}

/// Empty area that behaves like the title bar it sits under: drag it to move
/// the window, double-click it for the user's title-bar action.
///
/// `mouseDownCanMoveWindow` is not enough here: it only moves windows that are
/// movable by their background, which Harbor's is not.
final class WindowDragView: NSView {
    override func mouseDown(with event: NSEvent) {
        guard let window else { return }
        if event.clickCount == 2 {
            TitleBarDoubleClick.current.perform(on: window)
        } else {
            window.performDrag(with: event)
        }
    }
}

/// What double-clicking a title bar does, from System Settings › Desktop & Dock.
enum TitleBarDoubleClick: Equatable {
    case zoom, minimize, none

    init(setting: String?) {
        switch setting {
        case "Minimize": self = .minimize
        case "None": self = .none
        default: self = .zoom
        }
    }

    static var current: TitleBarDoubleClick {
        TitleBarDoubleClick(setting: UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick"))
    }

    @MainActor
    func perform(on window: NSWindow) {
        switch self {
        case .zoom: window.zoom(nil)
        case .minimize: window.miniaturize(nil)
        case .none: break
        }
    }
}
