# syntax=docker/dockerfile:1
# Build from REPO ROOT: docker build -f ingestion-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
# copy the full reactor (root pom declares every module); .dockerignore trims junk
COPY . .
RUN --mount=type=cache,target=/root/.m2 mvn -q -pl ingestion-service -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S aquashield && adduser -S -G aquashield -u 1000 aquashield
USER aquashield
WORKDIR /app
COPY --from=build /workspace/ingestion-service/target/ingestion-service-*.jar app.jar
EXPOSE 8084
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
ENTRYPOINT ["java", "-jar", "app.jar"]
