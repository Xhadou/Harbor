import AppKit
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

    let model = SidebarModel()
    let search: SearchFieldController
    private let glass = NSGlassEffectView()
    private let onToggle: () -> Void
    private let layoutChanged: () -> Void

    var isShown: Bool { model.isShown }
    var isWanted: Bool { model.isWanted }

    init(
        window: NSWindow,
        emit: @escaping (String, any Encodable) -> Void,
        onToggle: @escaping () -> Void,
        layoutChanged: @escaping () -> Void
    ) {
        self.onToggle = onToggle
        self.layoutChanged = layoutChanged
        search = SearchFieldController(window: window, emit: emit)
        super.init()
        model.onSelect = { id in emit("sidebar-select", SidebarSelectPayload(id: id)) }
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
        glass.isHidden = true
        glass.translatesAutoresizingMaskIntoConstraints = false
        guard let content = window.contentView else { return }
        content.addSubview(glass, positioned: .above, relativeTo: nil)
        NSLayoutConstraint.activate([
            glass.topAnchor.constraint(equalTo: content.topAnchor, constant: Self.margin),
            glass.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: Self.margin),
            glass.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -Self.margin),
            glass.widthAnchor.constraint(equalToConstant: Self.width),
        ])
    }

    func apply(_ payload: SidebarPayload) {
        model.apply(payload)
        glass.isHidden = !model.isShown
        layoutChanged()
    }

    @objc private func toggleClicked(_ sender: Any?) {
        onToggle()
    }
}

/// Empty area that moves the window when dragged and zooms it on double-click,
/// like the title bar it sits under.
final class WindowDragView: NSView {
    override var mouseDownCanMoveWindow: Bool { true }

    override func mouseUp(with event: NSEvent) {
        if event.clickCount == 2 {
            window?.performZoom(nil)
        } else {
            super.mouseUp(with: event)
        }
    }
}
