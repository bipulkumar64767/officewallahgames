#!/bin/sh
set -e

echo "Starting OfficeWallahGames Microservices..."

export JAVA_OPTS="-Xms32m -Xmx64m -XX:+UseG1GC"

# Start all 6 Spring Boot microservices in the background
java $JAVA_OPTS -Dserver.port=8081 -jar /app/games-master-service.jar &
java $JAVA_OPTS -Dserver.port=8082 -jar /app/user-management-service.jar &
java $JAVA_OPTS -Dserver.port=8083 -jar /app/tic-tac-toe-service.jar &
java $JAVA_OPTS -Dserver.port=8084 -jar /app/ludo-service.jar &
java $JAVA_OPTS -Dserver.port=8085 -jar /app/word-grid-service.jar &
java $JAVA_OPTS -Dserver.port=8086 -jar /app/connect-drop-service.jar &

echo "All microservices launched. Starting Caddy reverse proxy on port ${PORT:-8080}..."
exec caddy run --config /app/Caddyfile --adapter caddyfile
