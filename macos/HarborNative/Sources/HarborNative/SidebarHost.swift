import AppKit
import SwiftUI

/// The floating Liquid Glass pane that holds the navigation list. It sits in
/// the window's content view above the web view, below the toolbar.
@MainActor
final class SidebarHost {
    static let width: CGFloat = 240
    /// Gap between the pane and the window's left, bottom and toolbar edges.
    static let margin: CGFloat = 8

    let model = SidebarModel()
    private let glass = NSGlassEffectView()
    private let layoutChanged: () -> Void

    var isShown: Bool { model.isShown }

    init(
        window: NSWindow,
        onSelect: @escaping (String) -> Void,
        layoutChanged: @escaping () -> Void
    ) {
        self.layoutChanged = layoutChanged
        model.onSelect = onSelect

        glass.contentView = NSHostingView(rootView: SidebarView(model: model))
        glass.cornerRadius = 16
        glass.isHidden = true
        glass.translatesAutoresizingMaskIntoConstraints = false

        guard let content = window.contentView else { return }
        content.addSubview(glass, positioned: .above, relativeTo: nil)
        // The layout guide ends where the title bar and toolbar begin.
        let top =
            (window.contentLayoutGuide as? NSLayoutGuide)?.topAnchor ?? content.topAnchor
        NSLayoutConstraint.activate([
            glass.topAnchor.constraint(equalTo: top, constant: Self.margin),
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
}
