package com.waxcracking.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InitialQuizWebSocketHandler extends TextWebSocketHandler {
  private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
  private final ObjectMapper json = new ObjectMapper();
  private final Map<String, Room> rooms = new ConcurrentHashMap<>();
  private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();

  @Override public void afterConnectionEstablished(WebSocketSession session) throws IOException {
    String code = roomCode(session.getUri());
    Room room = rooms.computeIfAbsent(code, Room::new);
    sessionRooms.put(session.getId(), code);
    room.join(session);
    room.broadcast();
  }

  @Override protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
    Room room = rooms.get(sessionRooms.get(session.getId()));
    if (room == null) return;
    Map<String, Object> payload = json.readValue(message.getPayload(), MAP);
    String type = String.valueOf(payload.getOrDefault("type", ""));
    String value = String.valueOf(payload.getOrDefault("value", ""));
    switch (type) {
      case "profile" -> room.profile(session, value);
      case "category" -> room.category(session, value);
      case "start", "next" -> room.start(session);
      case "hint" -> room.hint(session);
      case "guess" -> room.guess(session, value);
      default -> { }
    }
  }

  @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws IOException {
    Room room = rooms.get(sessionRooms.remove(session.getId()));
    if (room == null) return;
    room.leave(session);
    if (room.sessions.isEmpty()) rooms.remove(room.code);
    else room.broadcast();
  }

  private String roomCode(URI uri) {
    String raw = uri == null ? "" : UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("room");
    String code = (raw == null ? "" : raw).replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    return code.isBlank() ? "LOBBY" : code.substring(0, Math.min(12, code.length()));
  }

  private static String clean(String value) { return Normalizer.normalize(value, Normalizer.Form.NFKC).replaceAll("\\s+", "").toLowerCase(Locale.ROOT); }
  private record Question(String answer, String category, String hint) {}
  private record Player(String id, String name, int score) {}
  private static final List<Question> QUESTIONS = List.of(
    new Question("김치찌개", "음식", "얼큰한 한국의 대표 찌개"), new Question("떡볶이", "음식", "매콤달콤한 분식"), new Question("삼겹살", "음식", "구워 먹는 돼지고기"),
    new Question("아이유", "연예", "가수이자 배우"), new Question("유재석", "연예", "국민 MC"), new Question("블랙핑크", "연예", "4인조 걸그룹"),
    new Question("경복궁", "장소", "서울의 대표 궁궐"), new Question("한강공원", "장소", "치킨과 라면이 떠오르는 곳"), new Question("제주도", "장소", "한라산이 있는 섬"),
    new Question("코끼리", "동물", "긴 코를 가진 동물"), new Question("펭귄", "동물", "남극의 새"), new Question("고슴도치", "동물", "가시가 있는 작은 동물")
  );

  private final class Room {
    final String code; final Map<String, WebSocketSession> sessions = new LinkedHashMap<>(); final Map<String, Player> players = new LinkedHashMap<>(); final Set<Question> used = new HashSet<>();
    String host = "", category = "전체"; Question question; int round; boolean solved, hintVisible;
    Room(String code) { this.code = code; }
    synchronized void join(WebSocketSession session) { sessions.put(session.getId(), session); players.put(session.getId(), new Player(session.getId(), "플레이어 " + (players.size() + 1), 0)); if (host.isBlank()) host = session.getId(); }
    synchronized void leave(WebSocketSession session) { sessions.remove(session.getId()); players.remove(session.getId()); if (host.equals(session.getId())) host = players.keySet().stream().findFirst().orElse(""); }
    synchronized void profile(WebSocketSession s, String name) throws IOException { Player player = players.get(s.getId()); if (player != null && !name.isBlank()) players.put(player.id(), new Player(player.id(), name.strip().substring(0, Math.min(16, name.strip().length())), player.score())); broadcast(); }
    synchronized void category(WebSocketSession s, String next) throws IOException { if (host.equals(s.getId()) && List.of("전체", "음식", "연예", "장소", "동물").contains(next)) { category = next; question = null; solved = false; hintVisible = false; broadcast(); } }
    synchronized void start(WebSocketSession s) throws IOException { if (!host.equals(s.getId())) return; List<Question> pool = QUESTIONS.stream().filter(q -> category.equals("전체") || q.category.equals(category)).filter(q -> !used.contains(q)).toList(); if (pool.isEmpty()) { used.clear(); pool = QUESTIONS.stream().filter(q -> category.equals("전체") || q.category.equals(category)).toList(); } question = pool.get(new Random().nextInt(pool.size())); used.add(question); round++; solved = false; hintVisible = false; broadcast(); }
    synchronized void hint(WebSocketSession s) throws IOException { if (host.equals(s.getId()) && question != null && !solved) { hintVisible = true; broadcast(); } }
    synchronized void guess(WebSocketSession s, String guess) throws IOException { if (question == null || solved || guess.isBlank()) return; Player player = players.get(s.getId()); if (player != null && clean(guess).equals(clean(question.answer))) { solved = true; players.put(player.id(), new Player(player.id(), player.name(), player.score() + 100)); broadcast(); } }
    synchronized void broadcast() throws IOException { for (WebSocketSession s : sessions.values()) if (s.isOpen()) s.sendMessage(new TextMessage(json.writeValueAsString(state(s.getId())))); }
    Map<String, Object> state(String you) { Map<String, Object> state = new LinkedHashMap<>(); state.put("type", "state"); state.put("room", code); state.put("hostId", host); state.put("you", you); state.put("category", category); state.put("categories", List.of("전체", "음식", "연예", "장소", "동물")); state.put("round", round); state.put("solved", solved); state.put("hintVisible", hintVisible); state.put("players", players.values().stream().sorted(Comparator.comparingInt(Player::score).reversed()).toList()); if (question != null) { state.put("initials", initials(question.answer)); state.put("questionCategory", question.category); state.put("hint", hintVisible || solved ? question.hint : ""); state.put("answer", solved ? question.answer : ""); } return state; }
  }
  private static final String[] INITIALS = {"ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"};
  private static String initials(String value) { StringBuilder result = new StringBuilder(); for (char character : value.toCharArray()) { int code = character - 0xac00; result.append(code >= 0 && code <= 11171 ? INITIALS[code / 588] : character).append(' '); } return result.toString().strip(); }
}
