package com.cyclovision.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Configuration for the single boundary to the Python AI service
 * (contract section 16: one base URL, one client, one timeout policy).
 *
 * @param url               base URL of the AI service
 * @param connectTimeout    how long to wait for the connection itself
 * @param readTimeout       numerical analyses; CPU inference on a laptop is
 *                          tens of milliseconds, so this is generous
 * @param satelliteTimeout  satellite analysis, which also fetches the image
 *                          over the network before running the model
 * @param healthTimeout     health polling must fail fast, since it runs on
 *                          request paths that need to degrade quickly
 */
@ConfigurationProperties(prefix = "ai.service")
public record AiServiceProperties(
        String url,
        Duration connectTimeout,
        Duration readTimeout,
        Duration satelliteTimeout,
        Duration healthTimeout
) {

    public AiServiceProperties {
        if (url == null || url.isBlank()) {
            url = "http://localhost:8000";
        }
        if (connectTimeout == null) {
            connectTimeout = Duration.ofSeconds(3);
        }
        if (readTimeout == null) {
            readTimeout = Duration.ofSeconds(30);
        }
        if (satelliteTimeout == null) {
            satelliteTimeout = Duration.ofSeconds(60);
        }
        if (healthTimeout == null) {
            healthTimeout = Duration.ofSeconds(3);
        }
    }
}
