package com.vaiyu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

/**
 * Entry point.
 *
 * <p>Spring Boot does not read {@code .env} files, so local configuration --
 * the database password above all -- would otherwise have to be exported into
 * the shell before every run, and set a second time in the IDE's run
 * configuration. {@link #loadDotEnv()} reads the file into system properties
 * before the context starts, which makes {@code backend/.env} work the same
 * way from Maven, from a jar and from an IDE. Real environment variables and
 * system properties already set are never overwritten, so a deployment that
 * sets them properly is unaffected.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class BackendApplication {

	public static void main(String[] args) {
		loadDotEnv();
		SpringApplication.run(BackendApplication.class, args);
	}

	private static void loadDotEnv() {
		File[] candidateFiles = new File[]{
			new File(".env"),
			new File("backend/.env"),
			new File("../backend/.env")
		};

		for (File file : candidateFiles) {
			if (file.exists() && file.isFile()) {
				try {
					List<String> lines = Files.readAllLines(file.toPath(), StandardCharsets.UTF_8);
					for (String line : lines) {
						line = line.trim();
						if (line.isEmpty() || line.startsWith("#")) {
							continue;
						}
						int eqIndex = line.indexOf('=');
						if (eqIndex > 0) {
							String key = line.substring(0, eqIndex).trim();
							String value = line.substring(eqIndex + 1).trim();
							if ((value.startsWith("\"") && value.endsWith("\"")) ||
								(value.startsWith("'") && value.endsWith("'"))) {
								value = value.substring(1, value.length() - 1);
							}
							if (System.getProperty(key) == null && System.getenv(key) == null) {
								System.setProperty(key, value);
							}
						}
					}
					break;
				} catch (Exception ignored) {
				}
			}
		}
	}
}
