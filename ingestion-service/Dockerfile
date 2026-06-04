# Build from REPO ROOT: docker build -f ingestion-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY common/pom.xml common/
COPY shared-api/pom.xml shared-api/
COPY ingestion-service/pom.xml ingestion-service/
COPY common/src common/src
COPY shared-api/src shared-api/src
COPY ingestion-service/src ingestion-service/src
RUN mvn -q -pl ingestion-service -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S aquashield && adduser -S -G aquashield -u 1000 aquashield
USER aquashield
WORKDIR /app
COPY --from=build /workspace/ingestion-service/target/ingestion-service-*.jar app.jar
EXPOSE 8084
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
ENTRYPOINT ["java", "-jar", "app.jar"]
