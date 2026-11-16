// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "HarborNative",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "HarborNative", type: .static, targets: ["HarborNative"])
    ],
    targets: [
        .target(name: "HarborNative"),
        .testTarget(name: "HarborNativeTests", dependencies: ["HarborNative"]),
    ]
)
