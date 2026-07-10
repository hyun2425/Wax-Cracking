package com.waxcracking.backend;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class GomokuStatsService {

	private final Map<String, MutableStats> stats = new ConcurrentHashMap<>();
	private final String jdbcUrl;
	private final Properties databaseProperties;
	private final boolean databaseEnabled;

	public GomokuStatsService() {
		String databaseUrl = System.getenv("DATABASE_URL");
		DatabaseConfig databaseConfig = DatabaseConfig.from(databaseUrl);
		this.jdbcUrl = databaseConfig.jdbcUrl();
		this.databaseProperties = databaseConfig.properties();
		this.databaseEnabled = jdbcUrl != null && initializeDatabase();
	}

	public boolean isDatabaseEnabled() {
		return databaseEnabled;
	}

	public PlayerProfile profile(String playerId, String nickname) {
		String safeId = sanitizeId(playerId);
		String safeNickname = sanitizeNickname(nickname);

		if (databaseEnabled) {
			upsertProfile(safeId, safeNickname);
			return new PlayerProfile(safeId, safeNickname);
		}

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

		if (databaseEnabled) {
			recordGameInDatabase(winner, loser);
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
		if (databaseEnabled) {
			return leaderboardFromDatabase();
		}

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

	private boolean initializeDatabase() {
		try (Connection connection = DriverManager.getConnection(jdbcUrl, databaseProperties);
				Statement statement = connection.createStatement()) {
			statement.execute("""
					create table if not exists gomoku_players (
						player_id varchar(64) primary key,
						nickname varchar(16) not null,
						games integer not null default 0,
						wins integer not null default 0,
						losses integer not null default 0,
						updated_at timestamp not null default now()
					)
					""");
			return true;
		} catch (SQLException exception) {
			return false;
		}
	}

	private void upsertProfile(String playerId, String nickname) {
		String sql = """
				insert into gomoku_players (player_id, nickname)
				values (?, ?)
				on conflict (player_id) do update
				set nickname = excluded.nickname,
					updated_at = now()
				""";

		try (Connection connection = DriverManager.getConnection(jdbcUrl, databaseProperties);
				PreparedStatement statement = connection.prepareStatement(sql)) {
			statement.setString(1, playerId);
			statement.setString(2, nickname);
			statement.executeUpdate();
		} catch (SQLException exception) {
			stats.computeIfAbsent(playerId, id -> new MutableStats(id, nickname));
		}
	}

	private void recordGameInDatabase(PlayerProfile winner, PlayerProfile loser) {
		String sql = """
				insert into gomoku_players (player_id, nickname, games, wins, losses)
				values (?, ?, ?, ?, ?)
				on conflict (player_id) do update
				set nickname = excluded.nickname,
					games = gomoku_players.games + excluded.games,
					wins = gomoku_players.wins + excluded.wins,
					losses = gomoku_players.losses + excluded.losses,
					updated_at = now()
				""";

		try (Connection connection = DriverManager.getConnection(jdbcUrl, databaseProperties)) {
			connection.setAutoCommit(false);
			try (
					PreparedStatement winnerStatement = connection.prepareStatement(sql);
					PreparedStatement loserStatement = connection.prepareStatement(sql)
			) {
				fillRecordStatement(winnerStatement, winner, 1, 1, 0);
				fillRecordStatement(loserStatement, loser, 1, 0, 1);
				winnerStatement.executeUpdate();
				loserStatement.executeUpdate();
				connection.commit();
			} catch (SQLException exception) {
				connection.rollback();
				throw exception;
			}
		} catch (SQLException exception) {
			recordGameInMemory(winner, loser);
		}
	}

	private void fillRecordStatement(
			PreparedStatement statement,
			PlayerProfile profile,
			int games,
			int wins,
			int losses
	) throws SQLException {
		statement.setString(1, profile.playerId());
		statement.setString(2, profile.nickname());
		statement.setInt(3, games);
		statement.setInt(4, wins);
		statement.setInt(5, losses);
	}

	private List<PlayerStats> leaderboardFromDatabase() {
		String sql = """
				select player_id, nickname, games, wins, losses,
					case when games = 0 then 0 else round((wins * 100.0) / games)::integer end as win_rate
				from gomoku_players
				where games > 0
				order by wins desc, (wins::float / nullif(games, 0)) desc, games desc, nickname asc
				limit 30
				""";

		List<PlayerStats> leaders = new ArrayList<>();
		try (Connection connection = DriverManager.getConnection(jdbcUrl, databaseProperties);
				PreparedStatement statement = connection.prepareStatement(sql);
				ResultSet resultSet = statement.executeQuery()) {
			while (resultSet.next()) {
				leaders.add(new PlayerStats(
						resultSet.getString("player_id"),
						resultSet.getString("nickname"),
						resultSet.getInt("games"),
						resultSet.getInt("wins"),
						resultSet.getInt("losses"),
						resultSet.getInt("win_rate")));
			}
		} catch (SQLException exception) {
			return List.of();
		}
		return leaders;
	}

	private void recordGameInMemory(PlayerProfile winner, PlayerProfile loser) {
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

	private record DatabaseConfig(String jdbcUrl, Properties properties) {
		private static DatabaseConfig from(String databaseUrl) {
			if (databaseUrl == null || databaseUrl.isBlank()) {
				return new DatabaseConfig(null, new Properties());
			}

			try {
				URI uri = URI.create(databaseUrl);
				String userInfo = uri.getUserInfo();
				String user = "";
				String password = "";
				if (userInfo != null) {
					String[] parts = userInfo.split(":", 2);
					user = decode(parts[0]);
					password = parts.length > 1 ? decode(parts[1]) : "";
				}

				String query = uri.getRawQuery();
				String jdbc = "jdbc:postgresql://" + uri.getHost() +
						(uri.getPort() > 0 ? ":" + uri.getPort() : "") +
						uri.getPath() +
						(query == null || query.isBlank() ? "" : "?" + query);

				Properties properties = new Properties();
				properties.setProperty("user", user);
				properties.setProperty("password", password);
				return new DatabaseConfig(jdbc, properties);
			} catch (IllegalArgumentException exception) {
				return new DatabaseConfig(null, new Properties());
			}
		}

		private static String decode(String value) {
			return URLDecoder.decode(value, StandardCharsets.UTF_8);
		}
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
