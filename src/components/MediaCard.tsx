'use client';
import Link from 'next/link';
import { Star, Play } from 'lucide-react';

type Props = {
  type?: 'movie' | 'tv';
  kind?: 'movie' | 'tv';
  tmdb_id: number;
  title?: string | null;
  name?: string | null;
  poster_url?: string | null;
  rating?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  release_year?: number | null;
  first_air_year?: number | null;
};

export function MediaCard(props: Props) {
  const kind = props.kind ?? props.type ?? 'movie';
  const title = props.title ?? props.name ?? '';
  const href = kind === 'movie' ? `/movies/${props.tmdb_id}` : `/tv/${props.tmdb_id}`;
  const year =
    props.release_year ??
    props.first_air_year ??
    (props.release_date
      ? Number(props.release_date.slice(0, 4))
      : props.first_air_date
        ? Number(props.first_air_date.slice(0, 4))
        : null);
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 transition-transform hover:scale-[1.03]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        {props.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.poster_url}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[var(--color-text-dim)] text-sm p-2 text-center">
            {title}
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play size={36} className="text-white drop-shadow-lg" />
        </div>
        {typeof props.rating === 'number' && props.rating > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5 text-xs">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            {props.rating.toFixed(1)}
          </div>
        )}
        {kind === 'tv' && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-[10px] uppercase font-medium">
            TV
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-medium line-clamp-2">{title}</div>
        {year && (
          <div className="text-xs text-[var(--color-text-dim)] mt-0.5">{year}</div>
        )}
      </div>
    </Link>
  );
}
