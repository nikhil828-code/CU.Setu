/**
 * CU.Setu shared API types — mirrors the Flask backend contract.
 */

export interface UserSummary {
  username: string
  full_name: string
  programme: string
  year: string
  bio: string
  skills: string[]
  interests: string[]
  /** Public URL of the uploaded profile photo ("" = initials avatar). */
  avatar_url: string
  /** Public URL of the uploaded profile background ("" = gradient banner). */
  cover_url: string
  connections_count: number
  posts_count: number
}

export type Relationship = 'self' | 'connected' | 'pending_out' | 'pending_in' | 'none'

export interface PostComment {
  id: number
  author: UserSummary
  content: string
  created_at: string
  likes: number
  liked_by_me: boolean
  /** Id of the comment this replies to — null for top-level comments. */
  parent_id: number | null
  /** Direct replies nested under this comment (one thread level). */
  replies: PostComment[]
}

export type PostMediaType = '' | 'image' | 'video'

export interface Post {
  id: number
  author: UserSummary
  content: string
  created_at: string
  media_url: string
  media_type: PostMediaType
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

/* ------------------------- Smart Discovery 2.0 ------------------------------ */

export interface DiscoveryFactorScores {
  mutual: number
  skills: number
  interests: number
  major: number
}

export interface DiscoveryRecommendation extends UserSummary {
  mutual_count: number
  mutual_names: string[]
  shared_skills: string[]
  shared_interests: string[]
  same_programme: boolean
  /** Jaccard-based factor scores, each 0..1. */
  factors: DiscoveryFactorScores
  /** Weighted compatibility, 0..1. */
  compatibility: number
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
  | 'comment_liked'
  | 'comment_replied'
  | 'collab_application'
  | 'collab_accepted'
  | 'collab_rejected'
  | 'project_contributor'

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

/* ----------------------------- Network Explorer ---------------------------- */

export interface GraphNode extends UserSummary {
  /** BFS level (hops) from the logged-in student; null when unreachable. */
  level: number | null
}

export interface GraphEdge {
  source: string
  target: string
}

export interface NetworkGraphResponse {
  viewer: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: { nodes: number; edges: number; avg_degree: number }
}

export interface BfsStep {
  node: string
  parent: string | null
  level: number
  queue: string[]
}

export interface BfsTraceResponse {
  source: string
  steps: BfsStep[]
  reachable: number
}

/* ----------------------------- DSA Playground ------------------------------ */

export interface PlaygroundGraphNode {
  username: string
  full_name: string
  degree: number
}

export interface PlaygroundGraphResponse {
  nodes: PlaygroundGraphNode[]
  edges: GraphEdge[]
  steps: Array<
    | { op: 'add_vertex'; node: string }
    | { op: 'add_edge'; source: string; target: string }
  >
  stats: { vertices: number; edges: number }
}

// BfsStep / BfsTraceResponse above are reused verbatim by the Playground
// BFS tab (GET /api/playground/bfs has the identical shape).

export interface PlaygroundTrieWord {
  word: string
  owner: string
}

export type PlaygroundTrieInsertStep =
  | { op: 'start_word'; word: string; owner: string }
  | { op: 'create' | 'descend'; word: string; index: number; char: string }
  | { op: 'finish_word'; word: string; owner: string; index: number }

export interface PlaygroundTrieNode {
  char: string
  /** Usernames whose word terminates at this node. */
  terminal: string[]
  children: PlaygroundTrieNode[]
}

export interface PlaygroundTrieResponse {
  words: PlaygroundTrieWord[]
  steps: PlaygroundTrieInsertStep[]
  tree: PlaygroundTrieNode
}

export interface PlaygroundTrieSearchStep {
  op: 'match' | 'miss' | 'collect'
  index?: number
  char?: string
  prefix?: string
  matches?: string[]
}

export interface PlaygroundTrieSearchResponse {
  prefix: string
  steps: PlaygroundTrieSearchStep[]
  matches: { username: string; full_name: string }[]
}

export interface PlaygroundHeapItem {
  label: string
  value: number
}

export type PlaygroundHeapStep =
  | { op: 'push'; label: string; value: number; note: string }
  | { op: 'swap'; i: number; j: number; labels: string[]; values: number[] }
  | { op: 'state'; labels: string[]; values: number[] }
  | { op: 'pop_min'; label: string; value: number; note: string }

export interface PlaygroundHeapResponse {
  mode: string
  items: PlaygroundHeapItem[]
  steps: PlaygroundHeapStep[]
}

export interface PlaygroundHashmapStep {
  op: 'hash' | 'insert' | 'increment'
  key: string
  bucket: number
  owner?: string
  detail?: string
  /** Live table snapshot (insert steps only): bucket -> list of [key, count]. */
  table?: [string, number][][]
  count?: number
}

export interface PlaygroundHashmapResponse {
  capacity: number
  steps: PlaygroundHashmapStep[]
  table: [string, number][][]
  /** Skill -> total mentions, sorted descending. */
  counts: Record<string, number>
}

/* ----------------------------- Collaboration Hub ---------------------------- */

/** The role of the logged-in student relative to a collab. */
export type CollabMyStatus = 'owner' | 'member' | 'applied' | 'none'

export interface CollabItem {
  id: number
  owner: UserSummary
  title: string
  description: string
  /** One of the fixed categories: DSA, Web, AI & ML, Mobile, Hardware, Research, Startup, General. */
  category: string
  skills_needed: string[]
  team_size: number
  status: 'open' | 'closed'
  created_at: string
  members: UserSummary[]
  /** Total members on the team (includes the owner). */
  member_count: number
  /** Remaining seats: team_size - member_count (never negative). */
  open_spots: number
  /** Pending join applications (owner-only actions in the UI). */
  pending_count: number
  is_owner: boolean
  my_status: CollabMyStatus
}

export interface CollabApplicationItem {
  id: number
  collab_id: number
  collab_title: string
  message: string
  created_at: string
  applicant: UserSummary
}

export interface CollabCandidate extends UserSummary {
  /** Skills the candidate shares with this collab's skills_needed. */
  shared_skills: string[]
  /** Skill coverage ratio 0..1 (ranked by the backend, highest first). */
  coverage: number
  relationship: Relationship
}

/* ------------------------------ Skill Analytics ----------------------------- */

export interface SkillCountItem {
  skill: string
  count: number
  /** Share of all students on campus (top list only). */
  pct?: number
}

export interface SkillAnalyticsResponse {
  students: number
  distinct_skills: number
  total_listings: number
  top: SkillCountItem[]
  by_programme: Record<string, SkillCountItem[]>
  by_year: Record<string, SkillCountItem[]>
}

export interface SkillStudentsResponse {
  students: UserSummary[]
}

export interface ComplementaryItem {
  skill: string
  /** Students who know both this skill and the queried skill. */
  count: number
  /** Students on campus who own the queried skill. */
  of_owners: number
  /** count / of_owners * 100. */
  pct: number
}

export interface ComplementarySkillsResponse {
  skill: string
  complementary: ComplementaryItem[]
}

/* ------------------------------ Project Showcase ---------------------------- */

export interface ProjectItem {
  id: number
  owner: UserSummary
  title: string
  description: string
  /** Public URL of the uploaded cover image ("" = gradient placeholder). */
  cover_url: string
  tech_stack: string[]
  github_url: string
  demo_url: string
  /** One of the fixed categories (Web, DSA, AI & ML, …) or a custom value. */
  category: string
  featured: boolean
  created_at: string
  contributors: UserSummary[]
  is_mine: boolean
}
