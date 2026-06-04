# Build from REPO ROOT: docker build -f project-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
# copy the full reactor (root pom declares every module); .dockerignore trims junk
COPY . .
RUN mvn -q -pl project-service -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S aquashield && adduser -S -G aquashield -u 1000 aquashield
USER aquashield
WORKDIR /app
COPY --from=build /workspace/project-service/target/project-service-*.jar app.jar
EXPOSE 8082 9092
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
ENTRYPOINT ["java", "-jar", "app.jar"]
