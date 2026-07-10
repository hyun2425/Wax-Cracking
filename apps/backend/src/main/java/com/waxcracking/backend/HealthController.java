package com.waxcracking.backend;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

	private final GomokuStatsService statsService;

	public HealthController(GomokuStatsService statsService) {
		this.statsService = statsService;
	}

	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of(
				"status", "ok",
				"service", "wax-cracking-backend",
				"database", statsService.isDatabaseEnabled() ? "postgres" : "memory",
				"gomoku", "websocket-enabled",
				"timestamp", Instant.now().toString());
	}
}
