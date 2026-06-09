import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PHOTO_DIR = join(ROOT, "data", "photos");
const PORT = Number(process.env.PORT ?? 3000);

// LAN-IP ermitteln, damit Gaeste den QR-Link im selben Netz oeffnen koennen.
// VPN-Adapter (Tailscale 100.x) werden uebersprungen; BASE_URL ueberschreibt alles.
function lanIp(): string {
  const candidates: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) candidates.push(iface.address);
    }
  }
  return candidates.find((ip) => !ip.startsWith("100.")) ?? candidates[0] ?? "localhost";
}

// Basis-URL fuer QR-Links: BASE_URL-Env > Request-Host (hinter Traefik/Proxy) > LAN-IP.
// Bei localhost-Host (Kiosk-Browser am Geraet) hilft der Host-Header nicht, da
// Gaeste-Handys ihn nicht erreichen — dann LAN-IP.
function baseUrl(headers?: Record<string, string | string[] | undefined>): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  const fwdHost = headers?.["x-forwarded-host"] ?? headers?.host;
  const host = Array.isArray(fwdHost) ? fwdHost[0] : fwdHost;
  if (host && !/^(localhost|127\.)/.test(host)) {
    const fwdProto = headers?.["x-forwarded-proto"];
    const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto) ?? "http";
    return `${proto}://${host}`;
  }
  return `http://${lanIp()}:${PORT}`;
}

const ID_RE = /^[a-z0-9-]+$/;

const app = Fastify({ bodyLimit: 30 * 1024 * 1024 });

await mkdir(PHOTO_DIR, { recursive: true });

await app.register(fastifyStatic, { root: join(ROOT, "public"), prefix: "/" });
await app.register(fastifyStatic, {
  root: PHOTO_DIR,
  prefix: "/photos/",
  decorateReply: false,
});

app.post<{ Body: { image: string } }>("/api/photos", async (req, reply) => {
  const dataUrl = req.body?.image;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/jpeg;base64,")) {
    return reply.code(400).send({ error: "image muss eine JPEG-Data-URL sein" });
  }
  const id = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const buf = Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64");
  await writeFile(join(PHOTO_DIR, `${id}.jpg`), buf);
  return { id };
});

app.get<{ Params: { id: string } }>("/api/photos/:id/qr", async (req, reply) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return reply.code(400).send({ error: "ungueltige id" });
  try {
    await access(join(PHOTO_DIR, `${id}.jpg`));
  } catch {
    return reply.code(404).send({ error: "Foto nicht gefunden" });
  }
  const url = `${baseUrl(req.headers)}/p/${id}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 480,
    errorCorrectionLevel: "M",
  });
  return reply.type("image/svg+xml").send(svg);
});

// Download-Seite fuer Handys
app.get<{ Params: { id: string } }>("/p/:id", async (req, reply) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return reply.code(400).send("ungueltige id");
  try {
    await access(join(PHOTO_DIR, `${id}.jpg`));
  } catch {
    return reply.code(404).type("text/html").send("<h1>Foto nicht gefunden</h1>");
  }
  const html = (await readFile(join(ROOT, "public", "download.html"), "utf8")).replaceAll(
    "{{ID}}",
    id
  );
  return reply.type("text/html").send(html);
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Fotobox laeuft:  http://localhost:${PORT}`);
console.log(`QR-Links zeigen auf:  ${baseUrl()}`);
