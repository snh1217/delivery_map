import nodemailer from "nodemailer";

type SignupRequestNotificationParams = {
  phone: string;
  name: string;
  createdAt?: string;
};

type DevelopmentRequestNotificationParams = {
  phone: string;
  title: string;
  body: string;
  createdAt?: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const to = process.env.ADMIN_NOTIFY_EMAIL;

  if (!host || !portRaw || !from || !to) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    return null;
  }

  const secure =
    String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true" ||
    (process.env.SMTP_SECURE === undefined && port === 465);

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    from,
    to,
  };
}

export function isAdminSignupNotificationEnabled() {
  return Boolean(getSmtpConfig());
}

export async function notifyAdminSignupRequest(params: SignupRequestNotificationParams) {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false as const, reason: "smtp_not_configured" as const };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  const subject = `[delivery_map] 가입 승인 요청 - ${params.name} (${params.phone})`;
  const createdAt = params.createdAt ? new Date(params.createdAt).toLocaleString("ko-KR") : new Date().toLocaleString("ko-KR");
  const text = [
    "새 회원가입 승인 요청이 도착했습니다.",
    "",
    `이름: ${params.name}`,
    `전화번호: ${params.phone}`,
    `요청시각: ${createdAt}`,
    "",
    "관리자 페이지에서 승인/반려를 처리하세요.",
    "/admin",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,'Malgun Gothic',sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px 0;font-size:18px">새 회원가입 승인 요청</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 8px 4px 0;color:#475569">이름</td><td style="padding:4px 0">${params.name}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;color:#475569">전화번호</td><td style="padding:4px 0">${params.phone}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;color:#475569">요청시각</td><td style="padding:4px 0">${createdAt}</td></tr>
      </table>
      <p style="margin-top:12px">관리자 페이지에서 승인/반려를 처리하세요.</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    subject,
    text,
    html,
  });

  return { sent: true as const };
}

export async function notifyAdminDevelopmentRequest(params: DevelopmentRequestNotificationParams) {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false as const, reason: "smtp_not_configured" as const };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  const createdAt = params.createdAt ? new Date(params.createdAt).toLocaleString("ko-KR") : new Date().toLocaleString("ko-KR");
  const subject = `[delivery_map] 개발요청 - ${params.title}`;
  const text = [
    "새 개발요청이 등록되었습니다.",
    "",
    `전화번호: ${params.phone}`,
    `제목: ${params.title}`,
    `등록시각: ${createdAt}`,
    "",
    params.body,
    "",
    "관리자 페이지에서 상태를 관리하세요.",
    "/admin",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,'Malgun Gothic',sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px 0;font-size:18px">새 개발요청이 등록되었습니다.</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 8px 4px 0;color:#475569">전화번호</td><td style="padding:4px 0">${params.phone}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;color:#475569">제목</td><td style="padding:4px 0">${params.title}</td></tr>
        <tr><td style="padding:4px 8px 4px 0;color:#475569">등록시각</td><td style="padding:4px 0">${createdAt}</td></tr>
      </table>
      <div style="margin-top:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap">${params.body}</div>
      <p style="margin-top:12px">관리자 페이지에서 상태를 관리하세요.</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    subject,
    text,
    html,
  });

  return { sent: true as const };
}
