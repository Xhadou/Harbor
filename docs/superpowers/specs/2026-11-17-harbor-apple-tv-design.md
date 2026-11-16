# Harbor for Mac — Apple TV-style look

Date: 2026-11-17
Status: approved in conversation; the owner asked for autonomous work from here.
Builds on: `2026-11-16-harbor-mac-native-design.md` (workstream 1 is built through Task 6).

## Intent

The first native pass works but does not look put together: the sidebar is a
boxed pane hanging under a separate toolbar strip, search is stranded
top-right, the account sits on a second row, and the glass has only flat
black behind it because pages are boxed in beside it.

The owner wants the app to feel like the Apple TV app on macOS, with a
floating glass sidebar and the app laid out properly around and under it,
while keeping every Harbor section and feature.

## Decisions the owner made

- **Scope now:** the shell, Home, and the title (detail) page. All other
  pages follow later, so whatever is built must extend to them page by page.
- **Sidebar:** floating glass, Apple TV-style groups:
  Search; Home, Discover, Movies, Shows, Anime, Live TV; **Library**: My
  Library, Collections, Downloads, Calendar; **More**: Catalogs, Music,
  Games, Manga, eBook, Addons; account and Settings at the foot.
- **Look:** one dark, artwork-led look on macOS. Harbor's theme picker does
  not restyle the redesigned pages.
- **Play:** Harbor's current behaviour is kept; only the page around it changes.
- **Test content:** the owner's own backup, restored into the fork.

## Goals

1. One full-height floating sidebar that holds the traffic lights, search,
   navigation and account. No separate toolbar strip, no second top row.
2. Artwork runs edge to edge: the Home hero and the title-page backdrop reach
   the top of the window and pass under the sidebar. Rows of posters scroll
   under the glass. Text and buttons at rest never sit under it.
3. Every Harbor section stays one click away, and every feature reachable
   today stays reachable (notifications, Together, downloads, bookmarks,
   account switching, navigation editing in Settings).
4. Pages not yet converted keep working exactly as now, placed beside the
   sidebar, so the app is usable at every step.

## Non-goals

- Converting pages other than Home and the title page in this round.
- Rewriting pages in SwiftUI, changing playback, or the player UI.
- Light appearance.

## Anti-goals

- Web-drawn imitations of glass or of native controls.
- A converted page whose text, cards at rest, or buttons hide under the sidebar.
- Losing a feature without listing it.
- Calling something done that was not looked at in a screenshot.

## Approaches

- **A. Keep the toolbar strip, polish it.** Cheapest, but the strip and the
  boxed pages are exactly what looks wrong.
- **B. Real `NSSplitViewController` sidebar with the web view as the detail
  pane.** The most standard AppKit structure, but the web view would then end
  at the sidebar edge, so artwork could not pass under the glass, and Tauri
  owns the content view.
- **C. Full-height floating glass pane over a full-bleed web view (chosen).**
  The web view fills the window. The native pane floats above it. Each
  converted page lays itself out with two CSS lengths (sidebar inset, top
  inset); unconverted pages are inset as a whole. This is what makes
  artwork-under-glass possible and lets pages convert one at a time.

## Design

### Shell (native)

- Sidebar pane: 8 pt from the window's left, top and bottom edges, 240 pt
  wide, full height, `NSGlassEffectView`. Top zone is left free for the
  traffic lights and the sidebar toggle. Below it: a search field, then the
  grouped list with small section headings, then a foot row with the profile
  (avatar initial and name) and a Settings button.
- Toolbar: only the sidebar toggle and Back remain, as floating glass
  buttons. Back sits at the start of the content area. No search item.
- Search: typing in the sidebar field drives Harbor's existing search and
  results. When the sidebar is hidden, Harbor's own search input is used.
- Account: clicking the profile row opens Harbor's existing account menu,
  anchored beside the sidebar foot.
- The web app remains the source of truth for items, active item, labels,
  gating, and visibility. Group membership is decided in the web mapping.

### Web layout contract

Two CSS lengths, set from Swift's layout reports:

- `--mac-sidebar-inset`: where content at rest must start (0 when hidden).
- `--mac-top-inset`: height of the floating controls zone at the top.

Pages are full-bleed by default on macOS. A page that has **not** been
converted is wrapped so its whole box starts at the sidebar inset. A
converted page opts in (`data-mac-bleed`) and uses the lengths itself:
backdrops ignore them, text blocks and row starts respect them, horizontal
rails scroll under the glass with their first card at the inset.

Harbor's web top bar keeps its right-hand buttons (notifications, Together,
downloads, bookmarks) at the top-right corner, level with the native buttons.
Its search pill, Back button and account pill are not shown on macOS.

### Home

Full-bleed hero from the window's top-left corner, with the title art, one
line of metadata, a short synopsis, Play and Watchlist aligned at the sidebar
inset; a soft dark fade at the bottom and left for legibility. Rows follow
with calm headings; cards have no hover scaling. Setup banners sit in the
normal flow under the hero instead of over it.

### Title page

Full-bleed backdrop to the top of the window, title art and actions bottom-left
at the sidebar inset, then episodes, sources and related rows. Harbor's Play
and source behaviour are unchanged.

### Look

A fixed dark palette on macOS (near-black canvas, white text, restrained
accent). Applied through Harbor's existing theme variables so unconverted
pages inherit it too.

## Verification

Every step is checked against a screenshot of the running app with the
owner's restored data: Home at rest, Home scrolled, a row scrolled sideways,
sidebar hidden, a title page, search open, and one unconverted page.
Automated tests cover the pure mapping and layout logic as before.

## Left to the builder

Exact spacing, type sizes, fade strengths, section heading style, how the
profile row is drawn, and the order in which Home's sub-components are touched.

## Known follow-ups

- Convert the remaining pages (Discover, Movies, Shows, Library, …) to the
  layout contract.
- Task 7 of the first plan (side-by-side run with installed Harbor) and a
  whole-branch code review.
