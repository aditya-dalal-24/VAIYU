package com.cyclovision;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

@SpringBootApplication
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
