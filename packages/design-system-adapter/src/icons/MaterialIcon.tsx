import type { HTMLAttributes } from 'react';

export interface MaterialIconProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  /** Material Symbols ligature name, for example `search` or `upload_file`. */
  name: string;
  /** Pixel size. The default is 24px, as in Material 3. */
  size?: number;
}

/** Local Material Symbols Rounded ligature; decorative unless labelled. */
export function MaterialIcon({
  name,
  size = 24,
  className,
  style,
  role,
  'aria-label': ariaLabel,
  ...spanProps
}: MaterialIconProps) {
  const classes = ['material-symbols-rounded', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      {...spanProps}
      className={classes}
      role={role ?? (ariaLabel ? 'img' : undefined)}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{ fontSize: `${size}px`, ...style }}
    >
      {name}
    </span>
  );
}
