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

/** Server-authoritative quiz rooms. Add new question sources, hint policies, or image reveal policies here. */
@Component
public class PeopleQuizWebSocketHandler extends TextWebSocketHandler {
  private static final TypeReference<Map<String,Object>> MAP = new TypeReference<>() {};
  private final ObjectMapper json = new ObjectMapper();
  private final Map<String,Room> rooms = new ConcurrentHashMap<>();
  private final Map<String,String> sessionRooms = new ConcurrentHashMap<>();
  @Override public void afterConnectionEstablished(WebSocketSession s) throws IOException { String c=roomCode(s.getUri()); Room r=rooms.computeIfAbsent(c,Room::new); r.join(s);sessionRooms.put(s.getId(),c);r.broadcast(); }
  @Override protected void handleTextMessage(WebSocketSession s, TextMessage m) throws IOException { Room r=rooms.get(sessionRooms.get(s.getId()));if(r==null)return; Map<String,Object> p=json.readValue(m.getPayload(),MAP);String t=String.valueOf(p.getOrDefault("type",""));String v=String.valueOf(p.getOrDefault("message",p.getOrDefault("nickname",p.getOrDefault("category","")))); if("profile".equals(t))r.profile(s,v);else if("start".equals(t)||"next".equals(t))r.start(s);else if("category".equals(t))r.category(s,v);else if("guess".equals(t))r.guess(s,v);else if("chat".equals(t))r.chat(s,v);else if("hint".equals(t))r.hint(s);else if("reveal".equals(t))r.reveal(s); }
  @Override public void afterConnectionClosed(WebSocketSession s, CloseStatus x) throws IOException { Room r=rooms.get(sessionRooms.remove(s.getId()));if(r!=null){r.leave(s);if(r.sessions.isEmpty())rooms.remove(r.code);else r.broadcast();} }
  private String roomCode(URI u){String raw=u==null?"":UriComponentsBuilder.fromUri(u).build().getQueryParams().getFirst("room");String c=(raw==null?"":raw).replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT);return c.isBlank()?"LOBBY":c.substring(0,Math.min(12,c.length()));}
  private static String clean(String s){return Normalizer.normalize(s,Normalizer.Form.NFKC).replaceAll("\\s+","").toLowerCase(Locale.ROOT);}
  private record Question(String answer,String category,String hint,String imageUrl) {}
  private record Player(String id,String name,int score) {}
  private static final List<Question> QUESTIONS=List.of(
    new Question("Albert Einstein","Science","Theory of relativity","https://upload.wikimedia.org/wikipedia/commons/d/d3/Albert_Einstein_Head.jpg"),
    new Question("Marie Curie","Science","Radioactivity pioneer","https://upload.wikimedia.org/wikipedia/commons/c/c8/Marie_Curie_c._1920s.jpg"),
    new Question("Nelson Mandela","Leaders","South African president","https://upload.wikimedia.org/wikipedia/commons/0/02/Nelson_Mandela-2008_%28edit%29.jpg"),
    new Question("Frida Kahlo","Arts","Mexican self-portrait artist","https://upload.wikimedia.org/wikipedia/commons/1/1c/Frida_Kahlo_%28cropped%29.jpg")
  );
  private final class Room {
    final String code; final Map<String,WebSocketSession> sessions=new LinkedHashMap<>();final Map<String,Player> players=new LinkedHashMap<>();final List<Map<String,Object>> chat=new ArrayList<>(); final Set<Question> used=new HashSet<>();String host="",category="ALL";Question question;boolean solved;int round;
    Room(String c){code=c;} synchronized void join(WebSocketSession s){sessions.put(s.getId(),s);players.put(s.getId(),new Player(s.getId(),"Player "+players.size()+1,0));if(host.isBlank())host=s.getId();}
    synchronized void leave(WebSocketSession s){sessions.remove(s.getId());players.remove(s.getId());if(host.equals(s.getId()))host=players.keySet().stream().findFirst().orElse("");}
    synchronized void profile(WebSocketSession s,String n)throws IOException{Player p=players.get(s.getId());if(p!=null&&!n.isBlank())players.put(p.id(),new Player(p.id(),n.strip().substring(0,Math.min(16,n.strip().length())),p.score()));broadcast();}
    synchronized void category(WebSocketSession s,String c)throws IOException{if(host.equals(s.getId())){category=List.of("ALL","Science","Leaders","Arts").contains(c)?c:"ALL";question=null;solved=false;broadcast();}}
    synchronized void start(WebSocketSession s)throws IOException{if(!host.equals(s.getId()))return;List<Question> pool=QUESTIONS.stream().filter(q->"ALL".equals(category)||q.category().equals(category)).filter(q->!used.contains(q)).toList();if(pool.isEmpty()){used.clear();pool=QUESTIONS.stream().filter(q->"ALL".equals(category)||q.category().equals(category)).toList();}question=pool.get(new Random().nextInt(pool.size()));used.add(question);solved=false;round++;chat.clear();note("Round "+round+" started — first correct answer gets 100 points.");broadcast();}
    synchronized void guess(WebSocketSession s,String a)throws IOException{if(question==null||solved)return;Player p=players.get(s.getId());if(p==null||a.isBlank())return;if(clean(a).equals(clean(question.answer()))){solved=true;players.put(p.id(),new Player(p.id(),p.name(),p.score()+100));note(p.name()+" got it first! +100");broadcast();}else chat(s,a);}
    synchronized void chat(WebSocketSession s,String m)throws IOException{Player p=players.get(s.getId());if(p==null||m.isBlank())return;chat.add(Map.of("sender",p.name(),"message",m.strip().substring(0,Math.min(100,m.strip().length())),"system",false));broadcast();}
    synchronized void hint(WebSocketSession s)throws IOException{if(host.equals(s.getId())&&question!=null){chat.add(Map.of("sender","HINT","message",question.hint(),"system",true));broadcast();}}
    synchronized void reveal(WebSocketSession s)throws IOException{if(host.equals(s.getId())&&question!=null){solved=true;broadcast();}}
    void note(String m){chat.add(Map.of("sender","QUIZ SHOW","message",m,"system",true));}
    synchronized void broadcast()throws IOException{for(WebSocketSession s:sessions.values())if(s.isOpen())s.sendMessage(new TextMessage(json.writeValueAsString(state(s.getId()))));}
    Map<String,Object> state(String you){Map<String,Object> v=new LinkedHashMap<>();v.put("type","state");v.put("room",code);v.put("hostId",host);v.put("you",you);v.put("category",category);v.put("categories",List.of("ALL","Science","Leaders","Arts"));v.put("round",round);v.put("solved",solved);v.put("players",players.values().stream().sorted(Comparator.comparingInt(Player::score).reversed()).toList());v.put("messages",chat);if(question!=null){v.put("imageUrl",question.imageUrl());v.put("questionCategory",question.category());v.put("answer",solved?question.answer():"");}return v;}
  }
}
