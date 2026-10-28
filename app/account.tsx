import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Card, SectionTitle } from '../src/components/ui';
import { colors } from '../src/theme';

export default function Account() {
  const router = useRouter();
  const { session, fullName, avatarUrl, updateProfile, deleteAccount } = useAuth();
  const [name, setName] = useState(fullName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dirty = name.trim() !== fullName;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const created = session?.user.created_at ? new Date(session.user.created_at) : null;
  const provider = (session?.user.app_metadata?.provider as string | undefined) ?? 'google';

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(name);
      setMessage({ ok: true, text: 'Profile saved' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not save profile' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(); // on success the session clears and the route guard returns to Login
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete account. Nothing was deleted.');
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ flex: 1, fontWeight: '800' }}>Account</Text>
        <IconButton icon="cog" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8, marginVertical: 8 }}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 38, fontWeight: '800', color: '#fff' }}>{fullName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{fullName}</Text>
        </View>

        <SectionTitle>General info</SectionTitle>
        <Card style={{ gap: 12 }}>
          <TextInput
            mode="outlined"
            label="Display name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setMessage(null);
            }}
            maxLength={60}
            autoCapitalize="words"
          />
          <TextInput mode="outlined" label="Email" value={session?.user.email ?? ''} editable={false} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Email comes from your {provider === 'google' ? 'Google' : provider} sign-in and can’t be changed here.
            {created ? ` Member since ${created.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.` : ''}
          </Text>
          {message && <Text style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</Text>}
          <Button
            mode="contained"
            loading={saving}
            disabled={saving || !dirty || name.trim().length === 0}
            onPress={save}
            contentStyle={{ height: 48 }}
          >
            Save changes
          </Button>
        </Card>

        <SectionTitle>Danger zone</SectionTitle>
        <Card style={{ gap: 10, borderColor: colors.danger }}>
          <Text style={{ fontWeight: '700' }}>Delete account</Text>
          <Text style={{ color: colors.muted }}>
            Permanently deletes your profile, every workout and set, and your custom exercises. This cannot be undone.
          </Text>
          <Button
            mode="outlined"
            icon="delete-forever"
            textColor={colors.danger}
            style={{ borderColor: colors.danger }}
            onPress={() => {
              setConfirmText('');
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            Delete my account
          </Button>
        </Card>
      </ScrollView>

      <Portal>
        <Dialog visible={deleteOpen} onDismiss={() => !deleting && setDeleteOpen(false)}>
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <Text>
              All your workouts and data will be permanently erased. Type <Text style={{ fontWeight: '800' }}>DELETE</Text> to confirm.
            </Text>
            <TextInput
              mode="outlined"
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              disabled={deleting}
            />
            {deleteError && <Text style={{ color: colors.danger }}>{deleteError}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              textColor={colors.danger}
              loading={deleting}
              disabled={deleting || confirmText.trim() !== 'DELETE'}
              onPress={confirmDelete}
            >
              Delete forever
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}
