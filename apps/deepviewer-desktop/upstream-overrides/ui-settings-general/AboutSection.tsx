/** DeepViewer-owned About page contributed through the existing settings section slot. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './AboutSection.module.css'

const DEEPVIEWER_VERSION = '__DEEPVIEWER_VERSION__'
const DEEPVIEWER_BUILD_NUMBER = '__DEEPVIEWER_BUILD_NUMBER__'
const DEEPSEEK_HARNESS_VERSION = '__DEEPSEEK_HARNESS_VERSION__'

export type AboutSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings'>

/** Render static application identity and build metadata. */
export function AboutSection({ t }: AboutSectionProps) {
  return (
    <div className={css.root} data-deepviewer-about="">
      <img
        className={css.icon}
        src="/deepviewer-icon.png"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <div className={css.identity}>
        <h2 className={css.name}>DeepViewer</h2>
        <p className={css.description}>{t('about.description')}</p>
        <p className={css.version}>
          {t('about.version')} {DEEPVIEWER_VERSION} ({t('about.build')} {DEEPVIEWER_BUILD_NUMBER})
        </p>
      </div>
      <div className={css.coreSection}>
        <div className={css.coreRow}>
          <div className={css.coreCopy}>
            <h3 className={css.coreName}>DeepSeek Harness</h3>
            <p className={css.coreDescription}>{t('about.core')}</p>
          </div>
          <div className={css.coreVersion}>{DEEPSEEK_HARNESS_VERSION}</div>
        </div>
      </div>
    </div>
  )
}
