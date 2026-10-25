# Builds and runs the VaxBridge server. Used by Render (see render.yaml); works on any Docker host.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY rules rules
COPY server server
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/server/target/vaxbridge-server-0.1.0.jar app.jar
# Small servers have little memory; keep Java within it.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
