import type { DeckSnapshot } from './decks';
// App-facing schema contract. Existing profile fields are verified by the migration.
// Private/legacy columns deliberately do not belong to this client contract.
export type Profile = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
export type Caption = { id: string; creator_id: string; image_path: string; user_prompt: string; generation_prompt: string; caption: string; model: string; created_at: string };
export type Vote = { id: string; user_id: string; caption_id: string; value: boolean; created_at: string; updated_at: string };
export type FeedCaption = { id: string; image_path: string; caption: string; model: string; created_at: string; funny_count: number; not_funny_count: number; my_vote: boolean | null };
type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, never, Partial<Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>>>;
      captions: Table<Caption, Pick<Caption, 'creator_id' | 'image_path' | 'user_prompt' | 'generation_prompt' | 'caption' | 'model'>, never>;
      caption_votes: Table<Vote, Pick<Vote, 'user_id' | 'caption_id' | 'value'>, Pick<Vote, 'value'>>;
      movies: Table<{ id: number; title: string; year: number }, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      member_directory: { Args: Record<string, never>; Returns: Profile[] };
      caption_feed: { Args: { sort_by?: string; page_offset?: number; page_size?: number }; Returns: FeedCaption[] };
      caption_deck_snapshot: { Args: { selected_month?: string; seen_created_at?: string; seen_id?: string }; Returns: DeckSnapshot };
      caption_deck_items: { Args: { caption_ids: string[] }; Returns: FeedCaption[] };
      caption_deck_vote: { Args: { target_caption: string; vote_value: boolean }; Returns: FeedCaption };
      cast_caption_vote: { Args: { target_caption: string; vote_value: boolean }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
