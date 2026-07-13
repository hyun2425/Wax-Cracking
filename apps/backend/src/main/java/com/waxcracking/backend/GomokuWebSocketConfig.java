package com.waxcracking.backend;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class GomokuWebSocketConfig implements WebSocketConfigurer {

	private final GomokuWebSocketHandler gomokuWebSocketHandler;
	private final CatchMindWebSocketHandler catchMindWebSocketHandler;
	private final PeopleQuizWebSocketHandler peopleQuizWebSocketHandler;

	@Value("${app.cors.allowed-origin-patterns}")
	private String allowedOriginPatterns;

	public GomokuWebSocketConfig(
			GomokuWebSocketHandler gomokuWebSocketHandler,
			CatchMindWebSocketHandler catchMindWebSocketHandler,
			PeopleQuizWebSocketHandler peopleQuizWebSocketHandler) {
		this.gomokuWebSocketHandler = gomokuWebSocketHandler;
		this.catchMindWebSocketHandler = catchMindWebSocketHandler;
		this.peopleQuizWebSocketHandler = peopleQuizWebSocketHandler;
	}

	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		String[] patterns = Arrays.stream(allowedOriginPatterns.split(","))
				.map(String::trim)
				.filter(pattern -> !pattern.isBlank())
				.toArray(String[]::new);

		registry.addHandler(gomokuWebSocketHandler, "/ws/gomoku")
				.setAllowedOriginPatterns(patterns);
		registry.addHandler(catchMindWebSocketHandler, "/ws/catchmind")
				.setAllowedOriginPatterns(patterns);
		registry.addHandler(peopleQuizWebSocketHandler, "/ws/people-quiz")
				.setAllowedOriginPatterns(patterns);
	}
}
