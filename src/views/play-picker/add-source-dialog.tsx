import { useEffect, useId, useRef } from "react";
import { useLeaveSoftly } from "@/lib/soft-leave";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { StreamSourceSetup } from "@/components/stream-source-setup";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { BackdropLayer } from "./backdrop-layer";

/**
 * Play was pressed with nothing to play from. The setup's "add a streaming
 * source" step opens over the title's artwork; once a source is added the
 * picker reads its addons again and carries on with this title.
 */
export function AddSourceDialog({
  meta,
  backdropSrc,
  onCancel,
}: {
  meta: Meta;
  backdropSrc?: string;
  onCancel: () => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const { setView } = useView();
  const { closing, close } = useModalExit(onCancel);
  const titleId = useId();

  // The dialog starts the keyboard at its heading, not in the link field:
  // focusing a field must not begin editing it.
  useEffect(() => {
    document.getElementById(titleId)?.focus({ preventScroll: true });
  }, [titleId]);

  const screenRef = useRef<HTMLElement>(null);
  useLeaveSoftly(screenRef);
  return (
    <main
      ref={screenRef}
      data-arrives=""
      className="absolute inset-0 z-60 overflow-hidden bg-canvas"
    >
      <BackdropLayer src={backdropSrc} />
      <ModalShell closing={closing} onDismiss={close} width={440} labelledBy={titleId}>
        <div className="p-6">
          <StreamSourceSetup
            titleId={titleId}
            sources={[]}
            signedIn={!!user}
            playing={meta.name}
            onBrowse={() => setView("addons")}
            dialog
            footer={
              <button type="button" onClick={close} className="mac-btn mac-btn-secondary flex">
                {t("Cancel")}
              </button>
            }
          />
        </div>
      </ModalShell>
    </main>
  );
}
