import Observation
import SwiftUI

/// What the sidebar shows. Rebuilt from every payload the web app sends; the
/// web app owns navigation, so nothing here changes on its own.
@MainActor
@Observable
final class SidebarModel {
    private(set) var primary: [SidebarItem] = []
    private(set) var collections: [SidebarItem] = []
    private(set) var isShown = false
    @ObservationIgnored var onSelect: (String) -> Void = { _ in }

    var activeID: String? {
        (primary + collections).first(where: \.active)?.id
    }

    init() {}

    convenience init(payload: SidebarPayload) {
        self.init()
        apply(payload)
    }

    func apply(_ payload: SidebarPayload) {
        primary = payload.items.filter { $0.section == "primary" }
        collections = payload.items.filter { $0.section != "primary" }
        // Hidden outright when collapsed: no icon rail.
        isShown = payload.visible && !payload.collapsed
    }

    /// Reports the click. The highlight only moves when the web app answers
    /// with a new payload, so a refused navigation (PIN prompt) leaves it put.
    func select(_ id: String) {
        onSelect(id)
    }
}

struct SidebarView: View {
    let model: SidebarModel

    var body: some View {
        List(selection: selection) {
            Section {
                ForEach(model.primary) { row($0) }
            }
            Section {
                ForEach(model.collections) { row($0) }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
    }

    private var selection: Binding<String?> {
        Binding(
            get: { model.activeID },
            set: { id in
                if let id { model.select(id) }
            })
    }

    private func row(_ item: SidebarItem) -> some View {
        Label {
            HStack {
                Text(item.title)
                if item.gated {
                    Spacer()
                    Image(systemName: "lock.fill")
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Locked")
                }
            }
        } icon: {
            Image(systemName: SidebarItem.resolvedSymbol(for: item.symbol))
        }
        .badge(item.badge ?? 0)
        .tag(item.id)
    }
}
