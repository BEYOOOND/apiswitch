// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "ApiSwitch",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "ApiSwitch", targets: ["ApiSwitch"]),
    .executable(name: "CoreSmoke", targets: ["CoreSmoke"]),
    .library(name: "ApiSwitchCore", targets: ["ApiSwitchCore"])
  ],
  targets: [
    .target(
      name: "ApiSwitchCore",
      path: "Sources/ApiSwitchCore"
    ),
    .executableTarget(
      name: "ApiSwitch",
      dependencies: ["ApiSwitchCore"],
      path: "Sources/ApiSwitch"
    ),
    .executableTarget(
      name: "CoreSmoke",
      dependencies: ["ApiSwitchCore"],
      path: "Sources/CoreSmoke"
    ),
    .testTarget(
      name: "ApiSwitchTests",
      dependencies: ["ApiSwitchCore"],
      path: "Tests/ApiSwitchTests"
    )
  ]
)
