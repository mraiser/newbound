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
Newbound Network.command
```

Windows:<br>
The first time you run it you will need to confirm that you actually 
want to run it.
```
NewboundNetwork.bat
```
Linux:<br>
The first time you run it you will first need to change the permissions on it to executable.
```
chmod a+x newboundnetwork.sh
./newboundnetwork.sh
```
Any Platform:<br>
To launch from the command line, navigate to the folder you extracted the Newbound software to and type:
```
mkdir bin
cd src
javac -d ../bin Startup.java
java -cp ../bin Startup
```