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

## PWA / APK(스토어 없이 설치)

현재 프로젝트는 **무료 운영 기준**으로 아래 방식을 권장합니다.

- Android: `Capacitor`로 APK 생성 후 직접 설치
- iPhone/iPad: PWA(`홈 화면에 추가`)
- 앱 런타임에서는 웹과 네이티브 환경을 분리해서 동작합니다.
  - 웹/PWA: 서비스워커 등록 및 최신화 체크
  - Capacitor 앱: 서비스워커를 등록하지 않고 최신 원격 화면을 직접 사용

### PWA 사용

- 앱은 `manifest.webmanifest`와 서비스워커(`public/sw.js`)가 포함되어 있습니다.
- 모바일 브라우저에서 `https://deliverymap.vercel.app` 접속 후 홈 화면에 추가하면 앱처럼 실행할 수 있습니다.
- iPhone/iPad는 앱스토어 없이 설치 가능한 현실적인 방식이 PWA입니다.

### Android APK 생성

Capacitor 초기 세팅이 포함되어 있습니다.

```bash
npm install
npm run cap:add:android   # 최초 1회
npm run cap:assets:android
npm run cap:sync
npm run cap:open:android
```

- Capacitor 설정 파일: `capacitor.config.ts`
- 기본 연결 주소: `https://deliverymap.vercel.app`
- Android Studio에서 `Build > Build Bundle(s) / APK(s) > Build APK(s)`로 디버그 APK를 만들 수 있습니다.
- APK는 플레이스토어 등록 없이 직접 전달/설치 가능합니다.
- 설치 시 안드로이드에서 `알 수 없는 앱 설치 허용`이 필요할 수 있습니다.

자동화 스크립트:

```bash
npm run android:apk:debug
npm run android:apk:release
npm run android:aab:release
npm run android:install:debug
```

- `android:apk:debug`: 디버그 APK 생성
- `android:apk:release`: 릴리즈 APK 생성(서명이 연결되어 있으면 signed, 아니면 unsigned)
- `android:aab:release`: 릴리즈 AAB 생성(서명이 연결되어 있으면 signed, 아니면 unsigned)
- `android:install:debug`: USB 연결된 안드로이드 기기에 디버그 APK 설치

APK 위치 예시:

- 디버그: `android/app/build/outputs/apk/debug/app-debug.apk`
- 릴리즈: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### Android 릴리즈 서명 연결

`android/app/build.gradle`은 아래 환경변수가 있으면 릴리즈 서명을 자동으로 연결합니다.

```bash
RELEASE_STORE_FILE=D:\Android\keystore\delivery-map-release.jks
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_ALIAS=delivery-map
RELEASE_KEY_PASSWORD=...
```

- 예시 파일: `android/release-signing.env.example`
- 값이 없으면 릴리즈 빌드는 unsigned APK/AAB로 생성됩니다.

### Capacitor 네이티브 플러그인 연결

현재 연결된 플러그인:

- `@capacitor/geolocation`
  - 앱 환경에서는 브라우저 geolocation 대신 네이티브 위치 추적 사용
  - 출발지 자동 동기화, watchPosition에 연결
- `@capacitor/camera`
  - OCR 스크린샷/사진 첨부 버튼이 앱에서는 카메라/앨범 prompt로 동작
- `@capacitor/share`
  - 결과 공유 버튼이 앱에서는 네이티브 공유 시트 사용
- `@capacitor/app`
  - 외부 내비 앱 복귀 시 `resume` 이벤트로 레이아웃 복구 보강
- 앱 부트스트랩
  - `NativeAppBootstrap`가 실행 환경(`web` / `pwa` / `native`)을 감지해 CSS 클래스와 safe-area 동작을 맞춥니다.
  - 네이티브 앱 안에서는 서비스워커를 자동 해제해 오래된 정적 캐시가 남지 않게 처리합니다.

아이콘/스플래시 리소스:

- 소스 파일: `resources/icon.png`, `resources/splash.png`
- Android 리소스 재생성:

```bash
npm run cap:assets:android
npm run cap:sync
```

### 참고

- APK는 Android 전용입니다.
- iPhone은 APK 설치가 불가능하므로 PWA를 사용해야 합니다.
- 스토어 배포를 하지 않아도 내부 배포/개인 사용은 가능합니다.

### iPhone PWA 설치/복귀 점검

- iPhone에서는 홈 화면에 추가한 PWA가 가장 안정적입니다.
- 앱 상단에 `홈 화면에 추가` 안내 카드가 보이면:
  - Safari/Chrome 공유 버튼
  - `홈 화면에 추가`
  순서로 설치할 수 있습니다.
- 외부 길찾기 앱으로 나갔다가 돌아온 뒤에는:
  - 최근 목적지 되돌리기
  - 도착지 목록 상태
  - 지도 레이아웃
  이 최신 상태로 유지되는지 같이 점검하세요.

## 주요 기능

- 회원가입 요청(이름+전화번호) -> 관리자 승인 -> 전화번호 로그인
- allowlist 기반 접근 제어 (`is_active=true` 사용자만 허용)
- ADMIN_PHONE 관리자 기능 (회원가입 요청 승인/반려, allowlist 추가/활성 토글, 로그 조회)
- 출발지: 내 위치 GPS (권한 거부 시 서울시청 fallback)
- 도착지 다중 입력 + 순서 직접 변경 + 지오코딩 Top5 후보 선택
- 팬(부채꼴) 권역 계산 + 동(short2) 자동 생성
- 전국 행정동 centroid(3558건) 기반 동 리스트 계산
- 네이버 지도 마커/팬 오버레이
- 네이버 지도 앱 길찾기(자동차) + 모바일 웹 fallback + 스토어 안내
- 카카오맵 길찾기/웹 링크 연동 + 카카오내비 앱 호출(설정에서 선택, JS SDK 기반 점검 포함)
- 관리자 전용 스크린샷 OCR 주소 추출(도착지 추가/도착지별 사진 OCR 적용)
- 우측 FAB 기반 일일 운임 계산기 (내 운임/제3자 대상 저장·불러오기)
- 운임 계산기 라인별 `매출 입력` 옵션 (매출금액/실운임 23% 공제 환산)
- 일반 사용자 내정보 운임 통계 (오늘 요약 + 기간별 조회)
- 관리자 운임 통계 (기간 총합 / 사용자별 / 사용자 drill-down)
- 개발요청 게시판 (사용자 등록 + 관리자 상태 관리)
- 콜 시간 계산 탭 (실제 내비 기준 최장 구간 * 250% + 픽업 20분)
- 개발요청 등록 시 관리자 메일 알림(선택, SMTP 설정 시)
- 콜 시간 계산 결과 저장/최근 이력 복원
- 추천 방문 순서 drag-and-drop 지원
- 길찾기 실행 후 동 리스트/방문 순서 스냅샷 저장(사용자별 일일 이력)
- 관리자 화면에서 오늘 총 사용량/사용자별 실행 건수 확인

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
- `ADMIN_NOTIFY_EMAIL` (선택, 가입 요청 알림 메일 수신자)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (선택, 메일 발송용)

Firebase fallback 사용 시 Firebase Client/Admin 환경변수를 추가합니다.

가입 승인 요청 메일 알림(선택):

- 가입 요청 생성 시 서버에서 관리자 메일로 알림을 보냅니다.
- 아래 값이 모두 설정되면 활성화됩니다.
  - `ADMIN_NOTIFY_EMAIL`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_FROM`
  - (인증 필요 SMTP인 경우) `SMTP_USER`, `SMTP_PASS`
- `SMTP_SECURE=true` 권장 (포트 465 사용 시)

카카오 연동(선택):

- `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` (또는 `NEXT_PUBLIC_KAKAO_JS_KEY`)가 있으면 카카오내비 SDK 상태를 점검할 수 있습니다.
- 카카오내비를 길찾기 기본 앱으로 쓰려면 카카오 개발자 콘솔에서 **Web 도메인 등록**이 필요합니다.
  - 개발: `http://localhost:3000`
  - 운영: `https://deliverymap.vercel.app` (또는 실제 운영 도메인)
- 카카오 API 확장 대비 환경변수(선택): `KAKAO_REST_API_KEY`, `KAKAO_NATIVE_APP_KEY`, `KAKAO_ADMIN_KEY`

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

create table if not exists public.route_runs (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  provider text not null,
  batch_label text null,
  destination_count integer not null default 0,
  final_short_list text[] null,
  final_short_list_text text null,
  route_stops jsonb not null default '[]'::jsonb
);

create table if not exists public.earning_targets (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  target_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_phone, target_name)
);

create table if not exists public.daily_earnings (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  target_id uuid null,
  target_name text not null,
  ymd text not null,
  items jsonb not null,
  total_amount integer not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_phone, ymd, target_name)
);

create table if not exists public.development_requests (
  id uuid primary key default gen_random_uuid(),
  owner_phone text not null,
  title text not null,
  body text not null,
  status text not null default 'pending',
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by text null
);

create table if not exists public.call_time_estimates (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now(),
  call_time text not null,
  deadline_label text not null,
  longest_leg_min integer not null default 0,
  adjusted_drive_min integer not null default 0,
  pickup_min integer not null default 20,
  total_required_min integer not null default 0,
  reference_leg text not null,
  route_legs jsonb not null default '[]'::jsonb
);
```

## 전국 동 데이터(실사용 규모)

- 기본 데이터 파일: `src/data/dong_centroids.json` (전국 행정동 centroid 3558건)
- 생성 스크립트: `npm run data:generate-dong-centroids`
- 원본 경계 소스: `vuski/admdongkor` (행정동 경계 GeoJSON)
- 앱 런타임에서는 centroid만 로드하므로 경계 GeoJSON 직접 로드보다 훨씬 가볍습니다.

## 사용자별 일일 이력 / 결과 보존

- 전체 길찾기/분할 길찾기 실행 시 현재 `동 리스트 + 방문 순서` 스냅샷을 서버(`route_runs`)에 저장합니다.
- 도착지가 화면에서 자동 제거되어도 사용자 정보 패널과 결과 하단 카드에서 최근 저장된 동 리스트를 다시 확인할 수 있습니다.
- 관리자 화면에는 오늘(KST) 기준 총 실행 건수/사용자 수/사용자별 실행 건수가 표시됩니다.
- 팬/동 리스트 계산은 현재 추천 방문 순서(수동 수정 포함)를 기준으로 다시 계산됩니다.
- 최종 동 리스트는 동의 앞 2글자 기준으로 표시하며, `중1/중2`처럼 읽기 어려운 일부 숫자형 약어는 화면에서만 예외 보정합니다.

## 추천 방문 순서 / 도착지 순서

- 도착지 목록 카드에서 `↑ / ↓` 버튼으로 입력 순서를 직접 바꿀 수 있습니다.
- 결과 카드의 `추천 방문 순서`에서도 `↑ / ↓` 버튼으로 추천 순서를 수동 수정할 수 있습니다.
- 추천 순서를 바꾸면:
  - 팬(부채꼴) 계산 순서
  - 최종 동 리스트
  - 전체 길찾기/분할 길찾기 순서
  - 길찾기 저장 이력
  에 모두 반영됩니다.
- 추천 방문 순서 카드에서는 드래그 앤 드롭으로도 순서를 바꿀 수 있습니다.

## 콜 시간 계산

- 각 도착지 row 안에서 사용합니다. (`도착지 1개 = 콜 1개`)
- 기본은 접힘형 카드이며, 필요할 때만 `열기`로 펼쳐 계산합니다.
- 입력값:
  - 출발지 주소
  - 콜 잡은 시간
- 계산 방식:
  - `출발지 -> 해당 도착지` 실제 내비 시간 조회
  - `실제 내비시간 150% + 픽업 20분`
  - 결과를 `몇 시까지 들어가면 되는지`로 표시
- 계산 결과는 사용자별 최근 이력으로 저장됩니다.

## 개발요청 게시판

- 결과 패널의 `개발 요청` 탭에서 사용자 요청을 등록할 수 있습니다.
- 관리자 패널에서는 전체 요청 목록과 상태(`pending/reviewing/done`) 및 관리자 메모를 관리할 수 있습니다.
- SMTP가 설정되어 있으면 개발요청 등록 시 관리자 메일 알림도 발송됩니다.

## 운임 계산기(제3자 포함) 사용법

- 화면 우측의 계산기 FAB를 눌러 `운임 계산기` 모달을 엽니다.
- 대상 선택:
  - `내 운임` (기본)
  - 제3자 대상(별칭) 선택
  - `+ 대상 추가`로 별칭 등록 가능
- 운임 항목:
  - 금액(실운임/순익) 입력(숫자)
  - 라인별 `매출 입력` 체크 가능
  - 체크 시 입력값을 매출금액으로 보고 실운임을 23% 공제해 계산
  - 체크하지 않으면 입력값을 실운임으로 보고 매출금액을 역산
  - `+ 운임 추가`로 라인 추가
  - 합계는 자동 계산되며 **실운임 기준**입니다.
- 합계/저장/통계는 모두 실수령(net) 기준이며, 매출금액은 23% 공제 기준으로 화면에서 별도 계산됩니다.
- `오늘 운임 불러오기`:
  - 현재 선택 대상 기준 오늘(KST) 저장값 조회
  - 현재 입력값이 있으면 `합치기 / 덮어쓰기` 선택
- `저장`:
  - 오늘(KST) 기준으로 upsert 저장
- `닫기`:
  - 저장 없이 모달 종료
  - 임시 입력값은 초기화됩니다.

테스트 체크:
- 내 운임 저장/불러오기
- 제3자 대상 추가 후 저장/불러오기
- 불러오기 시 합치기/덮어쓰기 동작
- 매출 입력 체크 저장/불러오기 및 실수령 합계 일치
- 닫기 = 초기화(저장 안 됨)
- 로그인 사용자별 데이터 분리
- KST 날짜 기준 저장/조회 확인

## 내정보 운임 통계 / 관리자 운임 통계

- 내정보/운임 통계 모달
  - 우측 `운임 통계` FAB 또는 로그인 정보 내 버튼으로 모달 오픈
  - `오늘 운임 요약` 카드: 전체/내 운임/제3자 합계
  - `오늘 상세 보기`: 대상별 breakdown
  - `기간 통계`: 오늘/어제/최근7일/이번달 + 날짜 범위 + 대상 필터
- 관리자 패널
  - `운임 통계` 섹션: 기간 총합, 사용자별 합계 TOP, 사용자별 상세(일자/대상별)
- 관련 API
  - `GET /api/earnings/range?from=YYYY-MM-DD&to=YYYY-MM-DD&target=all|me|<target_name>`
  - `GET /api/admin/earnings/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/admin/earnings/user?phone=...&from=YYYY-MM-DD&to=YYYY-MM-DD`

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

## Android APK / AAB 빌드

### 1) 서명 키 초기화(최초 1회)

```bash
npm run android:signing:init
```

- 서명 키 파일: `D:\Android\keystore\delivery-map-release.jks`
- 로컬 서명 설정 파일: `android/release-signing.env.local`
- 둘 다 업데이트에 꼭 필요하므로 별도로 백업하세요.

### 2) 디버그 APK

```bash
npm run android:apk:debug
```

- 출력: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3) 서명된 릴리즈 APK

```bash
npm run android:apk:release:signed
```

- 출력: `android/app/build/outputs/apk/release/`

### 4) 서명된 AAB (Play Store 업로드용)

```bash
npm run android:aab:release:signed
```

- 출력: `android/app/build/outputs/bundle/release/`

### 5) USB 연결 기기에 디버그 설치

```bash
npm run android:install:debug
```

- 안드로이드 폰에서 `개발자 옵션 > USB 디버깅`을 켜야 합니다.
- 기기가 연결되지 않으면 `No connected devices!`가 표시됩니다.

## APK 링크 설치(스토어 없이 배포)

- 안드로이드에서는 APK 파일 링크만 있어도 직접 설치할 수 있습니다.
- 프로젝트에는 설치 안내 페이지를 추가했습니다:
  - `/install/android`
- 공개 다운로드 링크를 붙이려면 Vercel 환경변수에 아래 값을 넣으세요.

```bash
NEXT_PUBLIC_ANDROID_APK_URL=https://<공개-다운로드-링크>/app-release.apk
```

- Play Store 링크가 생기면 아래 값도 같이 넣으세요.

```bash
NEXT_PUBLIC_ANDROID_PLAY_URL=https://play.google.com/store/apps/details?id=com.snh.deliverymap
```

- 가장 쉬운 무료 방식:
  - GitHub Releases asset 링크 사용
  - 또는 다른 정적 파일 링크 사용
- iPhone은 APK 설치가 불가능하므로 `홈 화면에 추가(PWA)` 방식을 사용합니다.
- 설치 페이지(`/install/android`)는 APK 링크와 Play 링크가 있으면 자동으로 둘 다 노출합니다.

## Google Play Store 등록 경로

- 정식 배포는 APK보다 **AAB(App Bundle)** 업로드가 권장됩니다.
- 현재 프로젝트는 `npm run android:aab:release:signed`로 AAB 준비가 가능합니다.
- 추천 순서:
  1. Google Play Console에서 앱 생성
  2. 내부 테스트(Internal testing) 트랙 먼저 업로드
  3. 기기 테스트
  4. 프로덕션 출시

참고:
- 내부 테스트/비공개 테스트로 먼저 검증한 뒤 정식 배포하는 흐름이 가장 안전합니다.
- 스토어 등록은 Google Play Console 개발자 계정이 필요합니다.
- 상세 체크리스트/설명 문구는 `docs/google-play-publishing.md`를 참고하세요.

## 네이버 콘솔 설정

- Dynamic Map: 필수
- Geocoding: 필수
- Reverse Geocoding: 권장

## 카카오내비 사용법 / 점검

- 설정 > `기본 길찾기 앱`에서 `카카오내비`를 선택할 수 있습니다.
- 일반 사용자 `설정` 화면에서는 카카오내비 상태를 `사용 가능 / 사용 불가`로만 표시합니다.
- 카카오내비 진단 상세(키 설정 여부, SDK 로드, `Kakao.Navi` API, 도메인 체크리스트)는 **관리자 패널의 `카카오내비 진단` 섹션에서 확인**합니다.
- 카카오내비는 모바일 앱 호출 중심입니다.
  - 앱 미설치/실행 실패 시 설치 안내(도움말/스토어) 모달을 표시합니다.
- 카카오내비 자동 분할 정책은 현재 카카오맵과 동일하게 보수적으로 `최대 2개 도착지` 기준입니다.

## 음성인식(도착지 입력) 사용 팁 / 지원 브라우저

- 기본 UX: `음성입력` 버튼 1회 탭 → 말하기 → 침묵 감지 자동 종료 → 자동 검색/적용
- 한국어 인식(`ko-KR`) + interim/final 분리 처리:
  - 중간 결과(interim)는 화면 미리보기로만 표시
  - 최종 결과(final)만 입력창에 반영
- 침묵 감지 타임아웃(기본 900ms)으로 말끝 자동 종료
- 신뢰도(confidence)가 낮은 경우 자동 검색 대신 확인 안내 후 수동 검색 권장
- 지원 브라우저:
  - Android Chrome / Edge 권장
  - 일부 iOS Safari 환경에서는 동작이 제한되거나 품질 차이가 있을 수 있음
- 마이크 권한이 거부되면 브라우저 권한 설정에서 허용 후 다시 시도하세요.

## 스크린샷 OCR 주소 인식 사용법 (관리자 전용)

### 1) AdminPanel에서 스크린샷으로 도착지 추가
- `/admin` 관리자 패널의 `스크린샷 OCR로 도착지 추가` 카드에서 스크린샷을 선택/촬영합니다.
- 하단 크롭 비율(기본 42%)과 threshold 옵션을 조정한 뒤 `OCR 시작`을 누릅니다.
- 추출된 주소를 확인/수정 후 `적용하여 도착지 추가`를 누르면 `/app`으로 이동하며:
  - 새 도착지 Row가 추가되고
  - 주소가 입력되며
  - 자동 지오코딩이 실행됩니다.

### 2) 도착지별 사진 첨부 + OCR 적용
- 각 도착지 Row에서 `사진` 버튼으로 사진 1장을 첨부할 수 있습니다.
- 관리자 계정이면 `OCR로 주소 채우기` 버튼이 표시됩니다.
- OCR 결과 주소를 편집 후 `이 Row에 적용`을 누르면:
  - 해당 도착지 입력값이 덮어써지고
  - 자동 지오코딩이 실행됩니다.

### 정확도 팁
- 전체 화면 OCR이 아니라 하단 영역만 OCR 하므로, **주소 박스가 선명하게 보이는 스크린샷**이 유리합니다.
- 화면 확대 상태에서 캡처하면 인식률이 좋아질 수 있습니다.
- 주소가 2줄로 나뉘는 경우 OCR 결과 편집 후 적용하세요.
- 하단 크롭 비율(30%~55%)과 threshold 옵션을 바꿔 재시도하면 개선되는 경우가 많습니다.

### 개인정보/보안
- 기본 OCR은 `tesseract.js` 기반 **클라이언트 OCR**입니다. 이미지를 서버에 업로드/저장하지 않습니다.
- OCR 결과 텍스트에서는 전화번호 패턴을 마스킹하여 표시합니다.
- 서버 OCR 옵션(`/api/ocr`)은 관리자 전용이며, 기본값(`OCR_PROVIDER=tesseract`)에서는 비활성입니다.

## 구역 추출기 / A폰 → B폰 주소 전달
- `/extractor`는 OCR 전용 보조 화면입니다.
- A폰에서는 스크린샷을 넣고 주소를 추출한 뒤 다음 두 방식 중 하나로 사용할 수 있습니다.
  - 삼성 클립보드 방식: `복사` 후 같은 삼성 계정/클립보드 동기화로 B폰에서 붙여넣기
  - 전송함 방식: `B폰으로 보내기` 후, B폰 메인 앱 도착지 목록 상단의 `받은 주소` 카드에서 바로 도착지로 추가
- 접근성 기반 자동 추출 MVP 추가:
  - extractor Android 앱에서 접근성 서비스를 켜면
  - 대상 앱의 `길안내 / 길찾기 / 카카오내비 / 카카오맵 / 네이버지도` 클릭 시점을 감지하고
  - 클릭 시점 주변의 주소 후보를 추출해 extractor 화면으로 자동 전달합니다.
- extractor 앱으로 돌아오지 못하면 `/extractor` 웹 화면으로 fallback 연결을 시도합니다.
- extractor 화면에서는 자동 전송이 켜져 있으면 같은 계정의 B폰 메인 앱으로 바로 전송하고, 꺼져 있으면 사용자가 확인 후 직접 전송할 수 있습니다.
- B폰 메인 앱은 받은 주소를 자동으로 도착지에만 반영하며, 길안내는 자동 실행하지 않습니다. 사용자가 전체 길찾기 또는 개별 길찾기를 직접 선택하는 흐름입니다.
- 설치형 Android 앱에서는 추출기 화면 안에서 `권한 허용 -> 떠있는 버튼 시작`으로 오버레이 버튼을 켤 수 있습니다.
- 이후 퀵 프로그램 화면 위의 `OCR` 버튼을 누르면 현재 화면을 캡처하고, 추출기 화면으로 돌아와 원하는 구역만 선택해 OCR할 수 있습니다.
- 기본 OCR은 클라이언트에서 실행되며, 이미지는 서버에 저장하지 않습니다.
- 별도 Android 포장을 위한 설정 파일은 `capacitor.extractor.config.ts`에 준비되어 있습니다.
- 안내 페이지: `/install/extractor-android`
- 공개 APK 릴리스: `https://github.com/snh1217/delivery_map/releases/tag/extractor-android-v2026.04.20.4`
- 별도 Android 프로젝트 폴더: `android-extractor`
- 웹(`/extractor`)은 다른 앱의 길안내 버튼 클릭을 감지할 수 없으므로, 길안내 클릭 자동 추출은 Android 구역 추출기 앱의 권한 설정 도우미로 오버레이/접근성/알림 권한을 사용자가 직접 허용한 경우에만 동작합니다.
- Play Protect 또는 Android 13+에서 접근성이 막히면 구역 추출기 앱 정보 화면의 `제한된 설정 허용`을 먼저 켠 뒤 접근성 권한을 다시 허용합니다. 기존 OCR 캡처 방식은 fallback으로 유지됩니다.
- 인성 프로그램 패키지명이 기본 규칙과 다르면 구역 추출기 앱의 `대상 앱 설정`에서 최근 감지 앱을 대상 앱으로 등록할 수 있습니다. 카카오맵/카카오내비/네이버지도는 길안내 전환 후속 추적 대상으로 기본 포함됩니다.
- 빌드 스크립트:
  - `npm run cap:sync:extractor`
  - `npm run android:extractor:apk:debug`
  - `npm run android:extractor:apk:release:signed`
  - `npm run android:extractor:aab:release:signed`
  - 오버레이 버튼은 위치를 기억하며, 길게 누르면 바로 종료할 수 있습니다.

## 네이티브 앱 안정화 메모
- 설치형 앱에서는 앱 권한 상태(위치/카메라/마이크)를 로그인 정보 영역에서 다시 요청할 수 있습니다.
- 외부 길찾기 앱에서 복귀할 때는 최신 UI 스냅샷을 세션에 저장/복원하여 이전 상태로 돌아가는 문제를 줄였습니다.

