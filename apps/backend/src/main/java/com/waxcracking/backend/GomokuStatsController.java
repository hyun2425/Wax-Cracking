package com.waxcracking.backend;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gomoku")
public class GomokuStatsController {

	private final GomokuStatsService statsService;

	public GomokuStatsController(GomokuStatsService statsService) {
		this.statsService = statsService;
	}

	@GetMapping("/leaderboard")
	public List<GomokuStatsService.PlayerStats> leaderboard() {
		return statsService.leaderboard();
	}
}
