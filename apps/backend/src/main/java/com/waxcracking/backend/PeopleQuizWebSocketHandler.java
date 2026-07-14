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
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Server-authoritative quiz rooms. Add new question sources, hint policies, or image reveal policies here. */
@Component
public class PeopleQuizWebSocketHandler extends TextWebSocketHandler {
  private static final TypeReference<Map<String,Object>> MAP = new TypeReference<>() {};
  private final ObjectMapper json = new ObjectMapper();
  private final Map<String,Room> rooms = new ConcurrentHashMap<>();
  private final Map<String,String> sessionRooms = new ConcurrentHashMap<>();
  private final ScheduledExecutorService quizScheduler = Executors.newSingleThreadScheduledExecutor();
  @Override public void afterConnectionEstablished(WebSocketSession s) throws IOException { String c=roomCode(s.getUri()); Room r=rooms.computeIfAbsent(c,Room::new); r.join(s);sessionRooms.put(s.getId(),c);r.broadcast(); }
  @Override protected void handleTextMessage(WebSocketSession s, TextMessage m) throws IOException { Room r=rooms.get(sessionRooms.get(s.getId()));if(r==null)return; Map<String,Object> p=json.readValue(m.getPayload(),MAP);String t=String.valueOf(p.getOrDefault("type",""));String v=String.valueOf(p.getOrDefault("message",p.getOrDefault("nickname",p.getOrDefault("category","")))); if("profile".equals(t))r.profile(s,v);else if("start".equals(t)||"next".equals(t))r.start(s);else if("category".equals(t))r.category(s,v);else if("guess".equals(t))r.guess(s,v);else if("chat".equals(t))r.chat(s,v);else if("hint".equals(t))r.hint(s);else if("reveal".equals(t))r.reveal(s); }
  @Override public void afterConnectionClosed(WebSocketSession s, CloseStatus x) throws IOException { Room r=rooms.get(sessionRooms.remove(s.getId()));if(r!=null){r.leave(s);if(r.sessions.isEmpty())rooms.remove(r.code);else r.broadcast();} }
  private String roomCode(URI u){String raw=u==null?"":UriComponentsBuilder.fromUri(u).build().getQueryParams().getFirst("room");String c=(raw==null?"":raw).replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT);return c.isBlank()?"LOBBY":c.substring(0,Math.min(12,c.length()));}
  private static String clean(String s){return Normalizer.normalize(s,Normalizer.Form.NFKC).replaceAll("\\s+","").toLowerCase(Locale.ROOT);}
  private record Question(String answer,String aliases,String category,String hint,String imageUrl,String sourceUrl,String license) {}
  private record Player(String id,String name,int score) {}
  /** Photo files are bundled with the frontend; each filename is the answer. */
  private static final List<Question> QUESTIONS=List.of(
    localQuestion("권나라", "배우 겸 가수로 활동했습니다."),
    localQuestion("기안84", "웹툰 작가이자 예능인입니다."),
    localQuestion("나영석", "여러 여행 예능을 연출한 PD입니다."),
    localQuestion("민지", "뉴진스의 멤버입니다."),
    localQuestion("뷔", "BTS의 멤버입니다."),
    localQuestion("아이유", "본명은 이지은인 가수 겸 배우입니다."),
    localQuestion("안유진", "아이브의 리더입니다."),
    localQuestion("원희", "아일릿의 멤버입니다."),
    localQuestion("이종석", "드라마 피노키오에 출연한 배우입니다."),
    localQuestion("장원영", "아이브의 멤버입니다."),
    localQuestion("장항준", "영화와 예능에서 활동하는 감독입니다."),
    localQuestion("재현", "NCT의 멤버입니다."),
    localQuestion("침착맨", "웹툰 작가 출신의 인터넷 방송인입니다."),
    localQuestion("필릭스", "스트레이 키즈의 멤버입니다."),
    localQuestion("화사", "마마무의 멤버입니다.")
  );

  private static Question localQuestion(String answer, String hint) {
    String aliases = switch (answer) {
      case "권나라" -> "신예진,예진";
      case "재현" -> "정재현";
      default -> "";
    };
    return new Question(answer, aliases, "연예인", hint, "/people-quiz/" + answer + ".jpg", "", "사용자 제공 사진");
  }
  private final class Room {
    final String code; final Map<String,WebSocketSession> sessions=new LinkedHashMap<>();final Map<String,Player> players=new LinkedHashMap<>();final List<Map<String,Object>> chat=new ArrayList<>(); final Set<Question> used=new HashSet<>();String host="",category="전체";Question question;boolean solved;int round;int hintLevel;
    Room(String c){code=c;} synchronized void join(WebSocketSession s){sessions.put(s.getId(),s);players.put(s.getId(),new Player(s.getId(),"Player "+players.size()+1,0));if(host.isBlank())host=s.getId();}
    synchronized void leave(WebSocketSession s){sessions.remove(s.getId());players.remove(s.getId());if(host.equals(s.getId()))host=players.keySet().stream().findFirst().orElse("");}
    synchronized void profile(WebSocketSession s,String n)throws IOException{Player p=players.get(s.getId());if(p!=null&&!n.isBlank())players.put(p.id(),new Player(p.id(),n.strip().substring(0,Math.min(16,n.strip().length())),p.score()));broadcast();}
    synchronized void category(WebSocketSession s,String c)throws IOException{if(host.equals(s.getId())){category="연예인";question=null;solved=false;broadcast();}}
    synchronized void start(WebSocketSession s)throws IOException{if(!host.equals(s.getId()))return;startNextQuestion();broadcast();}
    private void startNextQuestion(){List<Question> pool=QUESTIONS.stream().filter(q->"전체".equals(category)||q.category().equals(category)).filter(q->!used.contains(q)).toList();if(pool.isEmpty()){used.clear();pool=QUESTIONS.stream().filter(q->"전체".equals(category)||q.category().equals(category)).toList();}question=pool.get(new Random().nextInt(pool.size()));used.add(question);solved=false;hintLevel=0;round++;chat.clear();note(round+"번째 문제를 시작합니다. 가장 먼저 정답을 맞히면 100점!");}
    synchronized void guess(WebSocketSession s,String a)throws IOException{if(question==null||solved)return;Player p=players.get(s.getId());if(p==null||a.isBlank())return;if(isCorrectAnswer(a)){solved=true;players.put(p.id(),new Player(p.id(),p.name(),p.score()+100));note(p.name()+"님이 가장 먼저 정답을 맞혔습니다! +100점");broadcast();quizScheduler.schedule(()->{synchronized(Room.this){if(solved&&!sessions.isEmpty()){try{startNextQuestion();broadcast();}catch(IOException ignored){}}}},2,TimeUnit.SECONDS);}else chat(s,a);}
    private boolean isCorrectAnswer(String guess) { String normalized=clean(guess); return clean(question.answer()).equals(normalized) || Arrays.stream(question.aliases().split(",")).filter(alias->!alias.isBlank()).map(PeopleQuizWebSocketHandler::clean).anyMatch(normalized::equals); }
    synchronized void chat(WebSocketSession s,String m)throws IOException{Player p=players.get(s.getId());if(p==null||m.isBlank())return;chat.add(Map.of("sender",p.name(),"message",m.strip().substring(0,Math.min(100,m.strip().length())),"system",false));broadcast();}
    synchronized void hint(WebSocketSession s)throws IOException{if(host.equals(s.getId())&&question!=null&&!solved){hintLevel=Math.min(2,hintLevel+1);chat.add(Map.of("sender","HINT","message",question.hint(),"system",true));broadcast();}}
    synchronized void reveal(WebSocketSession s)throws IOException{if(host.equals(s.getId())&&question!=null){solved=true;broadcast();}}
    void note(String m){chat.add(Map.of("sender","QUIZ SHOW","message",m,"system",true));}
    synchronized void broadcast()throws IOException{for(WebSocketSession s:sessions.values())if(s.isOpen())s.sendMessage(new TextMessage(json.writeValueAsString(state(s.getId()))));}
    Map<String,Object> state(String you){Map<String,Object> v=new LinkedHashMap<>();v.put("type","state");v.put("room",code);v.put("hostId",host);v.put("you",you);v.put("category",category);v.put("categories",List.of("전체","연예인"));v.put("round",round);v.put("solved",solved);v.put("hintLevel",hintLevel);v.put("players",players.values().stream().sorted(Comparator.comparingInt(Player::score).reversed()).toList());v.put("messages",chat);if(question!=null){v.put("imageUrl",question.imageUrl());v.put("questionCategory",question.category());v.put("answer",solved?question.answer():"");v.put("sourceUrl",solved?question.sourceUrl():"");v.put("license",solved?question.license():"");}return v;}
  }
}
