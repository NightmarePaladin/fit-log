import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOrCreateShareToken, getShareToken, revokeShare } from '../api/sharing';
import { useAuth } from '../auth/AuthProvider';
import { useUnits } from '../hooks/useUnits';
import { shareUrl } from '../lib/config';
import { buildPlanSheet, fileSafe } from '../lib/exports';
import { isNetworkError } from '../lib/net';
import { buildShareCard, buildShareText } from '../lib/shareCard';
import {
  copyText, deliverFile, shareCardCanvasImage, shareCardViewImage, shareText, type ShareOutcome,
} from '../lib/shareOut';
import { buildXlsx, XLSX_MIME } from '../lib/xlsx';
import { colors, useScheme } from '../theme';
import type { WorkoutRow } from '../types';
import { ShareCard } from './ShareCard';

type Props = { visible: boolean; onClose: () => void; workout: WorkoutRow };

/** Everything you can do to get a finished workout out of the app: picture, text, link, Excel plan. */
export function ShareSheet({ visible, onClose, workout }: Props) {
  useScheme();
  const router = useRouter();
  const { session, fullName } = useAuth();
  const u = useUnits();
  const cardRef = useRef<unknown>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'image' | 'text' | 'link' | 'plan'>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const owner = fullName.split(' ')[0];
  const card = buildShareCard(workout, u, session ? owner : '');
  const canLink = !!session && !workout.pending;

  // Show the current link if this workout is already shared.
  useEffect(() => {
    if (!visible || !canLink) return;
    let cancelled = false;
    getShareToken(workout.id)
      .then((t) => {
        if (!cancelled) setLink(t ? shareUrl(t) : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, canLink, workout.id]);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({
        ok: false,
        text: isNetworkError(e)
          ? 'This needs an internet connection. Try again when you are online.'
          : e instanceof Error ? e.message : 'Something went wrong.',
      });
    } finally {
      setBusy(null);
    }
  };

  const outcomeNote = (o: ShareOutcome) => {
    if (o === 'downloaded') setMessage({ ok: true, text: 'Saved to your downloads.' });
    if (o === 'copied') setMessage({ ok: true, text: 'Copied to your clipboard.' });
  };

  const sharePicture = () =>
    run('image', async () => {
      const text = buildShareText(card, link);
      outcomeNote(Platform.OS === 'web' ? await shareCardCanvasImage(card, text) : await shareCardViewImage(cardRef.current));
    });

  const shareAsText = () => run('text', async () => outcomeNote(await shareText(buildShareText(card, link))));

  const makeLink = () =>
    run('link', async () => {
      const token = await getOrCreateShareToken(workout.id);
      setLink(shareUrl(token));
    });

  const stopLink = () =>
    run('link', async () => {
      await revokeShare(workout.id);
      setLink(null);
      setMessage({ ok: true, text: 'Link turned off. It no longer works.' });
    });

  const exportPlan = () =>
    run('plan', async () => {
      const bytes = buildXlsx([buildPlanSheet(workout, u)]);
      outcomeNote(await deliverFile(`fit-lift-plan-${fileSafe(workout.name || 'workout')}.xlsx`, bytes, XLSX_MIME));
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
          <Text variant="titleLarge" style={{ flex: 1, fontWeight: '800', paddingLeft: 8 }}>Share workout</Text>
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, alignItems: 'center', paddingBottom: 40 }}>
          <ShareCard data={card} viewRef={cardRef} />

          <View style={{ width: '100%', gap: 10 }}>
            <Button mode="contained" icon="image" loading={busy === 'image'} disabled={busy !== null} onPress={sharePicture} contentStyle={{ height: 48 }}>
              Share as picture
            </Button>
            <Button mode="contained-tonal" icon="text" loading={busy === 'text'} disabled={busy !== null} onPress={shareAsText}>
              Share as text
            </Button>
            <Button mode="contained-tonal" icon="microsoft-excel" loading={busy === 'plan'} disabled={busy !== null} onPress={exportPlan}>
              Export as plan (Excel)
            </Button>
          </View>

          <View style={{ width: '100%', gap: 8, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: '800' }}>Private link</Text>
            {!session ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>Sign in to create a link anyone can open without an account.</Text>
            ) : workout.pending ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                This workout is saved on your device and not uploaded yet. Once it uploads you can create a link.
              </Text>
            ) : link ? (
              <>
                <Text selectable style={{ color: colors.accent, fontSize: 13 }}>{link}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button compact icon="content-copy" onPress={() => run('link', async () => { await copyText(link); setMessage({ ok: true, text: 'Link copied.' }); })}>
                    Copy
                  </Button>
                  <Button compact icon="share-variant" disabled={busy !== null} onPress={() => run('link', async () => outcomeNote(await shareText(`${owner}'s workout on Fit Lift: ${link}`)))}>
                    Share link
                  </Button>
                  <Button compact icon="link-off" textColor={colors.danger} disabled={busy !== null} onPress={stopLink}>
                    Stop sharing
                  </Button>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Anyone with this link can view this one workout. Stop sharing turns it off.</Text>
              </>
            ) : (
              <>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Create a link anyone can open in a browser, no account needed. You can turn it off any time.
                </Text>
                <Button mode="outlined" icon="link-variant" loading={busy === 'link'} disabled={busy !== null} onPress={makeLink}>
                  Create private link
                </Button>
              </>
            )}
          </View>

          {message && <Text style={{ color: message.ok ? colors.success : colors.danger, textAlign: 'center' }}>{message.text}</Text>}

          <View style={{ width: '100%', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
              Buddies you have connected with can already see your workouts inside the app.
            </Text>
            <Button compact onPress={() => { onClose(); router.push('/buddies'); }}>Manage buddies</Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
