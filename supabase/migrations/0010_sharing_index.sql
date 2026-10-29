-- Covering index for the buddy_invites.used_by foreign key (flagged by the performance advisor).
create index if not exists buddy_invites_used_by_idx on public.buddy_invites (used_by);
