import Observation
import SwiftUI

/// What the sidebar shows. Rebuilt from every payload the web app sends; the
/// web app owns navigation, so nothing here changes on its own.
@MainActor
@Observable
final class SidebarModel {
    struct Group: Identifiable {
        var section: SidebarSection
        var items: [SidebarItem]
        var id: String { section.id }
    }

    private(set) var groups: [Group] = []
    private(set) var account: SidebarAccount?
    private(set) var settings: SidebarItem?
    private(set) var isShown = false
    /// The web app wants a sidebar on this view (it may still be collapsed).
    private(set) var isWanted = false
    @ObservationIgnored var onSelect: (String) -> Void = { _ in }
    @ObservationIgnored var onAccount: () -> Void = {}

    var activeID: String? {
        groups.lazy.flatMap(\.items).first(where: \.active)?.id
    }

    init() {}

    convenience init(payload: SidebarPayload) {
        self.init()
        apply(payload)
    }

    func apply(_ payload: SidebarPayload) {
        // Listed sections first, in order; anything else keeps its own group so
        // an item the web app adds later is never dropped.
        var order = (payload.sections ?? []).map(\.id)
        for item in payload.items where !order.contains(item.section) {
            order.append(item.section)
        }
        let titles = Dictionary(
            (payload.sections ?? []).map { ($0.id, $0.title) }, uniquingKeysWith: { first, _ in first })
        groups = order.compactMap { id in
            let items = payload.items.filter { $0.section == id }
            guard !items.isEmpty else { return nil }
            return Group(section: SidebarSection(id: id, title: titles[id] ?? nil), items: items)
        }
        account = payload.account
        settings = payload.settings
        isWanted = payload.visible
        // Hidden outright when collapsed: no icon rail.
        isShown = payload.visible && !payload.collapsed
    }

    /// Reports the click. The highlight only moves when the web app answers
    /// with a new payload, so a refused navigation (PIN prompt) leaves it put.
    func select(_ id: String) {
        onSelect(id)
    }

    func openAccount() {
        onAccount()
    }
}

/// The grouped navigation list.
struct SidebarList: View {
    let model: SidebarModel

    var body: some View {
        List(selection: selection) {
            ForEach(model.groups) { group in
                Section {
                    ForEach(group.items) { row($0) }
                } header: {
                    if let title = group.section.title {
                        Text(title)
                    }
                }
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

/// The foot of the sidebar: the profile on the left, Settings on the right.
struct SidebarFoot: View {
    let model: SidebarModel

    var body: some View {
        HStack(spacing: 8) {
            if let account = model.account {
                Button(action: model.openAccount) {
                    HStack(spacing: 8) {
                        Text(account.initials)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 26, height: 26)
                            .background(Circle().fill(Color.accentColor))
                        Text(account.name)
                            .font(.system(size: 13, weight: .medium))
                            .lineLimit(1)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Account: \(account.name)")
            }
            Spacer(minLength: 0)
            if let settings = model.settings {
                Button {
                    model.select(settings.id)
                } label: {
                    Image(systemName: settings.gated ? "lock.fill" : "gearshape")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(settings.active ? Color.accentColor : Color.secondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(settings.title)
                .accessibilityLabel(settings.title)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
