import { Heart } from "lucide-react";
import { Poster } from "@/components/poster";
import type { AnimeCharacter } from "@/lib/providers/anime-characters";

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const rounded = k >= 100 || k % 1 === 0 ? Math.round(k) : Math.round(k * 10) / 10;
  return `${rounded}K`;
}

export function CharacterCard({
  character,
  onOpen,
}: {
  character: AnimeCharacter;
  onOpen?: (c: AnimeCharacter) => void;
}) {
  const seed = String(character.id);

  const Wrap: "button" | "div" = onOpen ? "button" : "div";
  const wrapProps = onOpen ? { onClick: () => onOpen(character), type: "button" as const } : {};

  return (
    <Wrap
      {...wrapProps}
      className={`group flex w-full min-w-0 flex-col gap-2.5 text-start ${onOpen ? "" : "cursor-default"}`}
    >
      <div
        className={`relative transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] ${onOpen ? "group-hover:-translate-y-2" : ""}`}
      >
        <Poster
          src={character.image}
          seed={seed}
          ratio="portrait"
          className={`rounded-xl shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 ${onOpen ? "harbor-card-ring group-hover:shadow-[0_24px_44px_-14px_rgba(0,0,0,0.6)]" : ""}`}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-1 text-[13px] font-medium text-ink">{character.name}</p>
        {character.role && (
          <p className="line-clamp-1 text-[12px] text-ink-subtle">{character.role}</p>
        )}
        {character.favourites ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
            <Heart size={11} fill="currentColor" className="text-rose-400" />
            {formatCount(character.favourites)}
          </span>
        ) : null}
      </div>
    </Wrap>
  );
}
