import { Modal, Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { formatDuration } from '../lib/units';
import { useElapsedSeconds, useTimerStore } from '../store/timer';
import { colors, useScheme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** timed exercises in the workout, so the time can be dropped into one */
  timedExercises: { key: string; name: string }[];
  onUseTime: (exerciseKey: string, seconds: number) => void;
};

/** A stopwatch for timing a run, plank or any timed set. Keeps running while this panel is closed. */
export function WorkoutTimer({ visible, onClose, timedExercises, onUseTime }: Props) {
  useScheme();
  const seconds = useElapsedSeconds();
  const running = useTimerStore((s) => s.startedAt != null);
  const { start, pause, reset } = useTimerStore.getState();

  const use = (key: string) => {
    pause(); // folds the running time into accMs
    onUseTime(key, Math.round(useTimerStore.getState().accMs / 1000));
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close timer"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}
      >
        {/* stops taps inside the card from closing the panel */}
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 16, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontWeight: '800', fontSize: 18 }}>Timer</Text>
          <Text
            accessibilityLabel={`Timer ${formatDuration(seconds)}`}
            style={{ fontSize: 64, fontWeight: '900', textAlign: 'center', color: running ? colors.accent : colors.text }}
          >
            {formatDuration(seconds)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              mode="contained"
              icon={running ? 'pause' : 'play'}
              onPress={running ? pause : start}
              style={{ flex: 1, borderRadius: 14 }}
              contentStyle={{ height: 52 }}
            >
              {running ? 'Pause' : seconds > 0 ? 'Resume' : 'Start'}
            </Button>
            <Button
              mode="outlined"
              icon="restart"
              disabled={seconds === 0 && !running}
              onPress={reset}
              style={{ borderRadius: 14 }}
              contentStyle={{ height: 52 }}
            >
              Reset
            </Button>
          </View>

          {seconds > 0 && timedExercises.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>USE THIS TIME FOR</Text>
              {timedExercises.map((e) => (
                <Button key={e.key} mode="contained-tonal" icon="arrow-right" onPress={() => use(e.key)}>
                  {e.name}
                </Button>
              ))}
            </View>
          )}
          <Button onPress={onClose}>Close</Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
