# Newbound

The Newbound software is an HTML5 app framework for connecting devices 
like computers, smartphones, tablets and devices on the Internet of 
Things (IoT) directly and securely with one another. The software 
includes a local web service and a set of default apps that provide the 
core functionality, including P2P communication, security, encryption, 
data storage, file transfer, port-forwarding, app publishing and much 
more. Makers and developers can easily incorporate the Newbound software 
into their own apps and "smart-things" to extend their creation's 
functionality with our easy to use 
[API](https://www.newbound.io/documentation/reference.html).

[Documentation](https://www.newbound.io/documentation/index.html)

[Website](https://www.newbound.io)

[Newbound, Inc.](https://www.newbound.com/site/index.html)

### Overview Video
[![Watch the video](https://img.youtube.com/vi/j7S5__ObWis/maxresdefault.jpg)](https://www.youtube.com/watch?v=j7S5__ObWis)
https://www.youtube.com/watch?v=j7S5__ObWis

### Installation

*The Newbound source code requires JDK 1.8 or later.*

To compile and execute from the Desktop, just clone or download this repository and double-click the appropriate launcher for your Operating System.

**NOTE:** *Make sure there are no spaces in the full path (all parent folders) of your installation directory.*

Mac:<br>
The first time you run it you will need to right-click on it to launch.
```
Newbound.command
```

Windows:<br>
The first time you run it you will need to confirm that you actually 
want to run it.
```
Newbound.bat
```
Linux:<br>
```
./newbound.sh
```
Any Platform:<br>
To launch from the command line, navigate to the folder you extracted the Newbound software to and type:
```
mkdir bin
cd src
javac -d ../bin Startup.java
cd ../
java -cp bin Startup
```

## Flow Support
Newbound supports the use of the Flow language for back-end commands. While the Flow 
language interpreter is fairly solid, the editor is still experimental and buggy. Save 
often and then refresh the page. Support for the Flow language on the front-end is very 
limited at this point (no primitives or persistents) and for now only available through 
the 3D UI editor at this time.

**Not documented anywhere else:**
- To create a new operation in blank space, hold shift down while clicking. 
- To add a node to an input or output bar, hold shift down when clicking.
- To connect an input node to an output node, hold shift down while clicking on one node and drag to the other.
- To delete a node or operation select it and press delete.
- Object types are largely ignored except when defining the method signature for a command.
- Node names must match parameter names or your code will fail cryptically.

## Rust Support
**NOTE:** Rust support in Newbound depends on  files that are generated the first time you 
run Newbound, so compiling a fresh install will fail. **Run Newbound at least once before 
trying to compile the Rust binaries.**

    ./newbound.sh

### Option 1:
To enable support for the Rust language you will need to compile the Newbound rust binaries
from inside the directory where you installed Newbound. Since Newbound automatically rebuilds the rust binaries 
when you save a Rust command in the MetaBot Command Editor, you should only need to manually compile the Newbound 
binaries once.

    cargo build --release

### Option 2:
Alternatively, you can build the Flow repo (https://github.com/mraiser/flow) and
add the library (libflowlang.so on Linux) to your Java library path. This will enable 
the rust environment to maintain state between calls, at the expense of having to restart 
Newbound any time you change Rust code. You will need to add the following line to the file 
runtime/botmanager/botd.properties:

    libflow=true

**NOTE:** Enabling libflow will execute all *flow code* using the native library as well. That means if your 
flow code calls commands written in Java, they will be executed *in a separate JVM*.