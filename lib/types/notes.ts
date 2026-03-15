// Notes types

export interface NoteRecord {
  id: string;
  user_id: string;
  party_id: string;
  session_id: string | null;
  break_category: string | null;
  content_item_id: string | null;
  note_text: string;
  created_at: string;
  updated_at: string;
}
