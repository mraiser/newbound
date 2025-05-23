# Newbound 
***Minimal Footprint, Maximal Flexibility Development Platform***

Welcome to the official GitHub repository for Newbound!

[API](https://www.newbound.io/documentation/reference.html) | [DISCORD](https://discord.gg/p2YvGGm2RR) | [DOC](https://www.newbound.io/documentation/index.html) | [WEB](https://www.newbound.io) | [CORP](https://www.newbound.com/site/index.html)

### Installation

Building Newbound requires [Rust](https://www.rust-lang.org/tools/install). 
To compile and execute from the Desktop, just clone or download this repository and run:

```
cargo run
```

By default, Newbound's support for JSON is limited. For full JSON support, enable the "serde_support" feature 
(*recommended*):

```
cargo run --features=serde_support
```

If you are writing commands in Rust, your changes will take effect when Newbound is restarted by default. To enable 
hot-swap of Rust commands, enable the "reload" feature:

```
cargo run --features=reload
```

If you are deploying an app (rather than developing one), you probably want to target release instead of debug 
(*MUCH faster*):
```
cargo run --release
```

## What is Newbound?    
Newbound is an Integrated Development Environment (IDE) and a comprehensive software development platform conceived and actively developed by Newbound LLC. It is engineered from the ground up to provide a uniquely minimalistic yet exceptionally powerful and flexible ecosystem for crafting a wide array of digital solutions, including APIs, applications, and services. In a true testament to its capabilities, the entire Newbound environment is self-hosted and built using Newbound itself.

The platform's robust backend is primarily written in Rust, a transition from its original Java architecture completed by the end of 2023. This strategic evolution reflects a forward-looking perspective on the enterprise software landscape.

## Core Philosophy & Key Features

Newbound is built upon a foundational philosophy of minimal footprint and maximal flexibility. It is meticulously designed to:

* Simplify Complexity: Seamlessly manage intricate infrastructure components, allowing developers to focus on their unique logic.

* Empower Developers: Avoid imposing rigid structures, enabling users to integrate precisely as much or as little of the Newbound stack as their project demands.

* Platform Agnostic: Strive for robust functionality across diverse environments, from embedded systems to full-scale server deployments, capable of serving as a complete standalone development stack.

* Multi-Language Backend (Commands): Support for writing backend logic in Rust, Java, JavaScript, Python, and Newbound's own intuitive visual dataflow language, "Flow." All languages maintain state between calls for cohesive application behavior.

* Integrated Web Service & UI: The primary user interface is a dynamic HTML5 experience (HTML, CSS, JavaScript, leveraging jQuery and Three.JS for 3D UIs), served directly by Newbound's built-in web service.

## Core Architecture: Building with Controls

Newbound applications are constructed using a clear, modular hierarchy:

* Controls: These are the atomic, self-contained building blocks of Newbound applications, analogous to Lego bricks. Each Control encapsulates both:
    * Frontend Code: Defines the visual presentation and user interaction. This can be traditional HTML, CSS, and JavaScript (often using jQuery), or a 3D UI built with Three.JS (as seen in the new Flow language editor).

    * Backend Code (Commands): Contains the server-side logic integral to the Control. Commands are invoked by the Control's frontend JavaScript and can be written in Rust, Java, JavaScript, Python, or Flow.

* Assets: Static files like images and other resources
    
* Libraries: Controls are organized and packaged within Libraries. A Library groups related Controls to provide a specific set of functionalities.

* Applications: Multiple Libraries are assembled to form a complete Application.

Newbound's own core system is composed of four integral libraries:

* Applications (app)

* Development (dev) (formerly known as "Metabot")

* Peers (peer)

* Security (security)

## Licensing

Newbound is offered under the following terms:

* Free for Non-Commercial Use: You are welcome to use Newbound for personal projects, learning, and experimentation without charge.

* Commercial Use: If you intend to use Newbound in a commercial product, for sale, or for internal business operations at your workplace, please purchase the appropriate commercial licenses from Newbound, LLC.

* All usage is subject to the Terms and Conditions (https://www.newbound.com/site/terms.html) and the Newbound Developer Terms of Service (https://www.newbound.io/documentation/legal.html).

## Current Development Focus & Vision

Newbound is a living project with an active development roadmap. Current priorities include:

* Next-Generation Flow Editor: A completely redesigned editor for the Flow language, leveraging Newbound's 3D UI capabilities with Three.JS.

* LLM Integration: Incorporating Large Language Model technology, including a full implementation of the Model Context Protocol.

* Enhanced Publishing Options: Expanding deployment pathways for Newbound applications (e.g., browser plugins, mobile/desktop app stores, Docker images).

* Documentation Modernization: Continuously updating and expanding project documentation to reflect the latest Rust-based architecture.
    
This how software development should be done-- an unobtrusive yet powerful ally that simplifies infrastructure, promotes flexibility, and offers scalable utility for projects of any size, on any platform.

## Getting Started & Documentation

The official (though currently being updated) documentation for Newbound can be found at:

* https://www.newbound.io

*Please note that while comprehensive, the documentation is in the process of being fully updated from the original Java version to accurately reflect the current Rust-based architecture and its newest features. Your understanding and patience are appreciated as this transition completes.*

## Community, Support & Contribution Opportunities

* Join the Discussion on Discord: The Newbound Discord server (see link in repository details or visit the Newbound website) is the primary channel for real-time community interaction, asking questions, and getting support directly from the authors and other users.

* Documentation Enhancement: As the documentation is modernized, community contributions—from suggestions and corrections to authoring new sections for the Rust era—are invaluable.

* Provide Feedback & Shape Features: Share your experiences, suggest new features, or discuss potential improvements on Discord or via GitHub issues. Your real-world use cases are vital for refining the platform.

* Test and Explore: Dive into Newbound! Build something. Your testing across diverse scenarios helps identify areas for enhancement and contributes to overall robustness.

* Code Contributions: For developers proficient in Rust, JavaScript, or any of the supported backend languages, contributions in the form of bug fixes, new features, example Controls, or entire Libraries are welcome.

We believe in a collaborative approach and look forward to seeing what you build with Newbound!
