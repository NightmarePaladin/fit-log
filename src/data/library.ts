import type { Exercise } from '../types';

/**
 * The built-in exercise library, bundled with the app so it is available with no connection
 * (including a first launch offline). Ids match the `exercises` rows with user_id null in the database.
 */
const rows: [string, string, string][] = [
  ['113ba724-791f-42d4-a9a5-6ef97f61d601', 'Barbell Curl', 'Arms'],
  ['f040c54e-c1eb-4409-af0a-18ef78e1d6fc', 'Dip', 'Arms'],
  ['3a35dd69-33a8-4261-8b54-de1115a575f6', 'Dumbbell Curl', 'Arms'],
  ['1c6e40d1-e103-4bb1-adac-1bbcb62a6ea9', 'Hammer Curl', 'Arms'],
  ['e04f515f-5d2c-4120-b6c0-fd538bc25a3b', 'Skull Crusher', 'Arms'],
  ['44887f86-7728-460a-a8a6-400f36996b91', 'Triceps Pushdown', 'Arms'],
  ['d31969d1-87df-4c2c-901d-0299d20841e2', 'Barbell Row', 'Back'],
  ['a7095d3d-9cb0-47d7-835d-9fab7101f6e9', 'Conventional Deadlift', 'Back'],
  ['5b491648-f77b-4a8c-a207-e5588ba0ea4f', 'Dumbbell Row', 'Back'],
  ['1d6b1eeb-8413-47bb-a3c9-bc54201812c7', 'Lat Pulldown', 'Back'],
  ['57fa3f2b-55d1-4117-a4bd-6f4302ce5d3c', 'Pull-Up', 'Back'],
  ['c5ce903a-ae2f-4133-9abd-dbf341794b6c', 'Seated Cable Row', 'Back'],
  ['106f36bd-ff37-431a-b562-6f9c5d18698a', 'Barbell Bench Press', 'Chest'],
  ['7d5e64f7-ed44-41b9-a992-79bbce240fc9', 'Chest Fly', 'Chest'],
  ['cb638c18-594d-4b66-81c8-546f08465cea', 'Dumbbell Bench Press', 'Chest'],
  ['bf95bdce-131c-433b-9104-4fb51ca04570', 'Incline Dumbbell Press', 'Chest'],
  ['c1132cd0-12c9-43c9-b0cb-172559bc708b', 'Push-Up', 'Chest'],
  ['d252afe6-faf4-4d07-95f6-45b050f487e4', 'Cable Crunch', 'Core'],
  ['e35fcac5-e481-4281-a360-05a55bff7ee3', 'Hanging Leg Raise', 'Core'],
  ['dbbc1de0-b5f9-46c5-871d-a801bcef1437', 'Plank', 'Core'],
  ['8cdf6dac-149f-4321-b9c8-5d3a19935a63', 'Hip Thrust', 'Glutes'],
  ['bbefbb11-8c9c-4ea3-8c1e-8a1c8d30af6e', 'Barbell Squat', 'Legs'],
  ['524dac3c-16c2-4a25-b2a3-21f5e706aa5e', 'Front Squat', 'Legs'],
  ['17265758-d1c0-42cf-a765-452356d4e323', 'Leg Curl', 'Legs'],
  ['1af61a4b-e225-44a0-a15d-7169278bfb15', 'Leg Extension', 'Legs'],
  ['fccdefb8-3578-464f-af7d-22f4560cbcca', 'Leg Press', 'Legs'],
  ['dfafed27-b9d9-419c-bb7c-b83aa0bfc8db', 'Romanian Deadlift', 'Legs'],
  ['71dca122-1aac-45bb-9a10-9fef4548a851', 'Standing Calf Raise', 'Legs'],
  ['1df48348-8166-4317-804a-9b99362c0dc4', 'Walking Lunge', 'Legs'],
  ['8c4ab70b-e72d-435f-8a28-dc1836c8a3ee', 'Dumbbell Shoulder Press', 'Shoulders'],
  ['d74b3087-44db-43f2-8591-d88019284f24', 'Face Pull', 'Shoulders'],
  ['0aebac5e-2867-466b-a49b-1ff33a136116', 'Lateral Raise', 'Shoulders'],
  ['245a7b32-494d-45aa-a297-34a5b02d9023', 'Overhead Press', 'Shoulders'],
  ['1b39b0f3-cdff-43a8-ac17-7ee805fc4593', 'Rear Delt Fly', 'Shoulders'],
];

export const LIBRARY: Exercise[] = rows
  .map(([id, name, muscle_group]) => ({ id, name, muscle_group, user_id: null, is_custom: false }))
  .sort((a, b) => a.name.localeCompare(b.name));
