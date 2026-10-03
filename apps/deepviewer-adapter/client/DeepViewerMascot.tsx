import css from './welcome.module.css'

/** Keep the original DeepViewer mark in the native conversation hero slot. */
export function DeepViewerMascot() {
  return <span className={css.brandLogo} aria-hidden="true" data-deepviewer-brand-mark="" />
}
