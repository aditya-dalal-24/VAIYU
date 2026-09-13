package com.vaiyu.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * Which browser origins may call this API.
 *
 * <p>The previous configuration allowed every origin <em>and</em> credentials,
 * which browsers only permit because Spring reflects the caller's origin back
 * rather than sending a literal wildcard — so any website a user visited could
 * make credentialed requests here. There are no cookies or sessions today, but
 * that combination is a standing trap for the first feature that adds one.
 *
 * <p>Now the allowed origins are an explicit list from
 * {@code vaiyu.cors.allowed-origins}, credentials are off because nothing in
 * this API uses them, and only the methods the API actually has are allowed.
 */
@Configuration
public class CorsConfig {

    private final String[] allowedOrigins;

    public CorsConfig(
            @Value("${vaiyu.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
            String allowedOrigins) {
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(allowedOrigins)
                        .allowedMethods("GET", "POST", "OPTIONS")
                        .allowedHeaders("Content-Type", "Accept")
                        .allowCredentials(false)
                        .maxAge(3600);
            }
        };
    }
}
