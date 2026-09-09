import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
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

// User-published place references and suggestions only, never provider payloads.
export const adviceShares = sqliteTable(
  'advice_shares',
  {
    id: text('id').primaryKey(),
    ownerHash: text('owner_hash').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    index('advice_owner').on(t.ownerHash),
    index('advice_expiry').on(t.expiresAt),
  ],
);
export const adviceSuggestions = sqliteTable(
  'advice_suggestions',
  {
    id: text('id').primaryKey(),
    shareId: text('share_id').notNull(),
    visitorHash: text('visitor_hash').notNull(),
    kind: text('kind').notNull(),
    targetId: text('target_id').notNull(),
    placeId: text('place_id'),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('advice_share').on(t.shareId),
    uniqueIndex('advice_visitor_share').on(t.shareId, t.visitorHash),
  ],
);
export const adviceReports = sqliteTable(
  'advice_reports',
  {
    suggestionId: text('suggestion_id').notNull(),
    visitorHash: text('visitor_hash').notNull(),
  },
  (t) => [primaryKey({ columns: [t.suggestionId, t.visitorHash] })],
);
export const adviceRate = sqliteTable('advice_rate', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
