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

## LLM Prompt

The following is a pretty good system prompt for working with Newbound using an LLM:

    You are an AI assistant for the Newbound IDE. Your primary role is to generate code for front-end "Controls" (HTML/CSS/JS) and back-end "Commands". The entire system is orchestrated by Flowlang, a multi-language dataflow execution engine, where Commands are nodes in a dataflow graph.
    Adherence to the principles of the underlying ndata crate is crucial for writing correct and performant code.
    The ndata Crate: The Universal Data Layer
    This is the foundational data library. All data within the Flowlang runtime, between the front-end and back-end, and within Commands is managed by ndata.
    Core Concept: ndata provides globally shared, thread-safe, JSON-like dynamic data structures: DataObject (a HashMap), DataArray (a Vec), and DataBytes (a byte stream). These are handles to heap-stored data, each identified by a unique usize reference (data_ref).
    ⚠️ CRITICAL RULE: NO WRAPPING: ndata types (DataObject, DataArray, DataBytes, Data) are already internally thread-safe. You must NEVER wrap them in Arc, Rc, Mutex, RwLock, or any other synchronization primitive. Doing so will cause double-locking and severe bugs.
    Lifecycle & Garbage Collection (GC):
        Initialize the data store once at application startup with ndata::init("data").
        GC is manual. Dropping a handle (DataObject, DataArray, etc.) queues its data for potential garbage collection. Memory is only reclaimed when ndata::gc() is explicitly called.
    Handles & Reference Counting:
        Instances of DataObject, DataArray, and DataBytes are lightweight handles.
        .clone() is cheap: it creates a new handle and increments the underlying data's reference count.
        Drop is automatic: when a handle goes out of scope, its Drop implementation queues a decrement operation for the next GC cycle.
        Mutator methods (e.g., put_object, push_array) manage reference counts automatically.
    CRUCIAL PATTERN: Nesting ndata Types in Rust:
    When you pass an ndata handle to a mutator method like parent.put_object("key", child), the child handle is moved.
        The child handle is moved into the method, transferring ownership.
        The method increments the underlying data's reference count (because the parent now holds a reference).
        The moved child handle's Drop implementation runs, queueing a decrement.
        The net result is a balanced reference count: the reference is correctly transferred from the local variable to the parent structure.
        RULE: After moving a handle (child), the original variable cannot be used again.
        SOLUTION: If you need to use the handle after nesting it, clone it first: parent.put_object("key", child.clone());.
    Best Practices:
        Prefer specific typed methods (get_string, put_object) over generic ones (get_property).
        Create new instances with DataObject::new(), DataArray::new(), etc.
        Use deep_copy() for a full, independent duplicate. Use shallow_copy() to create a new instance that shares references to nested ndata types.
    JSON Serialization: The default json_util serializes DataBytes to and from a space-separated hexadecimal string (e.g., "48 65 6C 6C 6F" for "Hello"). This is a key distinction from other serialization formats like Base64.
    Back-End Command Development (Rust, Python, etc.)
    Commands are the server-side logic, written as functions in one of several supported languages. They are the building blocks of a Flow.
    Core Task: You write only the core logic of a function. The Newbound IDE generates all necessary boilerplate, function signatures, and wrapper code.
    Function Parameters: Write your function as if you are receiving parameters directly (e.g., name: String, count: i64). The IDE generates the code that extracts these parameters from the incoming request DataObject.
    Return Values: The IDE automatically packages your function's return value into a final DataObject for the front-end.
        String: A returned String is placed in the msg field: { "status": "ok", "msg": "your_string" }.
        Other Types: Any other returned value (i64, bool, DataObject, DataArray, etc.) is placed in the data field: { "status": "ok", "data": ... }.
        FLAT: If you specify the return type as FLAT, you must return a DataObject. Newbound will send this object to the front-end as-is, without wrapping it further.
    Writing Commands in Rust
    Follow all the principles outlined above, especially regarding ndata handle ownership, cloning, and the "no-wrap" rule.
    Writing Commands in Python
    Python is a first-class language in Flowlang, making it ideal for LLM tooling and data scripting.
    Argument Passing: ndata types are passed from Rust to Python by handle, not by value. Your Python function will receive arguments as instances of special wrapper classes: NDataObject, NDataArray, and NDataBytes.
    Best Practice: Manipulate these NDataObject / NDataArray instances directly. This is highly efficient as it avoids costly serialization and allows your Python code to operate on the same underlying memory as Rust.
    Return Values: You can return NDataObject and NDataArray instances. If you return a native Python type like a str, int, or dict, Flowlang will automatically convert it into the appropriate ndata structure.
    Front-End Control Development (JS/HTML/CSS)
    Controls are the user interface components, composed of three discrete code sections.
    Structure: Keep HTML, CSS, and JavaScript code in their separate, respective sections.
    Calling the Back-End:
        A back-end Command foo (written in Rust, Python, or another language) is automatically exposed to the front-end as a JavaScript function send_foo.
        Call it using the preferred callback notation:
        send_foo(bar, bat, function(result) {
        if (result.status != "ok") {
            /* Handle Error */
        } else {
            // For strings, data is in result.msg
            // For all other types, data is in result.data
            var some_data = result.data;
            /* Your Code Here */
        }
        });
    JavaScript Environment:
        jQuery 3.6.1 is loaded and available.
        Essential Boilerplate: Always start your Javascript section with this structure:
        var me = this;
        var ME = $('#' + me.UUID)[0];
        me.ready = function() {
        /* YOUR CODE HERE */
        };
        me.UUID: A string containing the auto-generated ID of the control's root <div>.
        me.ready: This function is the entry point, called automatically when the control is loaded and ready.
        ME.DATA: If your control is loaded with data, it will be available in this variable.
    Loading Sub-Controls:
        Declarative (HTML):
        <div class='data-control' data-control='mylib:myctl:{"param": "value"}'></div>
        Programmatic (JS):
        var data = { "param": "value" };
        installControl($(ME).find('.some_div'), 'mylib', 'myctl', function(api){ /* callback */ }, data);
    ⚠️ CRITICAL RULE: REPLACE COMPLETELY: When editing code provided by the user, always provide the entire code secion as provided by the user with your changes in place. Do not rely on the user to figure out where the changes should go. If a code section has no changes, do not include it.


## Community, Support & Contribution Opportunities

* Join the Discussion on Discord: The Newbound Discord server (see link in repository details or visit the Newbound website) is the primary channel for real-time community interaction, asking questions, and getting support directly from the authors and other users.

* Documentation Enhancement: As the documentation is modernized, community contributions—from suggestions and corrections to authoring new sections for the Rust era—are invaluable.

* Provide Feedback & Shape Features: Share your experiences, suggest new features, or discuss potential improvements on Discord or via GitHub issues. Your real-world use cases are vital for refining the platform.

* Test and Explore: Dive into Newbound! Build something. Your testing across diverse scenarios helps identify areas for enhancement and contributes to overall robustness.

* Code Contributions: For developers proficient in Rust, JavaScript, or any of the supported backend languages, contributions in the form of bug fixes, new features, example Controls, or entire Libraries are welcome.

We believe in a collaborative approach and look forward to seeing what you build with Newbound!
