interface ExternalLinkIconProps {
  readonly size?: number
  readonly className?: string
}

/** User-supplied 32px external-link artwork, rendered with the active UI color. */
export function ExternalLinkIcon({ size = 20, className }: ExternalLinkIconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7.28129 24.4375C7.65629 24.8031 8.18129 24.8313 8.57504 24.4375L21.2969 11.725L23.6501 9.2125C24.0063 8.86563 23.9969 8.39687 23.6688 8.05937C23.3313 7.73125 22.8626 7.72187 22.5156 8.06875L20.0031 10.4312L7.28129 23.1531C6.89692 23.5375 6.91567 24.0625 7.28129 24.4375ZM22.9001 14.9969V20.3313C22.9001 20.8187 23.3126 21.2594 23.8281 21.2594C24.3251 21.2594 24.7563 20.8469 24.7563 20.2937L24.7376 7.99375C24.7376 7.4125 24.3531 7 23.7531 7H11.4438C10.8719 7 10.4875 7.44062 10.4875 7.92813C10.4875 8.425 10.9188 8.8375 11.4063 8.8375H16.2719L23.1251 8.63125L22.9001 14.9969Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
    </svg>
  )
}
