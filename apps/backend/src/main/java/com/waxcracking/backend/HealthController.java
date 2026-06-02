package com.waxcracking.backend;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of(
				"status", "ok",
				"service", "wax-cracking-backend",
				"database", "disabled",
				"timestamp", Instant.now().toString());
	}
}
