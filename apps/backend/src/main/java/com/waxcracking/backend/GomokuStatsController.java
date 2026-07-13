package com.waxcracking.backend;

import java.util.List;
import java.util.Map;

import com.waxcracking.backend.GomokuStatsService.ProfileLoginException;
import com.waxcracking.backend.GomokuStatsService.PlayerProfile;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
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

	@PostMapping("/profile")
	public PlayerProfile profile(@RequestBody ProfileRequest request) {
		return statsService.registerProfile(request.playerId(), request.nickname(), request.pin());
	}

	@ExceptionHandler(ProfileLoginException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Map<String, String> profileLoginError(ProfileLoginException exception) {
		return Map.of("message", exception.getMessage());
	}

	public record ProfileRequest(String playerId, String nickname, String pin) {
	}
}
