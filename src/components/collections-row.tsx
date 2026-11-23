import { CollectionCard } from "@/components/collection-card";
import { COLLECTIONS_CATALOG } from "@/lib/collections-catalog";
import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { Row } from "./row";

export function CollectionsRow({ title }: { title?: string }) {
  const { settings } = useSettings();
  const { openCollections } = useView();
  const t = useT();
  if (!settings.tmdbKey) return null;
  // macOS: a collection is a poster among the posters of the rows around it.
  const posters = isMacDesktop();
  return (
    <Row
      title={title ?? t("Collections")}
      min={posters ? undefined : 250}
      shape={posters ? "portrait" : "landscape"}
      scrollKey="home:collections"
      onViewAll={openCollections}
      previews
    >
      {COLLECTIONS_CATALOG.slice(0, 30).map((c) => (
        <CollectionCard key={`${c.id}-${c.name}`} id={c.id} name={c.name} poster={posters} />
      ))}
    </Row>
  );
}
