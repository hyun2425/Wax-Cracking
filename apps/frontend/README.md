# 프론트엔드

온라인 왁스볼 크래킹의 프론트엔드 앱입니다.

## 사용 기술

- Next.js
- TypeScript
- TailwindCSS
- Nanum Gothic 폰트

## 실행 방법

처음 실행할 때는 의존성을 설치합니다.

```bash
npm ci
```

개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

백엔드 API 주소는 아래 환경 변수로 설정합니다.

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

로컬 개발용 예시는 `.env.example`에 있습니다. 실제 `.env.local` 파일은 Git에 올리지 않습니다.

## 주요 파일

```text
src/app/page.tsx      # 메인 페이지
src/app/layout.tsx    # 전체 레이아웃과 폰트 설정
src/app/globals.css   # 전역 스타일
vercel.json           # Vercel 배포 설정
```

## 검증 명령어

```bash
npm run lint
npm run build
```

작업 후에는 최소한 위 두 명령어를 실행해서 문제가 없는지 확인합니다.

## 배포

Vercel에서 이 앱을 배포할 때 Root Directory는 반드시 아래 값으로 설정합니다.

```text
apps/frontend
```

백엔드가 Render에 배포된 뒤에는 Vercel 환경 변수에 Render 주소를 넣습니다.

```text
NEXT_PUBLIC_API_BASE_URL=https://<render-service-name>.onrender.com
```
