package com.waxcracking.backend;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Value("${app.cors.allowed-origin-patterns}")
	private String allowedOriginPatterns;

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		String[] patterns = Arrays.stream(allowedOriginPatterns.split(","))
				.map(String::trim)
				.filter(pattern -> !pattern.isBlank())
				.toArray(String[]::new);

		registry.addMapping("/api/**")
				.allowedOriginPatterns(patterns)
				.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
				.allowedHeaders("*");
	}
}
