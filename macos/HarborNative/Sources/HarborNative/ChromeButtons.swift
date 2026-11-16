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
    private var backLeadingConstraint: NSLayoutConstraint?
    private var chromeVisible = true
    private var canGoBack = false
    private var sidebarShown = false
    private var sidebarWanted = false

    var isBackShown: Bool { !back.isHidden }
    var isFloatingToggleShown: Bool { !toggle.isHidden }
    var backLeading: CGFloat { backLeadingConstraint?.constant ?? 0 }

    init(window: NSWindow, emit: @escaping (String, any Encodable) -> Void) {
        self.emit = emit
        super.init()
        back.button.target = self
        back.button.action = #selector(goBack(_:))
        toggle.button.target = self
        toggle.button.action = #selector(toggleSidebar(_:))

        guard let content = window.contentView else { return }
        for view in [back, toggle] {
            view.translatesAutoresizingMaskIntoConstraints = false
            content.addSubview(view, positioned: .above, relativeTo: nil)
            NSLayoutConstraint.activate([
                view.topAnchor.constraint(equalTo: content.topAnchor, constant: Self.top),
                view.widthAnchor.constraint(equalToConstant: Self.size),
                view.heightAnchor.constraint(equalToConstant: Self.size),
            ])
        }
        toggle.leadingAnchor.constraint(
            equalTo: content.leadingAnchor, constant: Self.afterTrafficLights
        ).isActive = true
        let leading = back.leadingAnchor.constraint(equalTo: content.leadingAnchor)
        leading.isActive = true
        backLeadingConstraint = leading
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
        back.isHidden = !(chromeVisible && canGoBack)
        // Only offered where the user hid the sidebar, not where the view has none.
        toggle.isHidden = !(chromeVisible && sidebarWanted && !sidebarShown)
        if sidebarShown {
            backLeadingConstraint?.constant = SidebarHost.margin + SidebarHost.width + 12
        } else if toggle.isHidden {
            backLeadingConstraint?.constant = Self.afterTrafficLights
        } else {
            backLeadingConstraint?.constant = Self.afterTrafficLights + Self.size + Self.gap
        }
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
