import { User } from "lucide-react";
import type { AnimeCharacter } from "@/lib/providers/anime-characters";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useAnimeCharacters } from "@/views/detail/use-anime-characters";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK } from "./detail/bp-detail-chrome";
import { useBpT } from "./bp-i18n";
import type { BpAnimeDetail } from "./use-bp-anime-detail";

const BOX: BpArtBox = { min: 124, vw: 10, max: 196 };
const CELL_W = bpBoxCss(BOX);

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

// There is no character page to open, so the cell has no action. It stays
// focusable, like a cast cell without a person page, so the rail can step
// through it.
function BpCharacterCell({ character }: { character: AnimeCharacter }) {
  const src = useProxiedImageSrc(bpCardArt(character.image, bpBoxPx(BOX)));
  // Raw, like the desktop card. character.role is provider data, not a UI string,
  // and putting runtime values through t() is a key-collision surface: AniList
  // normalises to Main / Supporting / Background, and "Background" already exists
  // in the catalogs as the settings word for wallpaper, so a Russian viewer read
  // every background character as "Fon".
  const role = character.role ?? "";
  const sub = [role, character.favourites ? formatCount(character.favourites) : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-character:${character.id}`}
      aria-label={role ? `${character.name}, ${role}` : character.name}
      className="group flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: CELL_W }}
    >
      <span
        className="relative flex w-full items-center justify-center overflow-hidden bg-[var(--bp-panel-2)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {src ? (
          <BpArt src={src} className="object-cover" />
        ) : (
          <User size={26} className="text-ink-subtle" strokeWidth={1.7} />
        )}
      </span>
      <span className="flex w-full flex-col gap-0.5 p-[clamp(9px,0.9vw,15px)]">
        <span className="line-clamp-1 w-full text-[clamp(17px,2.4vh,22px)] font-semibold leading-tight text-ink">
          {character.name}
        </span>
        {sub && (
          <span className="line-clamp-1 w-full text-[clamp(15px,2.1vh,20px)] font-medium leading-tight tabular-nums text-ink-subtle">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * AniList characters, distinct from the Cast row. For anime the kitsu cast entry
 * puts the character in name and the voice actor in character, so the two rows
 * carry different people and both are worth showing. A real voice-actor rail is
 * not possible from here: CHARACTERS_QUERY requests no voiceActors edge on
 * either front end.
 *
 * useAnimeCharacters is the gate as well as the fetch. canonicalId stays null
 * until the anime provider chain resolves, so a tmdb:tv detail open never bills
 * an AniList round trip it cannot use.
 */
export function BpAnimeCharactersRow({ anime }: { anime: BpAnimeDetail }) {
  const t = useBpT();
  const characters = useAnimeCharacters(anime.canonicalId, anime.isAnime);

  if (characters.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key="characters" className="relative">
      <h2 className={BP_DETAIL_HEADING}>{t("Characters")}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK}>
        {characters.map((c) => (
          <BpCharacterCell key={c.id} character={c} />
        ))}
      </div>
    </section>
  );
}
