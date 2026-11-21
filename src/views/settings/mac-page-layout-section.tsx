import { useT } from "@/lib/i18n";
import { EDITABLE_PAGES, requestPageEdit } from "@/lib/page-edit-request";
import { isMacDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { ROW_ACTION, SettingGroup, SettingRow } from "./kit";
import { Section } from "./shared";

/**
 * macOS: where a page's row editing starts. Other platforms start it from a
 * button floating over the page, which a Mac window does not carry.
 */
export function MacPageLayoutSection() {
  const t = useT();
  const { settings } = useSettings();
  const { setView } = useView();
  if (!isMacDesktop()) return null;
  const hidden = settings.navCustomization.hidden;
  const pages = EDITABLE_PAGES.filter((id) => !hidden.includes(id));
  if (pages.length === 0) return null;
  return (
    <Section
      title={t("Customize pages")}
      subtitle={t(
        "Reorder, hide and rename the rows on a page. The page opens ready to edit; choose Done editing when you have finished.",
      )}
    >
      <SettingGroup>
        {pages.map((id) => (
          <SettingRow key={id} label={t(`nav.${id}`)}>
            <button
              type="button"
              className={ROW_ACTION}
              onClick={() => {
                requestPageEdit(id);
                setView(id);
              }}
            >
              {t("Customize")}
            </button>
          </SettingRow>
        ))}
      </SettingGroup>
    </Section>
  );
}
