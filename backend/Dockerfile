# Build stage
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace

COPY pom.xml .
COPY common ./common
COPY games-master-service ./games-master-service
COPY user-management-service ./user-management-service
COPY tic-tac-toe-service ./tic-tac-toe-service
COPY ludo-service ./ludo-service
COPY word-grid-service ./word-grid-service
COPY connect-drop-service ./connect-drop-service

RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install Caddy
RUN apk add --no-cache caddy

COPY --from=builder /workspace/games-master-service/target/*.jar /app/games-master-service.jar
COPY --from=builder /workspace/user-management-service/target/*.jar /app/user-management-service.jar
COPY --from=builder /workspace/tic-tac-toe-service/target/*.jar /app/tic-tac-toe-service.jar
COPY --from=builder /workspace/ludo-service/target/*.jar /app/ludo-service.jar
COPY --from=builder /workspace/word-grid-service/target/*.jar /app/word-grid-service.jar
COPY --from=builder /workspace/connect-drop-service/target/*.jar /app/connect-drop-service.jar

COPY Caddyfile /app/Caddyfile
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV PORT=8080
EXPOSE ${PORT}

ENTRYPOINT ["/app/entrypoint.sh"]
