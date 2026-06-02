# 온라인 왁스볼 크래킹

온라인 왁스볼 크래킹은 왁스볼을 냉동하고 깨는 ASMR 콘텐츠를 웹에서 가볍게 즐길 수 있도록 만드는 프로젝트입니다.

프론트엔드는 `Next.js`, `TypeScript`, `TailwindCSS`로 만들고, 백엔드는 `Spring Boot`로 구성합니다. 현재 데이터베이스는 사용하지 않습니다.

## 프로젝트 구조

```text
Wax-Cracking/
├─ apps/
│  ├─ backend/     # Spring Boot 백엔드
│  └─ frontend/    # Next.js 프론트엔드
├─ render.yaml     # Render 백엔드 배포 설정
├─ DEPLOYMENT.md   # 배포 방법
└─ README.md       # 프로젝트 설명
```

## 주요 기능 방향

- 왁스볼 종류 선택
- 냉동 시간에 따른 단단함 변화
- 클릭으로 왁스볼 균열 및 파괴 진행
- 냉동 시간과 왁스볼 종류에 따른 ASMR 사운드 변화
- 프론트엔드와 백엔드 연결 상태 확인

## 왁스볼 예시

### 두바이 왁스볼

- 초콜릿빛 외피
- 금빛 라인 장식
- 묵직한 파열음

### 솜사탕 왁스볼

- 분홍, 하늘, 보라색 조합
- 부드럽고 가벼운 이미지
- 가벼운 바스락 소리

### 청사과 왁스볼

- 연두색 표면
- 산뜻하고 시원한 이미지
- 깨끗한 크랙 사운드

## 냉동 시간 규칙

게임 안에서는 사용자가 오래 기다리지 않도록 `1초 = 1분`처럼 동작시키는 것을 목표로 합니다.

| 냉동 시간 | 상태 |
| --- | --- |
| 0~5분 | 말랑 |
| 5~10분 | 보통 |
| 10~15분 | 단단 |
| 15~20분 | 매우 단단 |
| 20분 | 최고 경도 |

## 로컬 실행

### 프론트엔드

```bash
cd apps/frontend
npm ci
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 포트가 이미 사용 중이면 Next.js가 다른 포트를 안내합니다.

### 백엔드

```bash
cd apps/backend
./gradlew bootRun
```

Windows PowerShell에서는 아래처럼 실행합니다.

```powershell
cd apps/backend
.\gradlew.bat bootRun
```

백엔드 상태 확인 주소는 `http://localhost:8080/api/health`입니다.

## 환경 변수

프론트엔드는 백엔드 주소를 아래 환경 변수로 읽습니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

예시는 `apps/frontend/.env.example`에 있습니다.

## 협업 메모

- 작업 전 `git pull --ff-only origin main`으로 최신 상태를 맞춥니다.
- 프론트 작업은 `apps/frontend` 안에서 진행합니다.
- 백엔드 작업은 `apps/backend` 안에서 진행합니다.
- 배포 관련 내용은 `DEPLOYMENT.md`를 먼저 확인합니다.
- 현재는 데이터베이스를 사용하지 않으므로 DB 연결 설정을 추가하지 않습니다.
