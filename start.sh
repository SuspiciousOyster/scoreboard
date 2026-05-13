#!/bin/bash
JAVA=/home/hermes/workspace/jdks/jdk-11.0.26+4/bin/java
BUILD=/home/hermes/workspace/scoreboard-build/classes
DEPS=$(find /home/hermes/workspace/scoreboard/lib/deps -name '*.jar' | tr '\n' ':')
cd /home/hermes/workspace/scoreboard
exec $JAVA -cp "$BUILD:$DEPS" com.carolinarollergirls.scoreboard.Main --nogui
