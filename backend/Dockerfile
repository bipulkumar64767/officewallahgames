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
COPY server ./server

RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=builder /workspace/server/target/*-exec.jar /app/server.jar

ENV PORT=8080
EXPOSE ${PORT}

ENTRYPOINT ["java", "-Xms128m", "-Xmx384m", "-XX:+UseSerialGC", "-jar", "/app/server.jar"]
