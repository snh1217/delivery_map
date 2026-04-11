import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.snh.deliverymap",
  appName: "퀵배달 메이커",
  webDir: "public",
  server: {
    url: process.env.CAP_SERVER_URL || "https://deliverymap.vercel.app",
    cleartext: true,
    androidScheme: "https",
    allowNavigation: ["deliverymap.vercel.app"],
  },
};

export default config;
