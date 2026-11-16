import XCTest

@testable import HarborNative

final class PayloadsTests: XCTestCase {
    func testSidebarPayloadDecodes() throws {
        let json =
            #"{"visible":true,"collapsed":false,"items":[{"id":"home","title":"Home","symbol":"house","section":"primary","active":true,"gated":false}]}"#
        let payload = try JSONDecoder().decode(SidebarPayload.self, from: Data(json.utf8))
        XCTAssertEqual(payload.items.count, 1)
        XCTAssertEqual(payload.items[0].id, "home")
        XCTAssertNil(payload.items[0].badge)
        XCTAssertTrue(payload.items[0].active)
    }

    func testUnknownSymbolFallsBack() {
        XCTAssertEqual(SidebarItem.resolvedSymbol(for: "not.a.real.symbol"), "circle")
        XCTAssertEqual(SidebarItem.resolvedSymbol(for: "house"), "house")
    }

    func testSearchPayloadTextIsOptional() throws {
        let focusOnly = try JSONDecoder().decode(
            SearchPayload.self, from: Data(#"{"focused":true}"#.utf8))
        XCTAssertNil(focusOnly.text)
        XCTAssertEqual(focusOnly.focused, true)
        let textOnly = try JSONDecoder().decode(
            SearchPayload.self, from: Data(#"{"text":"dune"}"#.utf8))
        XCTAssertNil(textOnly.focused)
        let cleared = try JSONDecoder().decode(
            SearchPayload.self, from: Data(#"{"text":"","focused":false}"#.utf8))
        XCTAssertEqual(cleared.text, "")
    }
}
