import AppKit

/// The two floating glass buttons outside the sidebar: Back, and the sidebar
/// toggle while the sidebar is hidden. They are plain subviews of the content
/// view, not a system toolbar: a toolbar swallows every click across the top
/// of the window, and Harbor's own buttons live up there too.
@MainActor
final class ChromeButtons: NSObject {
    static let size: CGFloat = 36
    /// Distance from the window's top edge, lining up with the traffic lights.
    static let top: CGFloat = 12
    /// Left edge when the sidebar is hidden: just past the traffic lights.
    static let afterTrafficLights: CGFloat = 92
    static let gap: CGFloat = 8

    private let emit: (String, any Encodable) -> Void
    private let back = GlassButton(symbol: "chevron.backward", label: "Back")
    private let toggle = GlassButton(symbol: "sidebar.left", label: "Show Sidebar")
    private var backMount: GlassMount!
    private var toggleMount: GlassMount!
    private var backLeadingConstraint: NSLayoutConstraint?
    private var backLeadingValue: CGFloat = 0
    private var chromeVisible = true
    private var canGoBack = false
    private var sidebarShown = false
    private var sidebarWanted = false

    var isBackShown: Bool { backMount.isMounted }
    var isFloatingToggleShown: Bool { toggleMount.isMounted }
    var backLeading: CGFloat { backLeadingValue }

    init(window: NSWindow, emit: @escaping (String, any Encodable) -> Void) {
        self.emit = emit
        super.init()
        back.button.target = self
        back.button.action = #selector(goBack(_:))
        toggle.button.target = self
        toggle.button.action = #selector(toggleSidebar(_:))

        func square(_ view: NSView, _ content: NSView) -> [NSLayoutConstraint] {
            [
                view.topAnchor.constraint(equalTo: content.topAnchor, constant: Self.top),
                view.widthAnchor.constraint(equalToConstant: Self.size),
                view.heightAnchor.constraint(equalToConstant: Self.size),
            ]
        }
        toggleMount = GlassMount(toggle, in: window.contentView) { view, content in
            square(view, content) + [
                view.leadingAnchor.constraint(
                    equalTo: content.leadingAnchor, constant: Self.afterTrafficLights)
            ]
        }
        backMount = GlassMount(back, in: window.contentView) { [weak self] view, content in
            let leading = view.leadingAnchor.constraint(
                equalTo: content.leadingAnchor, constant: self?.backLeadingValue ?? 0)
            self?.backLeadingConstraint = leading
            return square(view, content) + [leading]
        }
        refresh()
    }

    func apply(_ payload: ToolbarPayload) {
        chromeVisible = payload.visible
        canGoBack = payload.canGoBack
        refresh()
    }

    /// `wanted`: the web app wants a sidebar on this view. `shown`: it is on screen.
    func sidebarChanged(wanted: Bool, shown: Bool) {
        sidebarWanted = wanted
        sidebarShown = shown
        refresh()
    }

    private func refresh() {
        // Only offered where the user hid the sidebar, not where the view has none.
        let showToggle = chromeVisible && sidebarWanted && !sidebarShown
        if sidebarShown {
            backLeadingValue = SidebarHost.margin + SidebarHost.width + 12
        } else if showToggle {
            backLeadingValue = Self.afterTrafficLights + Self.size + Self.gap
        } else {
            backLeadingValue = Self.afterTrafficLights
        }
        toggleMount.setMounted(showToggle)
        backMount.setMounted(chromeVisible && canGoBack)
        backLeadingConstraint?.constant = backLeadingValue
    }

    @objc func goBack(_ sender: Any?) {
        emit("toolbar-back", EmptyPayload())
    }

    @objc func toggleSidebar(_ sender: Any?) {
        emit("toolbar-toggle-sidebar", EmptyPayload())
    }
}

/// A round Liquid Glass button with one SF Symbol.
@MainActor
final class GlassButton: NSGlassEffectView {
    let button: NSButton

    init(symbol: String, label: String) {
        let image =
            NSImage(systemSymbolName: symbol, accessibilityDescription: label) ?? NSImage()
        button = NSButton(image: image, target: nil, action: nil)
        super.init(frame: .zero)
        button.isBordered = false
        button.imagePosition = .imageOnly
        button.symbolConfiguration = .init(pointSize: 14, weight: .semibold)
        button.contentTintColor = .labelColor
        button.toolTip = label
        button.setAccessibilityLabel(label)
        cornerRadius = ChromeButtons.size / 2
        contentView = button
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }
}

/// Puts a glass view into the window's content view only while it should be
/// seen. A hidden `NSGlassEffectView` can still leave a faint outline of its
/// shape (seen when rendering off-screen), which must never sit over a video,
/// so the view is taken out of the hierarchy instead of being hidden.
@MainActor
final class GlassMount {
    let view: NSGlassEffectView
    private weak var container: NSView?
    private let constraints: (NSView, NSView) -> [NSLayoutConstraint]

    var isMounted: Bool { view.superview != nil }

    /// `constraints` receives the glass view and the container it was added to.
    init(
        _ view: NSGlassEffectView, in container: NSView?,
        constraints: @escaping (NSView, NSView) -> [NSLayoutConstraint]
    ) {
        self.view = view
        self.container = container
        self.constraints = constraints
        view.translatesAutoresizingMaskIntoConstraints = false
    }

    func setMounted(_ mounted: Bool) {
        guard mounted != isMounted, let container else { return }
        if mounted {
            container.addSubview(view, positioned: .above, relativeTo: nil)
            NSLayoutConstraint.activate(constraints(view, container))
        } else {
            view.removeFromSuperview()
        }
    }
}
