import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.snh.deliveryextractor",
  appName: "구역 추출기",
  webDir: "public",
  server: {
    url: process.env.CAP_EXTRACTOR_SERVER_URL || "https://deliverymap.vercel.app/extractor",
    cleartext: true,
    androidScheme: "https",
    allowNavigation: ["deliverymap.vercel.app"],
  },
};

export default config;
