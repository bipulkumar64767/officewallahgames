#!/bin/sh
set -e

echo "Starting OfficeWallahGames Microservices..."

export JAVA_OPTS="-Xms16m -Xmx40m -XX:MaxMetaspaceSize=40m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Djava.security.egd=file:/dev/./urandom"

# Start all 6 Spring Boot microservices in the background with staggered starts
java $JAVA_OPTS -Dserver.port=8081 -Dserver.address=0.0.0.0 -jar /app/games-master-service.jar &
sleep 2
java $JAVA_OPTS -Dserver.port=8082 -Dserver.address=0.0.0.0 -jar /app/user-management-service.jar &
sleep 2
java $JAVA_OPTS -Dserver.port=8083 -Dserver.address=0.0.0.0 -jar /app/tic-tac-toe-service.jar &
sleep 2
java $JAVA_OPTS -Dserver.port=8084 -Dserver.address=0.0.0.0 -jar /app/ludo-service.jar &
sleep 2
java $JAVA_OPTS -Dserver.port=8085 -Dserver.address=0.0.0.0 -jar /app/word-grid-service.jar &
sleep 2
java $JAVA_OPTS -Dserver.port=8086 -Dserver.address=0.0.0.0 -jar /app/connect-drop-service.jar &
sleep 2

echo "All microservices launched. Starting Caddy reverse proxy on port ${PORT:-8080}..."
exec caddy run --config /app/Caddyfile --adapter caddyfile
