# delivery_map

퀵서비스 구설정(동 단위) 자동 생성 웹앱입니다.

## 실행

```bash
npm install
npm run dev
```

품질 확인:

```bash
npm run lint
npm run typecheck
npm run build
```

## 주요 기능

- 회원가입 요청(이름+전화번호) -> 관리자 승인 -> 전화번호 로그인
- allowlist 기반 접근 제어 (`is_active=true` 사용자만 허용)
- ADMIN_PHONE 관리자 기능 (회원가입 요청 승인/반려, allowlist 추가/활성 토글, 로그 조회)
- 출발지: 내 위치 GPS (권한 거부 시 서울시청 fallback)
- 도착지 다중 입력 + 지오코딩 Top5 후보 선택
- 팬(부채꼴) 권역 계산 + 동(short2) 자동 생성
- 네이버 지도 마커/팬 오버레이
- 네이버 지도 앱 길찾기(자동차) + 모바일 웹 fallback + 스토어 안내
- 카카오맵 길찾기/웹 링크 연동 준비 (도착지 행에서 선택 가능)

## 네이버 API 프록시(추가 구현)

- `GET /api/geocode?query=...`
- `GET /api/reverse-geocode?lat=...&lon=...`
- `GET /api/directions5?startLat=...&startLon=...&goalLat=...&goalLon=...`
- `GET /api/directions15?startLat=...&startLon=...&goalLat=...&goalLon=...`

서버 프록시에서 Naver API Gateway 키를 사용하므로 클라이언트에 secret이 노출되지 않습니다.

## 환경변수

`.env.local.example`를 참고해 `.env.local`을 설정하세요.

핵심 키:

- `AUTH_PROVIDER` (현재 로그인 흐름에서는 사용 안 함, 기존 OTP 백업 구조 호환용)
- `ADMIN_PHONE`
- `NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID`
- `NAVER_MAPS_CLIENT_ID`
- `NAVER_MAPS_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Firebase fallback 사용 시 Firebase Client/Admin 환경변수를 추가합니다.

카카오 연동(선택):

- 현재 버전은 `카카오맵 링크 방식`(딥링크 + 웹 fallback) 준비가 포함되어 있습니다.
- `카카오내비 SDK`로 확장하려면 `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` 등록 후 SDK 로더/호출만 추가하면 됩니다.

## Supabase 스키마

```sql
create table if not exists public.allowlist (
  phone text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.signup_requests (
  phone text primary key,
  name text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by text null
);

create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  user_agent text null
);
```

## 배포

### GitHub

```bash
git init
git add .
git commit -m "feat: production-ready quickservice zone app"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

### Vercel

1. Vercel에서 GitHub 저장소 import
2. Environment Variables 등록
3. 배포
4. 네이버 콘솔 Web 서비스 URL에 프로덕션 도메인 등록

## 네이버 콘솔 설정

- Dynamic Map: 필수
- Geocoding: 필수
- Reverse Geocoding: 권장

## 카카오 연동 준비 메모 (선택)

- 현재 앱은 네이버 지도가 기본이며, 도착지 행에서 카카오맵 길찾기 버튼을 함께 제공합니다.
- 카카오내비는 추후 Kakao JavaScript SDK 기반 호출로 확장 가능하도록 `src/lib/kakaoDeepLink.ts`를 추가했습니다.
