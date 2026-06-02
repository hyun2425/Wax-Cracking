# 배포 가이드

이 프로젝트는 프론트엔드와 백엔드를 각각 다른 서비스에 배포합니다.

- 프론트엔드: Vercel
- 백엔드: Render
- 데이터베이스: 현재 사용하지 않음

## 1. 배포 전 확인

배포 전에 변경 사항을 GitHub에 올려야 합니다.

```bash
git add .
git commit -m "작업 내용 요약"
git push origin main
```

## 2. 백엔드 배포: Render

Render에서는 저장소 루트의 `render.yaml`을 읽어 백엔드를 배포합니다.

### Render 설정

Render Dashboard에서 다음 순서로 진행합니다.

1. `New +`를 누릅니다.
2. `Blueprint`를 선택합니다.
3. GitHub 저장소 `Wax-Cracking`을 선택합니다.
4. `Blueprint Path`에는 `render.yaml`을 입력합니다. 비워도 기본값으로 인식되지만, 직접 입력하는 편이 안전합니다.
5. 생성될 서비스 정보를 확인하고 배포합니다.

### 백엔드 서비스 정보

- 서비스 이름: `wax-cracking-backend`
- Runtime: Docker
- Root Directory: `apps/backend`
- Dockerfile Path: `Dockerfile`
- Docker Context: `.`
- Health Check Path: `/api/health`

배포가 완료되면 아래 주소가 열리는지 확인합니다.

```text
https://<render-service-name>.onrender.com/api/health
```

정상 응답 예시:

```json
{
  "status": "ok",
  "service": "wax-cracking-backend",
  "database": "disabled"
}
```

## 3. 프론트엔드 배포: Vercel

Vercel에서는 이 저장소를 연결하되, 프로젝트 루트 디렉터리를 프론트엔드 폴더로 지정해야 합니다.

### Vercel 설정

1. Vercel Dashboard에서 `Add New`를 누릅니다.
2. `Project`를 선택합니다.
3. GitHub 저장소 `Wax-Cracking`을 선택합니다.
4. `Root Directory`를 `apps/frontend`로 설정합니다.
5. Framework Preset은 `Next.js`로 둡니다.
6. 환경 변수를 추가합니다.

```text
NEXT_PUBLIC_API_BASE_URL=https://<render-service-name>.onrender.com
```

7. Deploy를 실행합니다.

## 4. CORS 설정

프론트엔드가 Vercel에 배포된 뒤에는 Render 환경 변수에서 허용 도메인을 확인합니다.

Render 서비스의 Environment 메뉴에서 아래 값을 설정합니다.

```text
FRONTEND_ORIGIN_PATTERNS=https://<vercel-project>.vercel.app,https://*.vercel.app
```

개발 중에는 로컬 주소도 함께 허용할 수 있습니다.

```text
http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
```

## 5. 배포 후 확인 순서

1. Render 백엔드 `/api/health`가 `200`으로 응답하는지 확인합니다.
2. Vercel 프론트엔드 페이지가 열리는지 확인합니다.
3. 프론트엔드 하단의 서비스 연결 상태에서 백엔드가 연결되는지 확인합니다.

## 자주 나는 실수

- Vercel의 Root Directory를 저장소 루트로 두면 프론트엔드 빌드를 찾지 못할 수 있습니다.
- Render의 Blueprint Path는 `render.yaml`입니다.
- 백엔드 URL을 Vercel 환경 변수에 넣은 뒤에는 Vercel을 다시 배포해야 값이 반영됩니다.
- 현재는 DB를 쓰지 않으므로 Render Database를 만들 필요가 없습니다.
