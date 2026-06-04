# Build from REPO ROOT: docker build -f realtime-gateway/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY common/pom.xml common/
COPY shared-api/pom.xml shared-api/
COPY realtime-gateway/pom.xml realtime-gateway/
COPY common/src common/src
COPY shared-api/src shared-api/src
COPY realtime-gateway/src realtime-gateway/src
RUN mvn -q -pl realtime-gateway -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S aquashield && adduser -S -G aquashield -u 1000 aquashield
USER aquashield
WORKDIR /app
COPY --from=build /workspace/realtime-gateway/target/realtime-gateway-*.jar app.jar
EXPOSE 8088
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
ENTRYPOINT ["java", "-jar", "app.jar"]
