// Shared by the local boot page and the brief plugin-loading surface. Asset
// placeholders are replaced only with trusted, bundled or same-origin URLs.
export const DEEPVIEWER_LAUNCH_LOCKUP_HTML = `
<section class="deepviewer-launch__brand" aria-label="DeepViewer">
  <picture class="deepviewer-launch__icon" aria-hidden="true">
    <source media="(prefers-color-scheme: dark)" srcset="__DEEPVIEWER_ICON_DARK__">
    <img src="__DEEPVIEWER_ICON_LIGHT__" alt="" width="96" height="96" draggable="false">
  </picture>
  <h1 class="deepviewer-launch__name">DeepViewer</h1>
</section>`
