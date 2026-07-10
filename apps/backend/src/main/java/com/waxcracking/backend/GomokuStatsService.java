package com.waxcracking.backend;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class GomokuStatsService {

	private final Map<String, MutableStats> stats = new ConcurrentHashMap<>();

	public PlayerProfile profile(String playerId, String nickname) {
		String safeId = sanitizeId(playerId);
		String safeNickname = sanitizeNickname(nickname);
		stats.compute(safeId, (id, current) -> {
			MutableStats next = current == null ? new MutableStats(id, safeNickname) : current;
			next.nickname = safeNickname;
			return next;
		});
		return new PlayerProfile(safeId, safeNickname);
	}

	public void recordGame(PlayerProfile winner, PlayerProfile loser) {
		if (winner == null || loser == null || winner.playerId().equals(loser.playerId())) {
			return;
		}

		stats.compute(winner.playerId(), (id, current) -> {
			MutableStats next = current == null ? new MutableStats(id, winner.nickname()) : current;
			next.nickname = winner.nickname();
			next.games++;
			next.wins++;
			return next;
		});

		stats.compute(loser.playerId(), (id, current) -> {
			MutableStats next = current == null ? new MutableStats(id, loser.nickname()) : current;
			next.nickname = loser.nickname();
			next.games++;
			next.losses++;
			return next;
		});
	}

	public List<PlayerStats> leaderboard() {
		return stats.values().stream()
				.filter(stat -> stat.games > 0)
				.sorted(Comparator
						.comparingInt(MutableStats::wins).reversed()
						.thenComparing(Comparator.comparingDouble(MutableStats::winRate).reversed())
						.thenComparing(Comparator.comparingInt(MutableStats::games).reversed())
						.thenComparing(stat -> stat.nickname))
				.limit(30)
				.map(MutableStats::toPlayerStats)
				.toList();
	}

	private String sanitizeId(String value) {
		String safe = value == null ? "" : value.replaceAll("[^A-Za-z0-9_-]", "");
		if (safe.isBlank()) {
			return "guest-" + System.nanoTime();
		}
		return safe.substring(0, Math.min(64, safe.length()));
	}

	private String sanitizeNickname(String value) {
		String safe = value == null ? "" : value.strip().replaceAll("\\s+", " ");
		if (safe.isBlank()) {
			return "이름 없는 고수";
		}
		return safe.substring(0, Math.min(16, safe.length()));
	}

	public record PlayerProfile(String playerId, String nickname) {
	}

	public record PlayerStats(String playerId, String nickname, int games, int wins, int losses, int winRate) {
	}

	private static final class MutableStats {
		private final String playerId;
		private String nickname;
		private int games;
		private int wins;
		private int losses;

		private MutableStats(String playerId, String nickname) {
			this.playerId = playerId;
			this.nickname = nickname;
		}

		private int wins() {
			return wins;
		}

		private int games() {
			return games;
		}

		private double winRate() {
			return games == 0 ? 0 : (double) wins / games;
		}

		private PlayerStats toPlayerStats() {
			int rate = games == 0 ? 0 : (int) Math.round((wins * 100.0) / games);
			return new PlayerStats(playerId, nickname, games, wins, losses, rate);
		}
	}
}
