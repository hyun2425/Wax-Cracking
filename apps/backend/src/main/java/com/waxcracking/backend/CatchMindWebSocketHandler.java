package com.waxcracking.backend;

import java.io.IOException;
import java.net.URI;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class CatchMindWebSocketHandler extends TextWebSocketHandler {

	private static final TypeReference<Map<String, Object>> MESSAGE_TYPE = new TypeReference<>() {
	};
	private static final int MAX_PLAYERS = 8;
	private static final int ROUND_SECONDS = 80;
	private static final List<String> WORDS = List.of(
			"우산", "달팽이", "피아노", "비행기", "호랑이", "김밥", "자전거", "눈사람", "로켓", "바나나",
			"선풍기", "캠핑", "고래", "도서관", "치킨", "마법사", "소방차", "수박", "카메라", "등대",
			"기린", "햄버거", "택시", "축구공", "무지개", "냉장고", "우주복", "공룡", "마이크", "선물",
			"초밥", "병원", "유령", "노트북", "핫도그", "버스", "잠수함", "연필", "나무", "아이스크림",
			"드럼", "해바라기", "망원경", "스케이트", "왕관", "커피", "풍선", "기타", "성", "복숭아",
			"열쇠", "양말", "컴퓨터", "배낭", "오리", "하트", "우체통", "도넛", "엘리베이터", "거북이",
			"팝콘", "헬리콥터", "양치질", "목도리", "침대", "트럭", "책상", "촛불", "테니스", "라면");

	private final ObjectMapper objectMapper = new ObjectMapper();
	private final ScheduledExecutorService timerExecutor = Executors.newSingleThreadScheduledExecutor();
	private final Map<String, Room> rooms = new ConcurrentHashMap<>();
	private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();

	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws IOException {
		String roomCode = getRoomCode(session.getUri()).orElse("LOBBY");
		Room room = rooms.computeIfAbsent(roomCode, Room::new);
		String joinError = room.join(session);
		if (!joinError.isBlank()) {
			session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
					"type", "notice",
					"message", joinError))));
			session.close(CloseStatus.POLICY_VIOLATION);
			return;
		}
		sessionRooms.put(session.getId(), roomCode);
		room.broadcastState();
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
		Room room = findRoom(session);
		if (room == null) {
			return;
		}

		Map<String, Object> payload = objectMapper.readValue(message.getPayload(), MESSAGE_TYPE);
		String type = asText(payload.get("type"));

		if ("profile".equals(type)) {
			room.profile(session, asText(payload.get("nickname")));
			return;
		}

		if ("start".equals(type)) {
			room.start(session, asText(payload.get("mode")));
			return;
		}

		if ("selectWord".equals(type)) {
			room.selectWord(session, asInt(payload.get("index")));
			return;
		}

		if ("draw".equals(type)) {
			room.draw(session, payload);
			return;
		}

		if ("clear".equals(type)) {
			room.clear(session);
			return;
		}

		if ("guess".equals(type)) {
			room.guess(session, asText(payload.get("message")));
			return;
		}

		if ("reveal".equals(type)) {
			room.reveal();
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
			room.broadcastState();
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

	private String asText(Object value) {
		return value == null ? "" : String.valueOf(value);
	}

	private int asInt(Object value) {
		if (value instanceof Number number) {
			return number.intValue();
		}
		return -1;
	}

	private final class Room {
		private final String code;
		private final Map<String, WebSocketSession> sessions = new LinkedHashMap<>();
		private final Map<String, Player> players = new LinkedHashMap<>();
		private final List<Map<String, Object>> strokes = new ArrayList<>();
		private final Set<String> correctPlayerIds = ConcurrentHashMap.newKeySet();
		private final Set<String> usedWordCandidates = new LinkedHashSet<>();
		private final List<String> turnOrder = new ArrayList<>();
		private final List<String> wordCandidates = new ArrayList<>();
		private String mode = "classic";
		private String phase = "lobby";
		private String word = "";
		private String drawerId = "";
		private String hostId = "";
		private String liarId = "";
		private String status = "방에 입장한 뒤 게임을 시작하세요.";
		private ScheduledFuture<?> roundTimer;
		private long roundEndsAt = 0;
		private int round = 0;
		private int turnIndex = -1;

		private Room(String code) {
			this.code = code;
		}

		private String code() {
			return code;
		}

		private synchronized String join(WebSocketSession session) {
			if (players.size() >= MAX_PLAYERS) {
				return "이 방은 최대 8명까지 입장할 수 있습니다.";
			}

			if (!"lobby".equals(phase) && !"finished".equals(phase)) {
				return "게임이 진행 중입니다. 다음 게임이 시작되기 전에 입장해 주세요.";
			}

			sessions.put(session.getId(), session);
			players.put(session.getId(), new Player(session.getId(), "플레이어 " + Math.min(99, players.size() + 1), 0));
			if (hostId.isBlank()) {
				hostId = session.getId();
			}
			return "";
		}

		private synchronized void leave(WebSocketSession session) {
			sessions.remove(session.getId());
			Player leaving = players.remove(session.getId());
			if (leaving == null) {
				return;
			}

			if (session.getId().equals(hostId)) {
				hostId = players.keySet().stream().findFirst().orElse("");
			}

			turnOrder.remove(session.getId());
			correctPlayerIds.remove(session.getId());

			if (players.size() < 2 || session.getId().equals(drawerId)) {
				resetGame("플레이어가 나갔습니다. 새 게임을 시작하세요.");
			}
		}

		private synchronized boolean isEmpty() {
			return sessions.isEmpty();
		}

		private synchronized void profile(WebSocketSession session, String rawNickname) throws IOException {
			Player player = players.get(session.getId());
			if (player == null) {
				return;
			}

			String nickname = rawNickname == null ? "" : rawNickname.strip().replaceAll("\\s+", " ");
			player.nickname = nickname.isBlank() ? player.nickname : nickname.substring(0, Math.min(16, nickname.length()));
			broadcastState();
		}

		private synchronized void start(WebSocketSession session, String requestedMode) throws IOException {
			if (!players.containsKey(hostId)) {
				hostId = players.keySet().stream().findFirst().orElse("");
			}

			if (!session.getId().equals(hostId)) {
				broadcastNotice("방장만 게임을 시작할 수 있습니다.");
				return;
			}

			if (!"lobby".equals(phase) && !"finished".equals(phase)) {
				broadcastNotice("이미 게임이 진행 중입니다.");
				return;
			}

			if (players.size() < 2) {
				broadcastNotice("2명 이상 입장하면 시작할 수 있습니다.");
				return;
			}

			mode = "liar".equals(requestedMode) ? "liar" : "classic";
			players.values().forEach(player -> player.score = 0);
			turnOrder.clear();
			turnOrder.addAll(players.keySet());
			Collections.shuffle(turnOrder);
			usedWordCandidates.clear();
			turnIndex = -1;
			round = 0;
			nextTurn();
		}

		private synchronized void selectWord(WebSocketSession session, int index) throws IOException {
			if (!"choosing".equals(phase) || !session.getId().equals(drawerId)) {
				return;
			}

			if (index < 0 || index >= wordCandidates.size()) {
				return;
			}

			word = wordCandidates.get(index);
			wordCandidates.clear();
			phase = "drawing";
			strokes.clear();
			correctPlayerIds.clear();
			List<String> guessers = players.keySet().stream()
					.filter(playerId -> !playerId.equals(drawerId))
					.toList();
			liarId = "liar".equals(mode) && !guessers.isEmpty()
					? guessers.get(ThreadLocalRandom.current().nextInt(guessers.size()))
					: "";
			roundEndsAt = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(ROUND_SECONDS);
			status = "그림을 보고 정답을 맞혀보세요.";
			scheduleRoundTimer();
			broadcastState();
			broadcastNotice("그리기가 시작되었습니다.");
		}

		private synchronized void draw(WebSocketSession session, Map<String, Object> stroke) throws IOException {
			if (!"drawing".equals(phase) || !session.getId().equals(drawerId)) {
				return;
			}

			Map<String, Object> payload = new HashMap<>(stroke);
			payload.put("type", "draw");
			strokes.add(payload);
			if (strokes.size() > 900) {
				strokes.remove(0);
			}
			sendToRoom(payload);
		}

		private synchronized void clear(WebSocketSession session) throws IOException {
			if (!"drawing".equals(phase) || !session.getId().equals(drawerId)) {
				return;
			}

			strokes.clear();
			sendToRoom(Map.of("type", "clear"));
		}

		private synchronized void guess(WebSocketSession session, String rawGuess) throws IOException {
			String guess = rawGuess == null ? "" : rawGuess.strip();
			if (guess.isBlank()) {
				return;
			}

			Player player = players.get(session.getId());
			if (player == null) {
				return;
			}

			if (!"drawing".equals(phase) || session.getId().equals(drawerId) || correctPlayerIds.contains(session.getId())) {
				return;
			}

			if (normalizeGuess(guess).equals(normalizeGuess(word))) {
				correctPlayerIds.add(session.getId());
				player.score += Math.max(1, 5 - correctPlayerIds.size());
				Player drawer = players.get(drawerId);
				if (drawer != null) {
					drawer.score += 1;
				}
				status = player.nickname + "님이 정답을 맞혔습니다.";
				broadcastState();
				broadcastNotice(player.nickname + "님이 정답을 맞혔습니다.");
				if (allGuessersCorrect()) {
					finishRound("모든 플레이어가 정답을 맞혔습니다.");
				}
				return;
			}

			sendToRoom(Map.of(
					"type", "chat",
					"sender", player.nickname,
					"message", guess.substring(0, Math.min(80, guess.length())),
					"sentAt", System.currentTimeMillis()));
		}

		private synchronized void reveal() throws IOException {
			if ("drawing".equals(phase) || "choosing".equals(phase)) {
				finishRound("정답 공개: " + word);
			}
		}

		private synchronized void nextTurn() throws IOException {
			cancelRoundTimer();
			turnIndex++;
			if (turnIndex >= turnOrder.size()) {
				phase = "finished";
				drawerId = "";
				liarId = "";
				word = "";
				wordCandidates.clear();
				strokes.clear();
				roundEndsAt = 0;
				status = "게임 종료! 모든 플레이어가 한 번씩 출제했습니다.";
				broadcastState();
				broadcastNotice("게임이 종료되었습니다.");
				return;
			}

			round++;
			drawerId = turnOrder.get(turnIndex);
			liarId = "";
			word = "";
			strokes.clear();
			correctPlayerIds.clear();
			wordCandidates.clear();
			wordCandidates.addAll(pickWordCandidates());
			phase = "choosing";
			roundEndsAt = 0;
			Player drawer = players.get(drawerId);
			status = (drawer == null ? "출제자" : drawer.nickname) + "님이 제시어를 선택하는 중입니다.";
			broadcastState();
			broadcastNotice("다음 출제자가 제시어를 선택합니다.");
		}

		private synchronized void finishRound(String message) throws IOException {
			cancelRoundTimer();
			phase = "revealed";
			roundEndsAt = 0;
			status = message;
			broadcastState();
			broadcastNotice("정답은 " + word + "입니다.");
			timerExecutor.schedule(() -> {
				try {
					synchronized (Room.this) {
						if ("revealed".equals(phase)) {
							nextTurn();
						}
					}
				} catch (IOException ignored) {
				}
			}, 4, TimeUnit.SECONDS);
		}

		private void scheduleRoundTimer() {
			cancelRoundTimer();
			roundTimer = timerExecutor.schedule(() -> {
				try {
					synchronized (Room.this) {
						if ("drawing".equals(phase)) {
							finishRound("제한시간이 종료되었습니다.");
						}
					}
				} catch (IOException ignored) {
				}
			}, ROUND_SECONDS, TimeUnit.SECONDS);
		}

		private void cancelRoundTimer() {
			if (roundTimer != null) {
				roundTimer.cancel(false);
				roundTimer = null;
			}
		}

		private synchronized void resetGame(String nextStatus) {
			cancelRoundTimer();
			phase = "lobby";
			drawerId = "";
			liarId = "";
			word = "";
			strokes.clear();
			correctPlayerIds.clear();
			usedWordCandidates.clear();
			turnOrder.clear();
			wordCandidates.clear();
			roundEndsAt = 0;
			round = 0;
			turnIndex = -1;
			status = nextStatus;
		}

		private boolean allGuessersCorrect() {
			return players.keySet().stream()
					.filter(playerId -> !playerId.equals(drawerId))
					.allMatch(correctPlayerIds::contains);
		}

		private List<String> pickWordCandidates() {
			List<String> available = WORDS.stream()
					.filter(candidate -> !usedWordCandidates.contains(candidate))
					.toList();
			if (available.size() < 3) {
				usedWordCandidates.clear();
				available = WORDS;
			}

			List<String> shuffled = new ArrayList<>(available);
			Collections.shuffle(shuffled);
			List<String> selected = shuffled.subList(0, Math.min(3, shuffled.size()));
			usedWordCandidates.addAll(selected);
			return selected;
		}

		private String normalizeGuess(String value) {
			return Normalizer.normalize(value, Normalizer.Form.NFKC)
					.replaceAll("\\s+", "")
					.toLowerCase(Locale.ROOT);
		}

		private synchronized void broadcastState() throws IOException {
			List<WebSocketSession> disconnected = new ArrayList<>();
			for (WebSocketSession session : sessions.values()) {
				if (session.isOpen()) {
					session.sendMessage(new TextMessage(objectMapper.writeValueAsString(state(session.getId()))));
				} else {
					disconnected.add(session);
				}
			}

			for (WebSocketSession session : disconnected) {
				leave(session);
				sessionRooms.remove(session.getId());
			}
		}

		private synchronized void broadcastNotice(String message) throws IOException {
			sendToRoom(Map.of("type", "notice", "message", message));
		}

		private synchronized void sendToRoom(Map<String, Object> payload) throws IOException {
			List<WebSocketSession> disconnected = new ArrayList<>();
			String message = objectMapper.writeValueAsString(payload);
			for (WebSocketSession session : sessions.values()) {
				if (session.isOpen()) {
					session.sendMessage(new TextMessage(message));
				} else {
					disconnected.add(session);
				}
			}

			for (WebSocketSession session : disconnected) {
				leave(session);
				sessionRooms.remove(session.getId());
			}
		}

		private Map<String, Object> state(String sessionId) {
			Map<String, Object> payload = new HashMap<>();
			payload.put("type", "state");
			payload.put("room", code);
			payload.put("mode", mode);
			payload.put("phase", phase);
			payload.put("round", round);
			payload.put("roundEndsAt", roundEndsAt);
			payload.put("status", status);
			payload.put("hostId", hostId);
			payload.put("players", playerList());
			payload.put("you", sessionId);
			payload.put("drawerId", drawerId);
			payload.put("drawerName", players.containsKey(drawerId) ? players.get(drawerId).nickname : "");
			payload.put("strokes", strokes);
			payload.put("correctPlayerIds", new ArrayList<>(correctPlayerIds));
			payload.put("turnOrder", turnOrder);

			if ("choosing".equals(phase) && sessionId.equals(drawerId)) {
				payload.put("wordCandidates", wordCandidates);
			} else {
				payload.put("wordCandidates", List.of());
			}

			if ("drawing".equals(phase) || "revealed".equals(phase)) {
				boolean shouldHideWord = "liar".equals(mode) && sessionId.equals(liarId) && "drawing".equals(phase);
				boolean shouldShowWord = sessionId.equals(drawerId) || correctPlayerIds.contains(sessionId) || "revealed".equals(phase);
				payload.put("word", shouldShowWord ? (shouldHideWord ? "라이어" : word) : "");
				payload.put("isLiar", sessionId.equals(liarId));
			} else {
				payload.put("word", "");
				payload.put("isLiar", false);
			}

			if ("revealed".equals(phase)) {
				payload.put("liarName", players.containsKey(liarId) ? players.get(liarId).nickname : "");
			}

			return payload;
		}

		private List<Map<String, Object>> playerList() {
			List<Map<String, Object>> result = new ArrayList<>();
			Set<String> liveIds = sessions.keySet();
			for (Player player : players.values()) {
				if (liveIds.contains(player.id)) {
					result.add(Map.of(
							"id", player.id,
							"nickname", player.nickname,
							"score", player.score));
				}
			}
			return result;
		}
	}

	private static final class Player {
		private final String id;
		private String nickname;
		private int score;

		private Player(String id, String nickname, int score) {
			this.id = id;
			this.nickname = nickname;
			this.score = score;
		}
	}
}
