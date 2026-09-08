import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  nickname: text('nickname').notNull(),
  createdAt: text('created_at').notNull(),
});
export const groups = sqliteTable('travel_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  ownerId: text('owner_id').notNull(),
  createdAt: text('created_at').notNull(),
});
export const members = sqliteTable(
  'group_members',
  {
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    joinedAt: text('joined_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('members_user').on(t.userId),
  ],
);
export const invitations = sqliteTable('group_invitations', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
  createdAt: text('created_at').notNull(),
});
export const plans = sqliteTable(
  'group_plans',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(),
    authorId: text('author_id').notNull(),
    payload: text('payload').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('plans_group').on(t.groupId)],
);
// Operational error metadata only: never stores tourism response content.
export const providerLimits = sqliteTable('provider_limits', {
  id: text('id').primaryKey(),
  error: text('error').notNull(),
  retryAt: integer('retry_at').notNull(),
});

export const formerMembers = sqliteTable(
  'former_members',
  {
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    removedAt: text('removed_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);
