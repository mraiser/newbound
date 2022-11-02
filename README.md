# Newbound

Newbound is an Integrated Development Environment (IDE) for building APIs, apps, and services in Rust, Java, JavaScript, 
Python and/or Flow. The software includes a local web service and a set of default apps that provide the core 
functionality, including P2P communication, security, encryption, data storage, app publishing and much more. Makers and 
developers can easily incorporate the Newbound software into their own apps and "smart-things" to extend their 
project's functionality with our easy to use 
[API](https://www.newbound.io/documentation/reference.html).

NOTE: <i>Newbound was recently ported from Java to Rust, and the vast majority of support materials do not yet reflect 
the transition.</i> Join our [Discord Server](https://discord.gg/dTdXFYp9mD) for the latest news and support from the 
community!

[Documentation](https://www.newbound.io/documentation/index.html)

[Website](https://www.newbound.io)

[Newbound, Inc.](https://www.newbound.com/site/index.html)

### Overview Video
[![Watch the video](https://img.youtube.com/vi/j7S5__ObWis/maxresdefault.jpg)](https://www.youtube.com/watch?v=j7S5__ObWis)
https://www.youtube.com/watch?v=j7S5__ObWis

### Installation

Building Newbound requires [Rust](https://www.rust-lang.org/tools/install). 
To compile and execute from the Desktop, just clone or download this repository and run:

    cargo run

By default, Newbound's support for JSON is limited. For full JSON support, enable the "serde_support" feature 
(*recommended*):

    cargo run --features=serde_support

If you are writing commands in Rust, your changes will take effect when Newbound is restarted by default. To enable 
hot-swap of Rust commands, enable the "reload" feature:

    cargo run --features=reload

If you are deploying an app (rather than developing one), you probably want to target release instead of debug 
(*MUCH faster*):

    cargo run --release

# Support for commands in multiple languages
Newbound back-end commands can be written in Java, Python, Rust, Javascript, or Flow. All 
languages maintain state between calls. If your flow code calls commands written in Java, Javascript, or Python they 
will fail unless you compile with the appropriate feature flag enabled. For example, with JavaScript:

    cargo build --features=javascript_runtime
