# VAIYU backend: Spring Boot, the only tier the browser talks to.
#
# Two stages so the runtime image carries a JRE and one jar rather than Maven,
# the JDK and a populated ~/.m2 — roughly 700 MB saved.

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src

# The pom alone first: dependency resolution then re-uses Docker's cache on
# every build that changes only source, which is almost all of them.
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Tests need a PostgreSQL and an AI service; they run in CI and locally, not
# during an image build that has neither.
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app

# curl is not in the JRE image, and the health check below is worthless
# without it: a HEALTHCHECK whose command is missing reports unhealthy
# forever, which is worse than having none.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

# A non-root user: the service reads a mounted CSV and writes uploaded frames,
# and needs no more than that.
RUN useradd --system --create-home --shell /usr/sbin/nologin vaiyu
COPY --from=build /src/target/*.jar /app/vaiyu-backend.jar

# Where uploaded satellite frames land. Declared so the data survives the
# container and so the directory is owned by the user that writes to it.
RUN mkdir -p /app/data/satellite-uploads && chown -R vaiyu:vaiyu /app
VOLUME ["/app/data/satellite-uploads"]

USER vaiyu
EXPOSE 8081

# Container memory is the limit the JVM should respect, not the host's.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
ENV SERVER_PORT=8081

# Actuator is already exposed for health and info only.
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=5 \
    CMD ["sh", "-c", "curl -fsS http://localhost:8081/actuator/health || exit 1"]

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/vaiyu-backend.jar"]
