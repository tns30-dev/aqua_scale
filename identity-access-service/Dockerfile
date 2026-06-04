# Build stage — run from REPO ROOT: docker build -f identity-access-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY identity-access-service/pom.xml identity-access-service/
RUN mvn -q -pl identity-access-service -am dependency:go-offline
COPY identity-access-service/src identity-access-service/src
RUN mvn -q -pl identity-access-service -am package -DskipTests

# Runtime stage — minimal JRE, non-root
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S aquashield && adduser -S -G aquashield -u 1000 aquashield
USER aquashield
WORKDIR /app
COPY --from=build /workspace/identity-access-service/target/identity-access-service-*.jar app.jar
EXPOSE 8081
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
ENTRYPOINT ["java", "-jar", "app.jar"]
