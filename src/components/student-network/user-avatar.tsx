import { mediaSrc } from '@/lib/api'
import { gradientFor, initialsOf } from '@/lib/avatar'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-2xl',
} as const

export type AvatarSize = keyof typeof SIZES

interface UserAvatarProps {
  username: string
  fullName?: string
  /** Public URL of an uploaded profile photo — replaces initials when set. */
  avatarUrl?: string
  size?: AvatarSize
  /** Orange ring — used to mark unread items. */
  outline?: boolean
  className?: string
  onClick?: () => void
  /** Accessible label for the clickable variant. */
  label?: string
}

export function UserAvatar({
  username,
  fullName,
  avatarUrl,
  size = 'md',
  outline,
  className,
  onClick,
  label,
}: UserAvatarProps) {
  const initials =
    fullName && fullName.trim() !== ''
      ? initialsOf(fullName)
      : username.charAt(0).toUpperCase()

  const base = cn(
    'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white',
    SIZES[size],
    outline && 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white',
    className,
  )
  const style = { background: gradientFor(username) }

  if (avatarUrl) {
    const photo = (
       
      <img
        src={mediaSrc(avatarUrl)}
        alt={fullName ?? username}
        draggable={false}
        className="size-full object-cover"
      />
    )
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            base,
            'cursor-pointer transition-transform hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
          )}
          aria-label={label ?? `Open ${fullName ?? username}'s profile`}
          title={fullName ?? username}
        >
          {photo}
        </button>
      )
    }
    return (
      <span className={base} style={style} aria-hidden="true">
        {photo}
      </span>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          base,
          'cursor-pointer transition-transform hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
        )}
        style={style}
        aria-label={label ?? `Open ${fullName ?? username}'s profile`}
        title={fullName ?? username}
      >
        {initials}
      </button>
    )
  }

  return (
    <span className={base} style={style} aria-hidden="true">
      {initials}
    </span>
  )
}
