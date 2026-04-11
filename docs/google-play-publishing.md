# Google Play 등록 준비 메모

## 현재 상태
- 패키지명: `com.snh.deliverymap`
- 앱 이름: `퀵·배달 구역메이커`
- signed release APK 생성 가능
- signed release AAB 생성 가능

## Play Console 등록 순서
1. Google Play Console 개발자 계정 생성/본인 확인
2. 새 앱 생성
3. 앱 이름/기본 언어/카테고리 설정
4. 연락처 정보, 개인정보처리방침 URL 입력
5. 데이터 보안(Data safety) 작성
6. 내부 테스트(Internal testing) 트랙 생성
7. `app-release.aab` 업로드
8. 내부 테스터 초대 후 실제 기기 검증
9. 문제 없으면 프로덕션 출시

## 현재 바로 사용할 산출물
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Play 링크 연결 방법
Play Store 등록이 완료되면 스토어 URL을 아래 환경변수에 넣습니다.

```bash
NEXT_PUBLIC_ANDROID_PLAY_URL=https://play.google.com/store/apps/details?id=com.snh.deliverymap
```

등록 후 `/install/android` 페이지에 Google Play 설치 버튼이 자동으로 표시됩니다.

## 권장 스토어 설명 초안
### 앱 이름
- 퀵·배달 구역메이커

### 짧은 설명
- 퀵/배달 경로, 동 리스트, 길찾기와 운임 계산을 한 번에

### 긴 설명
- 퀵·배달 구역메이커는 퀵서비스와 배달 업무를 위한 실무형 경로 보조 앱입니다.
- 현재 위치를 기준으로 여러 도착지를 입력하고, 추천 방문 순서와 구역(동 리스트)을 빠르게 확인할 수 있습니다.
- 네이버 지도, 카카오 지도, 카카오내비 길찾기를 지원하며 운임 계산과 일일 통계도 함께 관리할 수 있습니다.
- 주요 기능:
  - 현재 위치 기준 출발지 자동 인식
  - 다중 도착지 입력과 추천 방문 순서
  - 팬(부채꼴) 권역 기반 동 리스트 생성
  - 네이버/카카오/카카오내비 길찾기
  - 운임 계산기와 일일 통계
  - 관리자 승인 기반 접근 관리

## 스크린샷 추천
- 메인 홈 화면
- 도착지 입력 + 추천 방문 순서
- 지도 + 팬 오버레이
- 운임 계산기
- 개발요청/관리자/OCR 기능은 내부 관리 기능이므로 일반 스토어 스크린샷에서는 제외 권장
