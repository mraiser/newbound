DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/src
mkdir ../bin
javac -d ../bin/ Startup.java
java -cp ../bin Startup

