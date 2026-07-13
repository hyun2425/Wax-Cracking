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
	private static final int LIAR_ROUND_SECONDS = 90;
	private static final int LIAR_TURN_SECONDS = 5;
	private static final int MAX_GUESS_SCORE = 100;
	private static final int GUESS_SCORE_STEP = 20;
	private static final List<String> WORDS = List.of(
			"우산", "달팽이", "피아노", "비행기", "호랑이", "김밥", "자전거", "눈사람", "로켓", "바나나",
			"선풍기", "캠핑", "고래", "도서관", "치킨", "마법사", "소방차", "수박", "카메라", "등대",
			"기린", "햄버거", "택시", "축구공", "무지개", "냉장고", "우주복", "공룡", "마이크", "선물",
			"초밥", "병원", "유령", "노트북", "핫도그", "버스", "잠수함", "연필", "나무", "아이스크림",
			"드럼", "해바라기", "망원경", "스케이트", "왕관", "커피", "풍선", "기타", "성", "복숭아",
			"열쇠", "양말", "컴퓨터", "배낭", "오리", "하트", "우체통", "도넛", "엘리베이터", "거북이",
			"팝콘", "헬리콥터", "양치질", "목도리", "침대", "트럭", "책상", "촛불", "테니스", "라면",
			"사과", "자동차", "강아지", "고양이", "토끼", "사자", "코끼리", "펭귄", "상어", "문어",
			"나비", "벌", "개미", "사슴", "여우", "늑대", "곰", "판다", "원숭이", "캥거루",
			"악어", "하마", "코뿔소", "낙타", "말", "소", "돼지", "양", "염소", "닭",
			"병아리", "참새", "독수리", "부엉이", "공작", "앵무새", "돌고래", "물개", "해파리", "불가사리",
			"조개", "게", "가재", "새우", "금붕어", "개구리", "도마뱀", "뱀", "두더지", "고슴도치",
			"다람쥐", "쥐", "박쥐", "코알라", "알파카", "라마", "얼룩말", "치타", "표범", "고릴라",
			"바다", "강", "호수", "폭포", "산", "화산", "동굴", "숲", "사막", "섬",
			"해변", "구름", "비", "눈", "번개", "태풍", "태양", "달", "별", "행성",
			"지구", "토성", "혜성", "은하수", "우주선", "인공위성", "외계인", "우주정거장", "분화구", "블랙홀",
			"집", "아파트", "학교", "교실", "운동장", "놀이터", "공원", "마트", "편의점", "식당",
			"카페", "빵집", "영화관", "박물관", "미술관", "경찰서", "소방서", "공항", "기차역", "정류장",
			"항구", "다리", "터널", "계단", "문", "창문", "지붕", "굴뚝", "울타리", "우물",
			"침실", "거실", "주방", "욕실", "화장실", "베란다", "차고", "정원", "수영장", "엘리베이터문",
			"냄비", "프라이팬", "주전자", "컵", "접시", "숟가락", "젓가락", "포크", "칼", "도마",
			"밥솥", "전자레인지", "오븐", "토스터", "믹서기", "청소기", "세탁기", "건조기", "에어컨", "난로",
			"시계", "거울", "액자", "화분", "꽃병", "소파", "의자", "옷장", "서랍장", "책장",
			"베개", "이불", "담요", "커튼", "카펫", "전등", "스탠드", "리모컨", "전화기", "스피커",
			"스마트폰", "태블릿", "키보드", "마우스", "모니터", "프린터", "충전기", "이어폰", "헤드폰", "게임기",
			"텔레비전", "라디오", "계산기", "손전등", "배터리", "전구", "멀티탭", "공구상자", "망치", "드라이버",
			"톱", "삽", "갈퀴", "호스", "사다리", "못", "자물쇠", "가위", "풀", "테이프",
			"지우개", "자", "크레파스", "물감", "붓", "팔레트", "스케치북", "공책", "책", "신문",
			"편지", "봉투", "우표", "지도", "달력", "일기장", "가방", "캐리어", "지갑", "동전",
			"지폐", "카드", "반지", "목걸이", "귀걸이", "팔찌", "안경", "선글라스", "모자", "헬멧",
			"운동화", "구두", "슬리퍼", "장화", "샌들", "티셔츠", "바지", "치마", "원피스", "코트",
			"재킷", "장갑", "벨트", "넥타이", "우비", "수영복", "앞치마", "교복", "한복", "드레스",
			"빗", "드라이기", "칫솔", "치약", "비누", "샴푸", "수건", "면도기", "향수", "립스틱",
			"피자", "파스타", "샌드위치", "샐러드", "스테이크", "떡볶이", "순대", "튀김", "만두", "국수",
			"우동", "짜장면", "짬뽕", "김치", "불고기", "비빔밥", "삼겹살", "갈비", "된장찌개", "김치찌개",
			"계란", "우유", "치즈", "버터", "요구르트", "빵", "케이크", "쿠키", "초콜릿", "사탕",
			"젤리", "껌", "감자튀김", "콜라", "주스", "물병", "찻잔", "와플", "팬케이크", "푸딩",
			"딸기", "포도", "귤", "오렌지", "레몬", "체리", "파인애플", "망고", "멜론", "참외",
			"배", "감", "자두", "키위", "블루베리", "토마토", "당근", "오이", "감자", "고구마",
			"양파", "마늘", "고추", "옥수수", "버섯", "브로콜리", "호박", "가지", "양배추", "상추",
			"기차", "지하철", "오토바이", "스쿠터", "보트", "요트", "여객선", "구급차", "경찰차", "굴착기",
			"지게차", "트랙터", "스케이트보드", "롤러스케이트", "썰매", "열기구", "낙하산", "유모차", "손수레", "케이블카",
			"도로", "신호등", "횡단보도", "주차장", "표지판", "주유소", "터미널", "여권", "비행표", "여행가방",
			"축구", "야구", "농구", "배구", "탁구", "골프", "수영", "스키", "볼링", "양궁",
			"권투", "유도", "태권도", "마라톤", "서핑", "낚시", "등산", "줄넘기", "훌라후프", "요가",
			"축구화", "글러브", "라켓", "골프채", "스키폴", "수영모", "튜브", "구명조끼", "텐트", "침낭",
			"모닥불", "랜턴", "나침반", "쌍안경", "물통", "돗자리", "피크닉", "바비큐", "낚싯대", "그물",
			"의사", "간호사", "경찰", "소방관", "선생님", "요리사", "화가", "가수", "배우", "운전기사",
			"파일럿", "우주비행사", "농부", "어부", "목수", "정비사", "사진작가", "미용사", "판사", "군인",
			"왕", "여왕", "공주", "왕자", "기사", "해적", "닌자", "로봇", "괴물", "천사",
			"좀비", "산타", "광대", "탐정", "슈퍼히어로", "악당", "요정", "인어", "도깨비", "용",
			"물방울", "불꽃", "얼음", "연기", "바람", "그림자", "거품", "모래성", "눈송이", "낙엽",
			"꽃", "장미", "튤립", "선인장", "대나무", "버섯집", "사과나무", "코코넛", "잔디", "씨앗",
			"벌집", "새둥지", "거미줄", "발자국", "깃털", "뼈다귀", "조약돌", "보석", "금메달", "트로피",
			"폭죽", "리본", "상자", "초대장", "케이크초", "마스크", "풍차", "회전목마", "미끄럼틀", "그네",
			"시소", "블록", "퍼즐", "인형", "곰인형", "장난감차", "물총", "비눗방울", "팽이", "연",
			"주사위", "카드게임", "체스", "마술봉", "보드게임", "종이비행기", "종이배", "색종이", "클립", "핀",
			"자석", "돋보기", "온도계", "저울", "현미경", "실험관", "비커", "자명종", "호루라기", "벨",
			"피리", "바이올린", "첼로", "트럼펫", "색소폰", "하모니카", "탬버린", "실로폰", "오르간", "메트로놈",
			"침", "약", "붕대", "주사기", "체온계", "목발", "휠체어", "구급상자", "마스크팩", "반창고");
	private static final List<LiarWord> LIAR_WORDS = List.of(
			new LiarWord("강아지", "동물"), new LiarWord("고양이", "동물"), new LiarWord("코끼리", "동물"),
			new LiarWord("기린", "동물"), new LiarWord("펭귄", "동물"), new LiarWord("토끼", "동물"),
			new LiarWord("상어", "동물"), new LiarWord("문어", "동물"), new LiarWord("악어", "동물"),
			new LiarWord("햄버거", "음식"), new LiarWord("피자", "음식"), new LiarWord("라면", "음식"),
			new LiarWord("떡볶이", "음식"), new LiarWord("초밥", "음식"), new LiarWord("김밥", "음식"),
			new LiarWord("아이스크림", "음식"), new LiarWord("케이크", "음식"), new LiarWord("수박", "음식"),
			new LiarWord("자동차", "탈것"), new LiarWord("비행기", "탈것"), new LiarWord("기차", "탈것"),
			new LiarWord("자전거", "탈것"), new LiarWord("버스", "탈것"), new LiarWord("로켓", "탈것"),
			new LiarWord("잠수함", "탈것"), new LiarWord("헬리콥터", "탈것"), new LiarWord("택시", "탈것"),
			new LiarWord("우산", "물건"), new LiarWord("카메라", "물건"), new LiarWord("노트북", "물건"),
			new LiarWord("스마트폰", "물건"), new LiarWord("열쇠", "물건"), new LiarWord("가위", "물건"),
			new LiarWord("시계", "물건"), new LiarWord("안경", "물건"), new LiarWord("책", "물건"),
			new LiarWord("학교", "장소"), new LiarWord("병원", "장소"), new LiarWord("공항", "장소"),
			new LiarWord("도서관", "장소"), new LiarWord("영화관", "장소"), new LiarWord("해변", "장소"),
			new LiarWord("놀이터", "장소"), new LiarWord("식당", "장소"), new LiarWord("마트", "장소"),
			new LiarWord("축구", "운동"), new LiarWord("야구", "운동"), new LiarWord("농구", "운동"),
			new LiarWord("수영", "운동"), new LiarWord("스키", "운동"), new LiarWord("볼링", "운동"),
			new LiarWord("골프", "운동"), new LiarWord("양궁", "운동"), new LiarWord("권투", "운동"),
			new LiarWord("의사", "직업"), new LiarWord("경찰", "직업"), new LiarWord("소방관", "직업"),
			new LiarWord("선생님", "직업"), new LiarWord("요리사", "직업"), new LiarWord("화가", "직업"),
			new LiarWord("가수", "직업"), new LiarWord("파일럿", "직업"), new LiarWord("우주비행사", "직업"));

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

		if ("continueGame".equals(type)) {
			room.continueGame(session);
			return;
		}

		if ("endGame".equals(type)) {
			room.endGame(session);
			return;
		}

		if ("selectWord".equals(type)) {
			room.selectWord(session, asInt(payload.get("index")), asText(payload.get("customWord")));
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

		if ("vote".equals(type)) {
			room.vote(session, asText(payload.get("targetId")));
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
		private final Set<String> correctPlayerIds = new LinkedHashSet<>();
		private final Set<String> usedWordCandidates = new LinkedHashSet<>();
		private final List<String> turnOrder = new ArrayList<>();
		private final List<String> wordCandidates = new ArrayList<>();
		private final Map<String, String> liarVotes = new LinkedHashMap<>();
		private String mode = "classic";
		private String phase = "lobby";
		private String word = "";
		private String category = "";
		private String drawerId = "";
		private String hostId = "";
		private String liarId = "";
		private String winnerTeam = "";
		private String status = "방에 입장한 뒤 게임을 시작하세요.";
		private ScheduledFuture<?> roundTimer;
		private ScheduledFuture<?> turnTimer;
		private long roundEndsAt = 0;
		private long turnEndsAt = 0;
		private boolean drawerScoreAwarded = false;
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

			if (!"lobby".equals(phase) && !"finished".equals(phase) && !"liarRevealed".equals(phase)) {
				broadcastNotice("이미 게임이 진행 중입니다.");
				return;
			}

			if ("liar".equals(requestedMode) && players.size() < 3) {
				broadcastNotice("라이어 캐치마인드는 3명 이상 입장하면 시작할 수 있습니다.");
				return;
			}

			if (players.size() < 2) {
				broadcastNotice("2명 이상 입장하면 시작할 수 있습니다.");
				return;
			}

			mode = "liar".equals(requestedMode) ? "liar" : "classic";
			players.values().forEach(player -> player.score = 0);
			usedWordCandidates.clear();
			if ("liar".equals(mode)) {
				startLiarGame();
				return;
			}
			startTurnCycle();
		}

		private synchronized void continueGame(WebSocketSession session) throws IOException {
			if (!session.getId().equals(hostId)) {
				broadcastNotice("방장만 다음 라운드를 시작할 수 있습니다.");
				return;
			}

			if (!"betweenGames".equals(phase)) {
				return;
			}

			startTurnCycle();
		}

		private synchronized void endGame(WebSocketSession session) throws IOException {
			if (!session.getId().equals(hostId)) {
				broadcastNotice("방장만 게임을 종료할 수 있습니다.");
				return;
			}

			if (!"betweenGames".equals(phase) && !"lobby".equals(phase)) {
				return;
			}

			cancelRoundTimer();
			phase = "finished";
			drawerId = "";
			liarId = "";
			word = "";
			category = "";
			winnerTeam = "";
			wordCandidates.clear();
			strokes.clear();
			correctPlayerIds.clear();
			liarVotes.clear();
			roundEndsAt = 0;
			turnEndsAt = 0;
			status = "게임 종료! 최종 순위를 확인하세요.";
			broadcastState();
			broadcastNotice("게임이 종료되었습니다.");
		}

		private synchronized void startTurnCycle() throws IOException {
			turnOrder.clear();
			turnOrder.addAll(players.keySet());
			Collections.shuffle(turnOrder);
			turnIndex = -1;
			round = 0;
			nextTurn();
		}

		private synchronized void startLiarGame() throws IOException {
			cancelRoundTimer();
			cancelTurnTimer();
			List<String> playerIds = new ArrayList<>(players.keySet());
			Collections.shuffle(playerIds);
			liarId = playerIds.get(ThreadLocalRandom.current().nextInt(playerIds.size()));
			LiarWord selected = LIAR_WORDS.get(ThreadLocalRandom.current().nextInt(LIAR_WORDS.size()));
			word = selected.word();
			category = selected.category();
			winnerTeam = "";
			turnOrder.clear();
			turnOrder.addAll(playerIds);
			turnIndex = -1;
			round = 1;
			strokes.clear();
			correctPlayerIds.clear();
			wordCandidates.clear();
			liarVotes.clear();
			phase = "liarDrawing";
			roundEndsAt = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(LIAR_ROUND_SECONDS);
			status = "라이어를 숨긴 채 모두가 함께 그림을 이어 그립니다.";
			nextLiarTurn();
			scheduleLiarRoundTimer();
			broadcastState();
			broadcastNotice("라이어 캐치마인드가 시작되었습니다.");
		}

		private synchronized void selectWord(WebSocketSession session, int index, String rawCustomWord) throws IOException {
			if (!"choosing".equals(phase) || !session.getId().equals(drawerId)) {
				return;
			}

			String selectedWord = "";
			String customWord = sanitizeCustomWord(rawCustomWord);
			if (!customWord.isBlank()) {
				selectedWord = customWord;
				usedWordCandidates.add(selectedWord);
			} else {
				if (index < 0 || index >= wordCandidates.size()) {
					return;
				}
				selectedWord = wordCandidates.get(index);
			}

			word = selectedWord;
			wordCandidates.clear();
			phase = "drawing";
			strokes.clear();
			correctPlayerIds.clear();
			drawerScoreAwarded = false;
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

		private String sanitizeCustomWord(String rawCustomWord) {
			if (rawCustomWord == null) {
				return "";
			}

			String normalized = rawCustomWord.strip().replaceAll("\\s+", " ");
			if (normalized.length() > 20) {
				normalized = normalized.substring(0, 20);
			}
			return normalized;
		}

		private synchronized void draw(WebSocketSession session, Map<String, Object> stroke) throws IOException {
			if ("liarDrawing".equals(phase)) {
				if (!session.getId().equals(drawerId)) {
					return;
				}

				Map<String, Object> payload = new HashMap<>(stroke);
				payload.put("type", "draw");
				strokes.add(payload);
				if (strokes.size() > 1200) {
					strokes.remove(0);
				}
				sendToRoom(payload);
				return;
			}

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
			if ("liarDrawing".equals(phase)) {
				if (!session.getId().equals(drawerId) && !session.getId().equals(hostId)) {
					return;
				}

				strokes.clear();
				sendToRoom(Map.of("type", "clear"));
				return;
			}

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
				int rank = correctPlayerIds.size() + 1;
				int earnedScore = scoreForGuessRank(rank);
				correctPlayerIds.add(session.getId());
				player.score += earnedScore;
				status = player.nickname + "님이 " + rank + "등으로 정답을 맞혀 +" + earnedScore + "점을 얻었습니다.";
				broadcastState();
				broadcastNotice(player.nickname + "님이 정답을 맞혔습니다. +" + earnedScore + "점");
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
			if ("liarDrawing".equals(phase)) {
				startVoting();
				return;
			}

			if ("drawing".equals(phase) || "choosing".equals(phase)) {
				finishRound("정답 공개: " + word);
			}
		}

		private synchronized void vote(WebSocketSession session, String targetId) throws IOException {
			if (!"voting".equals(phase) || !players.containsKey(session.getId()) || !players.containsKey(targetId)) {
				return;
			}

			liarVotes.put(session.getId(), targetId);
			status = "투표 진행 중: " + liarVotes.size() + "/" + players.size();
			broadcastState();

			if (liarVotes.size() >= players.size()) {
				revealLiarResult();
			}
		}

		private synchronized void nextTurn() throws IOException {
			cancelRoundTimer();
			turnIndex++;
			if (turnIndex >= turnOrder.size()) {
				phase = "betweenGames";
				drawerId = "";
				liarId = "";
				word = "";
				wordCandidates.clear();
				strokes.clear();
				roundEndsAt = 0;
				status = "모든 플레이어가 한 번씩 출제했습니다. 한 라운드 더 진행할까요?";
				broadcastState();
				broadcastNotice("한 라운드가 끝났습니다.");
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
			awardDrawerScore();
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

		private synchronized void nextLiarTurn() throws IOException {
			if (!"liarDrawing".equals(phase) || turnOrder.isEmpty()) {
				return;
			}

			turnIndex = (turnIndex + 1) % turnOrder.size();
			drawerId = turnOrder.get(turnIndex);
			Player drawer = players.get(drawerId);
			turnEndsAt = Math.min(
					roundEndsAt,
					System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(LIAR_TURN_SECONDS));
			status = (drawer == null ? "플레이어" : drawer.nickname) + "님 차례입니다. 5초 동안 그리세요.";
			scheduleLiarTurnTimer();
			broadcastState();
		}

		private synchronized void startVoting() throws IOException {
			cancelRoundTimer();
			cancelTurnTimer();
			phase = "voting";
			drawerId = "";
			turnEndsAt = 0;
			roundEndsAt = 0;
			liarVotes.clear();
			status = "그림이 완성되었습니다. 라이어라고 생각하는 사람에게 투표하세요.";
			broadcastState();
			broadcastNotice("투표를 시작합니다. 정답은 아직 공개되지 않습니다.");
		}

		private synchronized void revealLiarResult() throws IOException {
			cancelRoundTimer();
			cancelTurnTimer();
			phase = "liarRevealed";
			drawerId = "";
			turnEndsAt = 0;
			roundEndsAt = 0;
			String accusedId = mostVotedPlayerId();
			boolean citizensWin = liarId.equals(accusedId);
			winnerTeam = citizensWin ? "citizens" : "liar";
			Player liar = players.get(liarId);
			Player accused = players.get(accusedId);
			status = citizensWin
					? "일반 플레이어 승리! 라이어를 찾아냈습니다."
					: "라이어 승리! 라이어가 들키지 않았습니다.";
			broadcastState();
			broadcastNotice("정답은 " + word + "입니다. 라이어는 "
					+ (liar == null ? "-" : liar.nickname) + "님입니다. 최다 지목: "
					+ (accused == null ? "-" : accused.nickname));
		}

		private String mostVotedPlayerId() {
			return players.keySet().stream()
					.max((left, right) -> Integer.compare(voteCount(left), voteCount(right)))
					.orElse("");
		}

		private int voteCount(String playerId) {
			int count = 0;
			for (String targetId : liarVotes.values()) {
				if (playerId.equals(targetId)) {
					count++;
				}
			}
			return count;
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

		private void scheduleLiarRoundTimer() {
			cancelRoundTimer();
			roundTimer = timerExecutor.schedule(() -> {
				try {
					synchronized (Room.this) {
						if ("liarDrawing".equals(phase)) {
							startVoting();
						}
					}
				} catch (IOException ignored) {
				}
			}, LIAR_ROUND_SECONDS, TimeUnit.SECONDS);
		}

		private void scheduleLiarTurnTimer() {
			cancelTurnTimer();
			long delayMillis = Math.max(250, turnEndsAt - System.currentTimeMillis());
			turnTimer = timerExecutor.schedule(() -> {
				try {
					synchronized (Room.this) {
						if ("liarDrawing".equals(phase)) {
							if (System.currentTimeMillis() >= roundEndsAt) {
								startVoting();
							} else {
								nextLiarTurn();
							}
						}
					}
				} catch (IOException ignored) {
				}
			}, delayMillis, TimeUnit.MILLISECONDS);
		}

		private void cancelRoundTimer() {
			if (roundTimer != null) {
				roundTimer.cancel(false);
				roundTimer = null;
			}
		}

		private void cancelTurnTimer() {
			if (turnTimer != null) {
				turnTimer.cancel(false);
				turnTimer = null;
			}
		}

		private synchronized void resetGame(String nextStatus) {
			cancelRoundTimer();
			cancelTurnTimer();
			phase = "lobby";
			drawerId = "";
			liarId = "";
			word = "";
			category = "";
			winnerTeam = "";
			strokes.clear();
			correctPlayerIds.clear();
			liarVotes.clear();
			usedWordCandidates.clear();
			turnOrder.clear();
			wordCandidates.clear();
			roundEndsAt = 0;
			turnEndsAt = 0;
			drawerScoreAwarded = false;
			round = 0;
			turnIndex = -1;
			status = nextStatus;
		}

		private boolean allGuessersCorrect() {
			return players.keySet().stream()
					.filter(playerId -> !playerId.equals(drawerId))
					.allMatch(correctPlayerIds::contains);
		}

		private int scoreForGuessRank(int rank) {
			return Math.max(20, MAX_GUESS_SCORE - (rank - 1) * GUESS_SCORE_STEP);
		}

		private void awardDrawerScore() {
			if (drawerScoreAwarded || drawerId.isBlank()) {
				return;
			}

			Player drawer = players.get(drawerId);
			if (drawer == null || players.isEmpty()) {
				return;
			}

			int earnedScore = Math.round((correctPlayerIds.size() * 100.0f) / players.size());
			drawer.score += earnedScore;
			drawerScoreAwarded = true;
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
			payload.put("turnEndsAt", turnEndsAt);
			payload.put("status", status);
			payload.put("hostId", hostId);
			payload.put("players", playerList());
			payload.put("you", sessionId);
			payload.put("drawerId", drawerId);
			payload.put("drawerName", players.containsKey(drawerId) ? players.get(drawerId).nickname : "");
			payload.put("strokes", strokes);
			payload.put("correctPlayerIds", new ArrayList<>(correctPlayerIds));
			payload.put("turnOrder", turnOrder);
			payload.put("category", "");
			payload.put("myVote", liarVotes.getOrDefault(sessionId, ""));
			payload.put("votesCast", liarVotes.size());
			payload.put("winnerTeam", winnerTeam);

			if ("choosing".equals(phase) && sessionId.equals(drawerId)) {
				payload.put("wordCandidates", wordCandidates);
			} else {
				payload.put("wordCandidates", List.of());
			}

			if ("liarDrawing".equals(phase) || "voting".equals(phase) || "liarRevealed".equals(phase)) {
				boolean isCurrentLiar = sessionId.equals(liarId);
				payload.put("isLiar", isCurrentLiar);
				payload.put("word", isCurrentLiar && !"liarRevealed".equals(phase) ? "" : word);
				payload.put("category", category);
				if ("liarRevealed".equals(phase)) {
					payload.put("liarName", players.containsKey(liarId) ? players.get(liarId).nickname : "");
					payload.put("voteCounts", voteCounts());
				}
				return payload;
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

		private Map<String, Integer> voteCounts() {
			Map<String, Integer> result = new HashMap<>();
			for (String playerId : players.keySet()) {
				result.put(playerId, voteCount(playerId));
			}
			return result;
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

	private record LiarWord(String word, String category) {
	}
}
