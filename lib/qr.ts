import QRCode from "qrcode";

/** QR code for a text as an SVG data URL (rendered server-side, no client JS). */
export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
