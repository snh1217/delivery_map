// 앱 업데이트 내역(최신이 맨 위).
// 기능을 배포할 때 맨 위에 항목을 추가하면, 앱을 다시 켰을 때 사용자에게 업데이트 내역이 표시됩니다.
export type AppRelease = {
  version: string;
  date: string;
  title: string;
  notes: string[];
};

export const APP_RELEASES: AppRelease[] = [
  {
    version: "2026.10.26",
    date: "2026-10-26",
    title: "주소 자동 인식 · 새 디자인",
    notes: [
      "\"강남 논현동 / 서울 강남구 논현동 1-3 / 7층\"처럼 붙여넣으면 가운데 주소만 자동으로 검색합니다.",
      "층·호수 같은 상세 정보는 도착지 카드에 따로 표시됩니다.",
      "화면 디자인을 정리해 더 보기 쉽게 바꿨습니다.",
      "앱을 다시 켜면 새 버전을 자동으로 받아 적용하고 업데이트 내역을 보여줍니다.",
    ],
  },
];

export const CURRENT_RELEASE = APP_RELEASES[0];

export const APP_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || "dev";
