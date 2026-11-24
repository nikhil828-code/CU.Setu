/**
 * CampusConnect shared API types — mirrors the Flask backend contract.
 */

export interface UserSummary {
  username: string
  full_name: string
  programme: string
  year: string
  bio: string
  skills: string[]
  interests: string[]
  connections_count: number
  posts_count: number
}

export type Relationship = 'self' | 'connected' | 'pending_out' | 'pending_in' | 'none'

export interface PostComment {
  id: number
  author: UserSummary
  content: string
  created_at: string
}

export interface Post {
  id: number
  author: UserSummary
  content: string
  created_at: string
  likes: number
  liked_by_me: boolean
  is_mine: boolean
  comments: PostComment[]
}

export interface Recommendation extends UserSummary {
  mutual_count: number
  mutual_names: string[]
  shared_skills: string[]
  shared_interests: string[]
  same_programme: boolean
  same_year: boolean
  score: number
  relationship: Relationship
}

export interface SearchItem extends UserSummary {
  relationship: Relationship
  mutual_count: number
}

export interface RequestItem {
  id: number
  created_at: string
  sender: UserSummary
}

export interface SentRequestItem {
  id: number
  created_at: string
  receiver: UserSummary
}

export type NotificationKind =
  | 'request_received'
  | 'request_accepted'
  | 'request_rejected'
  | 'post_liked'
  | 'post_commented'

export interface NotificationItem {
  id: number
  kind: NotificationKind
  actor: UserSummary | null
  message: string
  is_read: boolean
  created_at: string
}

/* ----------------------------- response envelopes ---------------------------- */

export interface StatsResponse {
  students: number
  connections: number
  posts: number
  pending_requests: number
}

export interface ProfileResponse extends UserSummary {
  created_at: string
  relationship: Relationship
  mutual_count: number
  mutual: UserSummary[]
}

export interface PathResponse {
  source: string
  target: string
  connected: boolean
  path: string[] | null
  distance: number | null
}

export interface ConnectionItem extends UserSummary {
  mutual_count: number
}

export interface DegreesResponse {
  counts: { first: number; second: number; third: number; beyond: number }
  lists: { first: UserSummary[]; second: UserSummary[]; third: UserSummary[] }
}
