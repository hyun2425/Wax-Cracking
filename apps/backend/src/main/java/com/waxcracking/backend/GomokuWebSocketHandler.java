package com.waxcracking.backend;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class GomokuWebSocketHandler extends TextWebSocketHandler {

	private static final int BOARD_SIZE = 15;
	private static final TypeReference<Map<String, Object>> MESSAGE_TYPE = new TypeReference<>() {
	};

	private final ObjectMapper objectMapper = new ObjectMapper();
	private final Map<String, Room> rooms = new ConcurrentHashMap<>();
	private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();

	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws IOException {
		String roomCode = getRoomCode(session.getUri()).orElse("LOBBY");
		Room room = rooms.computeIfAbsent(roomCode, Room::new);
		room.join(session);
		sessionRooms.put(session.getId(), roomCode);
		room.broadcast();
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
		Room room = findRoom(session);
		if (room == null) {
			return;
		}

		Map<String, Object> payload = objectMapper.readValue(message.getPayload(), MESSAGE_TYPE);
		String type = String.valueOf(payload.getOrDefault("type", ""));

		if ("move".equals(type)) {
			int row = asInt(payload.get("row"));
			int col = asInt(payload.get("col"));
			room.move(session, row, col);
			return;
		}

		if ("reset".equals(type)) {
			room.reset();
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws IOException {
		Room room = findRoom(session);
		sessionRooms.remove(session.getId());

		if (room == null) {
			return;
		}

		room.leave(session);
		if (room.isEmpty()) {
			rooms.remove(room.code());
		} else {
			room.broadcast();
		}
	}

	private Room findRoom(WebSocketSession session) {
		String roomCode = sessionRooms.get(session.getId());
		return roomCode == null ? null : rooms.get(roomCode);
	}

	private Optional<String> getRoomCode(URI uri) {
		if (uri == null) {
			return Optional.empty();
		}

		String code = UriComponentsBuilder.fromUri(uri)
				.build()
				.getQueryParams()
				.getFirst("room");

		if (code == null || code.isBlank()) {
			return Optional.empty();
		}

		String normalized = code.replaceAll("[^A-Za-z0-9]", "")
				.toUpperCase(Locale.ROOT);
		return normalized.isBlank() ? Optional.empty() : Optional.of(normalized.substring(0, Math.min(12, normalized.length())));
	}

	private int asInt(Object value) {
		if (value instanceof Number number) {
			return number.intValue();
		}
		return -1;
	}

	private final class Room {
		private final String code;
		private final int[][] board = new int[BOARD_SIZE][BOARD_SIZE];
		private final Map<String, WebSocketSession> sessions = new HashMap<>();
		private final Map<String, Integer> players = new HashMap<>();
		private int nextPlayer = 1;
		private int turn = 1;
		private int winner = 0;
		private int moveCount = 0;
		private String status = "검은 돌 차례입니다.";

		private Room(String code) {
			this.code = code;
		}

		private String code() {
			return code;
		}

		private synchronized void join(WebSocketSession session) {
			sessions.put(session.getId(), session);
			int player = nextPlayer <= 2 ? nextPlayer++ : 0;
			players.put(session.getId(), player);
			if (player == 2) {
				status = "두 명이 연결됐습니다. 검은 돌부터 시작하세요.";
			}
		}

		private synchronized void leave(WebSocketSession session) {
			sessions.remove(session.getId());
			Integer player = players.remove(session.getId());
			if (player != null && player > 0) {
				status = playerName(player) + " 플레이어가 나갔습니다. 재접속하거나 새 판을 시작하세요.";
			}
		}

		private synchronized boolean isEmpty() {
			return sessions.isEmpty();
		}

		private synchronized void move(WebSocketSession session, int row, int col) throws IOException {
			int player = players.getOrDefault(session.getId(), 0);

			if (player == 0) {
				sendError(session, "관전자는 돌을 둘 수 없습니다.");
				return;
			}

			if (winner != 0) {
				sendError(session, "이미 승부가 났습니다. 새 판을 시작하세요.");
				return;
			}

			if (player != turn) {
				sendError(session, "지금은 " + playerName(turn) + " 차례입니다.");
				return;
			}

			if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE || board[row][col] != 0) {
				sendError(session, "둘 수 없는 자리입니다.");
				return;
			}

			board[row][col] = player;
			moveCount++;

			if (hasFive(row, col, player)) {
				winner = player;
				status = playerName(player) + " 승리!";
			} else if (moveCount == BOARD_SIZE * BOARD_SIZE) {
				status = "무승부입니다.";
			} else {
				turn = player == 1 ? 2 : 1;
				status = playerName(turn) + " 차례입니다.";
			}

			broadcast();
		}

		private synchronized void reset() throws IOException {
			for (int row = 0; row < BOARD_SIZE; row++) {
				for (int col = 0; col < BOARD_SIZE; col++) {
					board[row][col] = 0;
				}
			}

			turn = 1;
			winner = 0;
			moveCount = 0;
			status = "새 판입니다. 검은 돌부터 시작하세요.";
			broadcast();
		}

		private boolean hasFive(int row, int col, int player) {
			int[][] directions = { { 1, 0 }, { 0, 1 }, { 1, 1 }, { 1, -1 } };
			for (int[] direction : directions) {
				int count = 1
						+ countDirection(row, col, direction[0], direction[1], player)
						+ countDirection(row, col, -direction[0], -direction[1], player);
				if (count >= 5) {
					return true;
				}
			}
			return false;
		}

		private int countDirection(int row, int col, int rowStep, int colStep, int player) {
			int count = 0;
			int nextRow = row + rowStep;
			int nextCol = col + colStep;

			while (
					nextRow >= 0 &&
					nextRow < BOARD_SIZE &&
					nextCol >= 0 &&
					nextCol < BOARD_SIZE &&
					board[nextRow][nextCol] == player
			) {
				count++;
				nextRow += rowStep;
				nextCol += colStep;
			}

			return count;
		}

		private synchronized void broadcast() throws IOException {
			List<WebSocketSession> disconnected = new ArrayList<>();

			for (WebSocketSession session : sessions.values()) {
				if (session.isOpen()) {
					String payload = objectMapper.writeValueAsString(state(session.getId()));
					session.sendMessage(new TextMessage(payload));
				} else {
					disconnected.add(session);
				}
			}

			for (WebSocketSession session : disconnected) {
				leave(session);
			}
		}

		private Map<String, Object> state(String sessionId) {
			List<List<Integer>> rows = new ArrayList<>();
			for (int row = 0; row < BOARD_SIZE; row++) {
				List<Integer> cols = new ArrayList<>();
				for (int col = 0; col < BOARD_SIZE; col++) {
					cols.add(board[row][col]);
				}
				rows.add(cols);
			}

			Map<String, Integer> sessionPlayers = new HashMap<>(players);
			Map<String, Object> payload = new HashMap<>();
			payload.put("type", "state");
			payload.put("room", code);
			payload.put("board", rows);
			payload.put("turn", turn);
			payload.put("winner", winner);
			payload.put("status", status);
			payload.put("players", sessionPlayers.values().stream().filter(player -> player > 0).count());
			payload.put("spectators", sessionPlayers.values().stream().filter(player -> player == 0).count());
			payload.put("you", players.getOrDefault(sessionId, 0));
			return payload;
		}

		private void sendError(WebSocketSession session, String message) throws IOException {
			if (session.isOpen()) {
				session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
						"type", "error",
						"message", message))));
			}
		}

		private String playerName(int player) {
			return player == 1 ? "검은 돌" : "흰 돌";
		}
	}
}
