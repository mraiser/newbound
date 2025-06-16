# Newbound 
***Minimal Footprint, Maximal Flexibility Development Platform***

Welcome to the official GitHub repository for Newbound!

[API](https://www.newbound.io/documentation/reference.html) | [DISCORD](https://discord.gg/p2YvGGm2RR) | [DOC](https://www.newbound.io/documentation/index.html) | [WEB](https://www.newbound.io) | [CORP](https://www.newbound.com/site/index.html)

NOTE: The reload, java_runtime, and javascript_runtime features are known to be buggy at this time.

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

## LLM Prompts

The following is a pretty good prompt preface for creating front-end control interfaces with Newbound using an LLM:

    You are writing a front-end Control in the Newbound development environment, which consists of discrete component sections (one each of) HTML, CSS, and Javascript. Back-end functions can be written in any of Rust, Javascript, Python, Java, or Flow (but we prefer Rust). When a function is added to the backend, it becomes available to the front-end by way of an auto-generated Javascript function. For example, if a back-end function named, "foo" with parameters "bar" and "bat" is written, you can call it like this:

    ``` command_example.js
    // Please note that we prefer this notation for callbacks
    send_foo(bar, bat, callbackFunction(result){
    if (result.status != "ok") { /* ERROR */ }
    else {
        var some_data = result.data; // Unless the result data is a String, in which case some_data = result.msg
        /* CODE GOES HERE */
    }
    });
    ```

    Make sure to always keep the different types of code in their separate respective sections (HTML/CSS/JS/RUST).

    In Javascript, there are some things you should be aware of:
    - In the DOM, your Javascript section is attached to the HTML div that contains this Control. For example, if the control is added directly into the body, the javascript will be found at document.body.api
    - If the div this Control is added into does not have an id specified, Newbound will generate one at runtime
    - The div id will be attached to the javascript as a member attribute named UUID. You can access it at the top level of your Javascript with `this.UUID`
    - If you define a "ready" function as a member of the javascript section, it will be called on startup when your control is ready
    - JQuery 3.6.1 is loaded and available for you to use
    - It is good practice to start your Javascript section like so:

    ``` control_example.js
    var me = this;
    var ME = $('#'+me.UUID)[0];

    me.ready = function(){
    /* YOUR CODE HERE */
    };
    ```

    If your control is being called with data, the data will be available at ME.DATA (if you have defined "ME" as specified above).

    Your control can load additional controls in a number of ways:

    ``` load_control_html_example.html
    <div class='data-control' data-control='mylib:myctl:{"some_param": "some_value"}'></div>
    ```

    ``` load_control_js_example.js
    var d = { "some_param": "some_value" };
    installControl($(ME).find('.some_class')[0], 'mylib', 'myctl', function(api){}, d);
    ```

The following is a pretty good prompt preface for creating back-end control commands with Newbound using an LLM:

    Writing a Back-End Command in Newbound

    You are writing a back-end Command in the Newbound development environment. Commands are the server-side logic for a front-end Control. While they can be written in several languages, Rust and Python have first-class support, including live-sharing of DataObject instances and access to the full API.

    The Newbound IDE simplifies the process by generating the necessary wrapper code. You only need to write the core logic of your function.
    Key Concepts

        Data Types: All data is handled using ndata-supported types (e.g., DataObject, DataArray, String, i64, bool). These types are thread-safe by default; do not wrap them in Arc, Mutex, etc.

        IDE Code Generation: You will write your code in separate sections (e.g., import, function body). The IDE uses this to generate the final, runnable Command function, including the correct function signature and boilerplate.

        Function Signature: You write your function as if you were receiving the parameters directly, not inside a DataObject. The IDE's generated code handles extracting the parameters for you.

        Return Values: The generated wrapper code automatically packages your function's return value into a final DataObject for the front-end.

            Default: A returned value (e.g., an i64, bool, or another DataObject) is placed in the data field.

            String: A returned String is placed in the msg field.

            FLAT: If you specify the return type as FLAT, you must return a DataObject, and Newbound will send it to the front-end as-is, without wrapping it further.

    Writing a Rust Command

    You provide the imports and the function body in separate sections. The IDE builds the rest.

    Example: add_numbers
    Import Section

    // lib: mylib, ctl: myctl, cmd: add_numbers
    // return: i64

    // No imports needed for this simple example.
    // If you were using DataObject, you'd put:
    // use ndata::dataobject::DataObject;

    Function Body

    // The function signature is simplified. You just write the logic.
    // The input parameters 'a' and 'b' are automatically provided.
    fn add_numbers(a: i64, b: i64) -> i64 {
        // The IDE has already extracted 'a' and 'b' from the input object.
        a + b
    }

    In this example, the returned i64 will be automatically placed in the data field of the DataObject sent to the front-end.
    Writing a Python Command

    Python commands are also stateful, meaning imports and global variables persist across different command executions.

    Example: add_numbers
    Function Body

    # lib: mylib, ctl: myctl, cmd: add_numbers
    # return: int

    # The function receives parameters directly.
    def add_numbers(a, b):
    # The runtime automatically converts the return value.
    return a + b

    The Python runtime will take the returned integer, and the Flowlang engine will package it into a DataObject with the result in the data field.


## Community, Support & Contribution Opportunities

* Join the Discussion on Discord: The Newbound Discord server (see link in repository details or visit the Newbound website) is the primary channel for real-time community interaction, asking questions, and getting support directly from the authors and other users.

* Documentation Enhancement: As the documentation is modernized, community contributions—from suggestions and corrections to authoring new sections for the Rust era—are invaluable.

* Provide Feedback & Shape Features: Share your experiences, suggest new features, or discuss potential improvements on Discord or via GitHub issues. Your real-world use cases are vital for refining the platform.

* Test and Explore: Dive into Newbound! Build something. Your testing across diverse scenarios helps identify areas for enhancement and contributes to overall robustness.

* Code Contributions: For developers proficient in Rust, JavaScript, or any of the supported backend languages, contributions in the form of bug fixes, new features, example Controls, or entire Libraries are welcome.

We believe in a collaborative approach and look forward to seeing what you build with Newbound!
