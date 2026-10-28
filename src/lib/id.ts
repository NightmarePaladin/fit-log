import * as Crypto from 'expo-crypto';

/** A random UUID. Used for workouts and custom exercises created on the phone (they become the database ids). */
export const newId = (): string => Crypto.randomUUID();
