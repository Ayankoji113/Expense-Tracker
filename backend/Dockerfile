FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
# dependencies first so code changes do not re-download the world
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
# curl is only here so the container can answer a health check
RUN apt-get update && apt-get install -y --no-install-recommends curl     && rm -rf /var/lib/apt/lists/*
# never run the service as root
RUN useradd --system --uid 10001 appuser && chown -R appuser /app
USER appuser
EXPOSE 8080
# let the JVM size itself from the container's memory limit
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
