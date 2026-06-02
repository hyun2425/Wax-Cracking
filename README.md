# 온라인 왁스볼 크래킹

온라인 왁스볼 크래킹은 왁스볼을 냉동한 뒤 깨는 ASMR 경험을 웹에서 가볍게 즐길 수 있도록 만드는 프로젝트입니다.

프론트엔드는 `Next.js`, `TypeScript`, `TailwindCSS`로 만들고, 백엔드는 `Spring Boot`로 구성합니다. 현재는 데이터베이스를 사용하지 않습니다.

## 프로젝트 구성

```text
apps/frontend  # Next.js 프론트엔드
apps/backend   # Spring Boot 백엔드
```

## 로컬 실행

프론트엔드:

```bash
cd apps/frontend
npm ci
npm run dev
```

백엔드:

```powershell
cd apps/backend
.\gradlew.bat bootRun
```

백엔드 상태 확인 주소:

```text
http://localhost:8080/api/health
```

## 문서

- [개발 요구사항](DEVELOPMENT_REQUIREMENTS.md)
- [배포 가이드](DEPLOYMENT.md)
- [프론트엔드 안내](apps/frontend/README.md)
