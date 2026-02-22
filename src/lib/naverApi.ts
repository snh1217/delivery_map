export const NAVER_MAPS_API_BASES = {
  directions5: "https://maps.apigw.ntruss.com/map-direction/v1",
  directions15: "https://maps.apigw.ntruss.com/map-direction-15/v1",
  geocoding: "https://maps.apigw.ntruss.com/map-geocode/v2",
  reverseGeocoding: "https://maps.apigw.ntruss.com/map-reversegeocode/v2",
} as const;

export function getNaverApiGatewayHeaders() {
  const keyId = process.env.NAVER_MAPS_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;
  const secret = process.env.NAVER_MAPS_CLIENT_SECRET;

  if (!keyId || !secret) {
    throw new Error("네이버 지도 API Gateway 키가 설정되지 않았습니다.");
  }

  return {
    "x-ncp-apigw-api-key-id": keyId,
    "x-ncp-apigw-api-key": secret,
  };
}

export async function fetchNaverApiJson(url: string) {
  const response = await fetch(url, {
    headers: getNaverApiGatewayHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `NAVER API 오류 (${response.status})`);
  }

  return response.json();
}
