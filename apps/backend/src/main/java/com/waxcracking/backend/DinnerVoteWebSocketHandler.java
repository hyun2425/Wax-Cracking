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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** A small server-authoritative room for choosing a team dinner menu. */
@Component
public class DinnerVoteWebSocketHandler extends TextWebSocketHandler {
  private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
  private static final List<String> DEFAULT_MENUS = List.of("Korean BBQ", "Chicken", "Sashimi", "Pork belly", "Chinese food", "Pizza");
  private final ObjectMapper json = new ObjectMapper();
  private final Map<String, Room> rooms = new ConcurrentHashMap<>();
  private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();

  @Override public void afterConnectionEstablished(WebSocketSession session) throws IOException {
    String code = roomCode(session.getUri()); Room room = rooms.computeIfAbsent(code, Room::new);
    room.join(session); sessionRooms.put(session.getId(), code); room.broadcast();
  }
  @Override protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
    Room room = rooms.get(sessionRooms.get(session.getId())); if (room == null) return;
    Map<String, Object> payload = json.readValue(message.getPayload(), MAP);
    String type = String.valueOf(payload.getOrDefault("type", ""));
    if ("profile".equals(type)) room.profile(session, text(payload.get("nickname")));
    if ("vote".equals(type)) room.vote(session, strings(payload.get("menuIds")));
    if ("addMenu".equals(type)) room.addMenu(session, text(payload.get("name")));
    if ("removeMenu".equals(type)) room.removeMenu(session, text(payload.get("menuId")));
  }
  @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws IOException {
    Room room = rooms.get(sessionRooms.remove(session.getId())); if (room == null) return;
    room.leave(session); if (room.sessions.isEmpty()) rooms.remove(room.code); else room.broadcast();
  }
  private String roomCode(URI uri) { String raw = uri == null ? "" : UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("room"); String code = (raw == null ? "" : raw).replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT); return code.isBlank() ? "LOBBY" : code.substring(0, Math.min(12, code.length())); }
  private static String text(Object value) { return value == null ? "" : String.valueOf(value); }
  private static List<String> strings(Object value) { return value instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of(); }

  private final class Room {
    final String code; final Map<String, WebSocketSession> sessions = new LinkedHashMap<>(); final Map<String, String> names = new LinkedHashMap<>(); final Map<String, List<String>> votes = new LinkedHashMap<>(); final List<Menu> menus = new ArrayList<>(); String host = ""; int nextMenuId = 1;
    Room(String code) { this.code = code; DEFAULT_MENUS.forEach(this::addDefault); }
    void addDefault(String name) { menus.add(new Menu("menu-" + nextMenuId++, name)); }
    synchronized void join(WebSocketSession session) { sessions.put(session.getId(), session); names.put(session.getId(), "Guest " + names.size()); if (host.isBlank()) host = session.getId(); }
    synchronized void leave(WebSocketSession session) { sessions.remove(session.getId()); names.remove(session.getId()); votes.remove(session.getId()); if (host.equals(session.getId())) host = sessions.keySet().stream().findFirst().orElse(""); }
    synchronized void profile(WebSocketSession s, String name) throws IOException { if (!name.isBlank()) names.put(s.getId(), name.strip().substring(0, Math.min(16, name.strip().length()))); broadcast(); }
    synchronized void vote(WebSocketSession s, List<String> selected) throws IOException { List<String> valid = selected.stream().distinct().filter(id -> menus.stream().anyMatch(menu -> menu.id.equals(id))).limit(2).toList(); if (valid.size() == 2) votes.put(s.getId(), valid); broadcast(); }
    synchronized void addMenu(WebSocketSession s, String name) throws IOException { if (!s.getId().equals(host) || name.isBlank() || menus.size() >= 20) return; menus.add(new Menu("menu-" + nextMenuId++, name.strip().substring(0, Math.min(24, name.strip().length())))); broadcast(); }
    synchronized void removeMenu(WebSocketSession s, String id) throws IOException { if (!s.getId().equals(host) || menus.size() <= 2) return; menus.removeIf(menu -> menu.id.equals(id)); votes.replaceAll((key, value) -> value.stream().filter(menuId -> !menuId.equals(id)).toList()); broadcast(); }
    synchronized void broadcast() throws IOException { for (WebSocketSession s : sessions.values()) if (s.isOpen()) s.sendMessage(new TextMessage(json.writeValueAsString(state(s.getId())))); }
    Map<String, Object> state(String you) { List<Map<String, Object>> ranked = menus.stream().map(menu -> Map.<String, Object>of("id", menu.id, "name", menu.name, "votes", votes.values().stream().filter(items -> items.contains(menu.id)).count())).sorted((a,b) -> Long.compare((Long)b.get("votes"), (Long)a.get("votes"))).toList(); return Map.of("type", "state", "room", code, "hostId", host, "you", you, "name", names.getOrDefault(you, "Guest"), "participants", names.size(), "voters", votes.size(), "menus", ranked, "myVotes", votes.getOrDefault(you, List.of())); }
  }
  private record Menu(String id, String name) {}
}
