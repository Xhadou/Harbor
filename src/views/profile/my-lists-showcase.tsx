import { Layers } from "lucide-react";
import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "./section-header";
import type { CollectionItem } from "@/lib/collections";
import type { CommunityCollection } from "@/lib/social/collections-sync";
import { CommunityShareButton } from "@/views/collections/community-share-button";
import { SaveCollectionButton } from "@/views/collections/community-hub";
import { useProfileTitle } from "./use-profile-title";
import { profileMediaMeta } from "@/lib/social/profile-media-meta";
import { useTitleContext } from "@/components/context-menu/use-title-context";

function ListPoster({
  item,
  onOpenMeta,
}: {
  item: CollectionItem;
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  const media = useProfileTitle(item.id, item.name, item.poster, item.type);
  const onContextMenu = useTitleContext(
    profileMediaMeta(item.id, item.type, { name: media.title, poster: media.poster }),
    media.poster,
  );
  return (
    <button
      ref={media.ref}
      onContextMenu={onContextMenu}
      onClick={() => onOpenMeta?.(item.id, item.type, { name: media.title, poster: media.poster })}
      disabled={!onOpenMeta}
      className="group w-full text-start disabled:cursor-default"
    >
      <Poster
        src={media.poster || undefined}
        seed={item.name || item.id}
        ratio="portrait"
        className="rounded-md ring-1 ring-edge-soft shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform group-hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)] motion-safe:group-hover:[transform:translate3d(0,-0.5rem,0)_scale(1.03)]"
        lazy
      />
      {media.title && (
        <div className="mt-1.5 truncate text-[12px] text-ink-muted">{media.title}</div>
      )}
    </button>
  );
}

/** On someone's own profile, sharing; on anyone else's, saving a copy. */
export function CollectionActions({
  collection,
  isOwner,
}: {
  collection: CommunityCollection;
  isOwner?: boolean;
}) {
  return isOwner ? (
    <CommunityShareButton collectionId={collection.id} variant="icon" />
  ) : (
    <SaveCollectionButton collection={collection} />
  );
}

/**
 * The profile's collections card: the collections this person shares. Sharing
 * a collection (on the Collections page) is the one way to make it public;
 * it is listed in the community and shown here.
 */
export function MyListsShowcase({
  collections,
  isOwner,
  onOpenMeta,
  onViewAll,
  onOpenCollections,
  handle,
}: {
  collections: CommunityCollection[];
  isOwner?: boolean;
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  onViewAll?: () => void;
  onOpenCollections?: () => void;
  handle?: string;
}) {
  const t = useT();
  const shown = collections.filter((c) => c.items.length > 0);
  return (
    <section
      aria-label={t("Collections")}
      className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft"
    >
      <SectionHeader
        icon={<Layers size={20} />}
        label={t("Collections")}
        onViewAll={shown.length > 0 ? onViewAll : undefined}
      />
      {shown.length > 0 ? (
        <div className="space-y-5">
          {shown.map((collection) => (
            <Row
              key={collection.id}
              title={collection.name || t("Untitled collection")}
              titleExtra={
                <span className="text-[12px] tabular-nums text-ink-subtle">
                  {collection.items.length}
                </span>
              }
              headerDescription={
                collection.description && (
                  <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
                    {collection.description}
                  </p>
                )
              }
              headerRight={<CollectionActions collection={collection} isOwner={isOwner} />}
              min={96}
              shape="portrait"
              scrollKey={handle ? `profile:${handle}:collection:${collection.id}` : undefined}
            >
              {collection.items.map((item) => (
                <ListPoster key={item.id} item={item} onOpenMeta={onOpenMeta} />
              ))}
            </Row>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-edge py-10 text-center">
          <p className="text-[14px] text-ink-muted">{t("No shared collections yet")}</p>
          {isOwner && (
            <p className="mt-1 text-[12px] text-ink-subtle">
              {t("Share a collection on the Collections page to show it here.")}
            </p>
          )}
          {isOwner && onOpenCollections && (
            <button
              onClick={onOpenCollections}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Layers size={18} /> {t("Collections")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
