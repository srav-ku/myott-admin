import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/sqlite-core';

/* -------------------------------------------------------------------------- */
/*                                   MOVIES                                   */
/* -------------------------------------------------------------------------- */

export const movies = sqliteTable(
  'movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),

    title: text('title').notNull(),
    overview: text('overview'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    rating: real('rating'),
    releaseDate: text('release_date'),
    releaseYear: integer('release_year'),
    runtime: integer('runtime'),

    /** JSON array of genre names, e.g. ["Action","Drama"]. */
    genres: text('genres', { mode: 'json' }).$type<string[]>().default([]),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    tmdbIdx: uniqueIndex('movies_tmdb_id_unique').on(t.tmdbId),
    titleIdx: index('movies_title_idx').on(t.title),
    yearIdx: index('movies_year_idx').on(t.releaseYear),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                     TV                                     */
/* -------------------------------------------------------------------------- */

export const tv = sqliteTable(
  'tv',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),

    name: text('name').notNull(),
    overview: text('overview'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    rating: real('rating'),
    firstAirDate: text('first_air_date'),
    releaseYear: integer('release_year'),

    numberOfSeasons: integer('number_of_seasons'),
    numberOfEpisodes: integer('number_of_episodes'),

    genres: text('genres', { mode: 'json' }).$type<string[]>().default([]),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    tmdbIdx: uniqueIndex('tv_tmdb_id_unique').on(t.tmdbId),
    nameIdx: index('tv_name_idx').on(t.name),
    yearIdx: index('tv_year_idx').on(t.releaseYear),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                  EPISODES                                  */
/* -------------------------------------------------------------------------- */

export const episodes = sqliteTable(
  'episodes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tvId: integer('tv_id')
      .notNull()
      .references(() => tv.id, { onDelete: 'cascade' }),

    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),

    title: text('title'),
    overview: text('overview'),
    stillPath: text('still_path'),
    runtime: integer('runtime'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniq: uniqueIndex('episodes_tv_season_episode_unique').on(
      t.tvId,
      t.seasonNumber,
      t.episodeNumber,
    ),
    tvSeasonIdx: index('episodes_tv_season_idx').on(t.tvId, t.seasonNumber),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                   LINKS                                    */
/* -------------------------------------------------------------------------- */

export const QUALITIES = ['720p', '1080p'] as const;
export type Quality = (typeof QUALITIES)[number];

export const LINK_TYPES = ['direct', 'extract'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const links = sqliteTable(
  'links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    movieId: integer('movie_id').references(() => movies.id, {
      onDelete: 'cascade',
    }),
    episodeId: integer('episode_id').references(() => episodes.id, {
      onDelete: 'cascade',
    }),

    quality: text('quality', { enum: QUALITIES }).notNull(),
    type: text('type', { enum: LINK_TYPES }).notNull(),

    /** Admin-entered URL (direct stream OR embed/player page). */
    url: text('url').notNull(),
    /** Resolved direct stream URL (only populated for `type = 'extract'`). */
    extractedUrl: text('extracted_url'),
    /** Unix-seconds expiry for `extractedUrl`. */
    expiresAt: integer('expires_at', { mode: 'timestamp' }),

    /** JSON array of full language names, e.g. ["English","Hindi","Telugu"]. */
    languages: text('languages', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    // EXACTLY one of (movie_id, episode_id) is set.
    xorCheck: check(
      'links_movie_or_episode_xor',
      sql`((${t.movieId} IS NOT NULL AND ${t.episodeId} IS NULL) OR (${t.movieId} IS NULL AND ${t.episodeId} IS NOT NULL))`,
    ),
    // One link per quality per movie / episode.
    movieQualityUniq: uniqueIndex('links_movie_quality_unique').on(
      t.movieId,
      t.quality,
    ),
    episodeQualityUniq: uniqueIndex('links_episode_quality_unique').on(
      t.episodeId,
      t.quality,
    ),
    movieIdx: index('links_movie_idx').on(t.movieId),
    episodeIdx: index('links_episode_idx').on(t.episodeId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                  LANGUAGES                                 */
/* -------------------------------------------------------------------------- */

export const languages = sqliteTable('languages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').unique().notNull(),
});

/* -------------------------------------------------------------------------- */
/*                                    USERS                                   */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  'users',
  {
    /** Firebase UID (text) — guests use a generated id with prefix `guest:`. */
    id: text('id').primaryKey(),
    email: text('email'),
    displayName: text('display_name'),
    photoUrl: text('photo_url'),
    authProvider: text('auth_provider', { enum: ['google', 'guest'] }).notNull(),
    isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
    
    /** Stealth Mode fields */
    stealthMode: integer('stealth_mode', { mode: 'boolean' })
      .notNull()
      .default(false),
    stealthEnabledAt: integer('stealth_enabled_at', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_unique').on(t.email),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                  WATCHLIST                                 */
/* -------------------------------------------------------------------------- */

export const watchlist = sqliteTable(
  'watchlist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentType: text('content_type', { enum: ['movie', 'tv'] }).notNull(),
    contentId: integer('content_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniq: uniqueIndex('watchlist_user_content_unique').on(
      t.userId,
      t.contentType,
      t.contentId,
    ),
    userIdx: index('watchlist_user_idx').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                   HISTORY                                  */
/* -------------------------------------------------------------------------- */

export const history = sqliteTable(
  'history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id').references(() => movies.id, {
      onDelete: 'cascade',
    }),
    episodeId: integer('episode_id').references(() => episodes.id, {
      onDelete: 'cascade',
    }),
    playedAt: integer('last_watched_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    xorCheck: check(
      'history_movie_or_episode_xor',
      sql`((${t.movieId} IS NOT NULL AND ${t.episodeId} IS NULL) OR (${t.movieId} IS NULL AND ${t.episodeId} IS NOT NULL))`,
    ),
    movieUniq: uniqueIndex('history_user_movie_unique').on(t.userId, t.movieId),
    episodeUniq: uniqueIndex('history_user_episode_unique').on(
      t.userId,
      t.episodeId,
    ),
    userIdx: index('history_user_idx').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                 COLLECTIONS                                */
/* -------------------------------------------------------------------------- */

export const collections = sqliteTable(
  'collections',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    userIdx: index('collections_user_idx').on(t.userId),
  }),
);

export const collectionItems = sqliteTable(
  'collection_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    collectionId: integer('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id').references(() => movies.id, {
      onDelete: 'cascade',
    }),
    tvId: integer('tv_id').references(() => tv.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    collIdx: index('collection_items_coll_idx').on(t.collectionId),
    xorCheck: check(
      'collection_items_movie_or_tv_xor',
      sql`((${t.movieId} IS NOT NULL AND ${t.tvId} IS NULL) OR (${t.movieId} IS NULL AND ${t.tvId} IS NOT NULL))`,
    ),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                   WATCHED                                  */
/* -------------------------------------------------------------------------- */

export const watched = sqliteTable(
  'watched',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id').references(() => movies.id, {
      onDelete: 'cascade',
    }),
    episodeId: integer('episode_id').references(() => episodes.id, {
      onDelete: 'cascade',
    }),
    // TV metadata for quick lookup
    seasonNumber: integer('season_number'),
    episodeNumber: integer('episode_number'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    xorCheck: check(
      'watched_movie_or_episode_xor',
      sql`((${t.movieId} IS NOT NULL AND ${t.episodeId} IS NULL) OR (${t.movieId} IS NULL AND ${t.episodeId} IS NOT NULL))`,
    ),
    movieUniq: uniqueIndex('watched_user_movie_unique').on(t.userId, t.movieId),
    episodeUniq: uniqueIndex('watched_user_episode_unique').on(
      t.userId,
      t.episodeId,
    ),
    userIdx: index('watched_user_idx').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                     ADS                                    */
/* -------------------------------------------------------------------------- */

export const AD_POSITIONS = ['home_top', 'home_middle', 'player_bottom', 'reward_video'] as const;
export type AdPosition = (typeof AD_POSITIONS)[number];

export const AD_TYPES = ['banner', 'rewarded', 'native'] as const;
export type AdType = (typeof AD_TYPES)[number];

export const AD_PROVIDERS = ['custom', 'adsense', 'admob'] as const;
export type AdProvider = (typeof AD_PROVIDERS)[number];

export const ads = sqliteTable('ads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  position: text('position', { enum: AD_POSITIONS }).notNull(),
  type: text('type', { enum: AD_TYPES }).notNull(),
  provider: text('provider', { enum: AD_PROVIDERS }).notNull(),
  
  imageUrl: text('image_url'),
  redirectUrl: text('redirect_url'),
  unitId: text('unit_id'), // For network-based ads
  
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  frequencyLimit: integer('frequency_limit').notNull().default(0), // 0 = unlimited

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const AD_EVENT_TYPES = ['impression', 'click', 'reward_earned'] as const;

export const adEvents = sqliteTable('ad_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adId: integer('ad_id').references(() => ads.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: text('event_type', { enum: AD_EVENT_TYPES }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const userAdState = sqliteTable('user_ad_state', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lastRewardAt: integer('last_reward_at', { mode: 'timestamp' }),
  impressionsToday: integer('impressions_today').notNull().default(0),
  lastImpressionAt: integer('last_impression_at', { mode: 'timestamp' }),
});

/* -------------------------------------------------------------------------- */
/*                               REPORTS & REQS                               */
/* -------------------------------------------------------------------------- */

export const REPORT_STATUS = ['open', 'resolved', 'ignored'] as const;

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  contentType: text('content_type', { enum: ['movie', 'episode', 'tv'] }).notNull(),
  contentId: integer('content_id').notNull(),
  issueType: text('issue_type').notNull(),
  message: text('message'),
  status: text('status', { enum: REPORT_STATUS }).notNull().default('open'),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const REQUEST_STATUS = ['pending', 'added', 'ignored'] as const;

export const contentRequests = sqliteTable('content_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tmdbId: integer('tmdb_id').notNull(),
  mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
  title: text('title').notNull(),
  status: text('status', { enum: REQUEST_STATUS }).notNull().default('pending'),
  count: integer('count').notNull().default(1),
  lastRequestedAt: integer('last_requested_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/* -------------------------------------------------------------------------- */
/*                                  UPDATES                                   */
/* -------------------------------------------------------------------------- */

export const updates = sqliteTable('updates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/* -------------------------------------------------------------------------- */
/*                              SCHEMA EXPORTS                                */
/* -------------------------------------------------------------------------- */

export const schema = {
  movies,
  tv,
  episodes,
  links,
  languages,
  users,
  watchlist,
  history,
  collections,
  collectionItems,
  watched,
  ads,
  adEvents,
  userAdState,
  reports,
  contentRequests,
  updates,
};
