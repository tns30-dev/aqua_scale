# syntax=docker/dockerfile:1
# Build from REPO ROOT: docker build -f identity-access-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
# copy the full reactor (root pom declares every module); .dockerignore trims junk
COPY . .
RUN --mount=type=cache,target=/root/.m2 mvn -q -pl identity-access-service -am package -DskipTests

# Runtime stage — minimal JRE, non-root
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S aquashield && adduser -S -G aquashield -u 1000 aquashield
USER aquashield
WORKDIR /app
COPY --from=build /workspace/identity-access-service/target/identity-access-service-*.jar app.jar
EXPOSE 8081 9091
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
ENTRYPOINT ["java", "-jar", "app.jar"]
