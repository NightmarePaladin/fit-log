import { Platform, Share } from 'react-native';
import type { ShareCardData } from './shareCard';

/**
 * Getting things OUT of the app: files (Excel), pictures and text. Native uses the system share sheet
 * (Instagram, Messages, WhatsApp, Files...). The web build uses the browser's Web Share API when it
 * exists, and otherwise downloads the file or copies the text.
 */

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'cancelled';

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Save a file (e.g. the .xlsx) or open the share sheet for it. */
export async function deliverFile(filename: string, bytes: Uint8Array, mime: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    downloadBlob(new Blob([bytes as BlobPart], { type: mime }), filename);
    return 'downloaded';
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename });
  return 'shared';
}

/** Share plain text (or copy it where the browser can't share). */
export async function shareText(message: string, title = 'Fit Log'): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav = navigator as Navigator & { share?: (d: { text?: string; title?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text: message, title });
        return 'shared';
      } catch (e) {
        if (isAbort(e)) return 'cancelled';
      }
    }
    await navigator.clipboard.writeText(message);
    return 'copied';
  }
  const result = await Share.share({ message, title });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}

export async function copyText(text: string): Promise<void> {
  if (Platform.OS === 'web') {
    await navigator.clipboard.writeText(text);
    return;
  }
  const Clipboard = await import('expo-clipboard');
  await Clipboard.setStringAsync(text);
}

// ---------------------------------------------------------------- picture ----

/** Native: snapshot the on-screen <ShareCard> view to a PNG and open the share sheet. */
export async function shareCardViewImage(viewRef: unknown, title = 'My workout'): Promise<ShareOutcome> {
  const { captureRef } = await import('react-native-view-shot');
  const uri = await captureRef(viewRef as never, { format: 'png', quality: 1, result: 'tmpfile' });
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title });
  return 'shared';
}

const W = 1080;
const PAD = 72;
const BG = '#14151A';
const CARD = '#1E2028';
const TEXT = '#F2F3F7';
const MUTED = '#8B90A5';
const ACCENT = '#7C6CFF';

/** Web: draw the same card on a canvas (1080 px wide). */
export function drawShareCardCanvas(card: ShareCardData): HTMLCanvasElement {
  const rows = card.rows.slice(0, 9);
  const extra = card.rows.length - rows.length;
  const rowH = 128;
  const H = 520 + rows.length * rowH + (extra > 0 ? 70 : 0) + 230;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (size: number, weight = '700') => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // brand
  ctx.fillStyle = TEXT;
  ctx.font = font(84, '900');
  ctx.fillText('Fit Log', PAD, 150);
  const brandW = ctx.measureText('Fit Log').width;
  const ix = PAD + brandW + 28;
  const iy = 86;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(ix, iy, 84, 84, 24);
  ctx.fill();
  // dumbbell: bar + two plates on each side
  ctx.fillStyle = '#fff';
  ctx.fillRect(ix + 18, iy + 38, 48, 8);
  ctx.fillRect(ix + 12, iy + 24, 10, 36);
  ctx.fillRect(ix + 62, iy + 24, 10, 36);
  ctx.fillRect(ix + 5, iy + 31, 6, 22);
  ctx.fillRect(ix + 73, iy + 31, 6, 22);
  ctx.fillStyle = MUTED;
  ctx.font = font(38, '500');
  ctx.fillText('Log Lifts Fast', PAD, 214);
  // title block
  ctx.fillStyle = CARD;
  ctx.beginPath();
  ctx.roundRect(PAD - 24, 270, W - 2 * (PAD - 24), H - 270 - 60, 48);
  ctx.fill();
  ctx.fillStyle = TEXT;
  ctx.font = font(64, '800');
  ctx.fillText(clip(ctx, card.title, W - 2 * PAD), PAD, 370);
  ctx.fillStyle = MUTED;
  ctx.font = font(36, '500');
  ctx.fillText([card.owner, card.date].filter(Boolean).join('  ·  '), PAD, 424);
  // rows
  let y = 520;
  for (const r of rows) {
    ctx.fillStyle = TEXT;
    ctx.font = font(46, '700');
    ctx.fillText(clip(ctx, r.name, W - 2 * PAD), PAD, y);
    ctx.fillStyle = MUTED;
    ctx.font = font(40, '500');
    ctx.fillText(clip(ctx, r.detail, W - 2 * PAD), PAD, y + 56);
    y += rowH;
  }
  if (extra > 0) {
    ctx.fillStyle = MUTED;
    ctx.font = font(38, '500');
    ctx.fillText(`+ ${extra} more exercise${extra === 1 ? '' : 's'}`, PAD, y + 10);
    y += 70;
  }
  // total
  ctx.fillStyle = ACCENT;
  ctx.font = font(62, '900');
  ctx.fillText(card.total, PAD, H - 120);
  return canvas;
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Web: share the picture via the Web Share API when the browser supports files, otherwise download the PNG. */
export async function shareCardCanvasImage(card: ShareCardData, text?: string): Promise<ShareOutcome> {
  const canvas = drawShareCardCanvas(card);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the picture.'))), 'image/png'),
  );
  const file = new File([blob], 'fit-log-workout.png', { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files?: File[]; text?: string; title?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My workout', text });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  downloadBlob(blob, 'fit-log-workout.png');
  return 'downloaded';
}
