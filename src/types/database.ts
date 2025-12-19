export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      supermarkets: {
        Row: {
          id: string
          name: string
          nif: string | null
          logo_url: string | null
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          nif?: string | null
          logo_url?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          nif?: string | null
          logo_url?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          user_id: string
          supermarket_id: string | null
          file_name: string
          file_url: string | null
          upload_date: string
          ticket_number: string | null
          store_name: string | null
          purchase_date: string | null
          total_amount: number | null
          parsed: boolean
          parsing_error: string | null
          source_type: 'pdf' | 'manual' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          supermarket_id?: string | null
          file_name: string
          file_url?: string | null
          upload_date?: string
          ticket_number?: string | null
          store_name?: string | null
          purchase_date?: string | null
          total_amount?: number | null
          parsed?: boolean
          parsing_error?: string | null
          source_type?: 'pdf' | 'manual' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          supermarket_id?: string | null
          file_name?: string
          file_url?: string | null
          upload_date?: string
          ticket_number?: string | null
          store_name?: string | null
          purchase_date?: string | null
          total_amount?: number | null
          parsed?: boolean
          parsing_error?: string | null
          source_type?: 'pdf' | 'manual' | null
          created_at?: string
          updated_at?: string
        }
      }
      product_supermarkets: {
        Row: {
          id: string
          product_id: string
          supermarket_id: string
          last_price: number | null
          last_seen_at: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          supermarket_id: string
          last_price?: number | null
          last_seen_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          supermarket_id?: string
          last_price?: number | null
          last_seen_at?: string
          created_at?: string
        }
      }
      categories: {
        Row: {
          user_id: string
          id: string
          name: string
          description: string | null
          icon: string | null
          color: string | null
          keywords: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          id?: string
          name: string
          description?: string | null
          icon?: string | null
          color?: string | null
          keywords?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          id?: string
          name?: string
          description?: string | null
          icon?: string | null
          color?: string | null
          keywords?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          user_id: string
          id: string
          name: string
          aliases: string[] | null
          category_id: string | null
          review_status: 'pending' | 'uncategorized' | 'reviewed'
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          id?: string
          name: string
          aliases?: string[] | null
          category_id?: string | null
          review_status?: 'pending' | 'uncategorized' | 'reviewed'
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          id?: string
          name?: string
          aliases?: string[] | null
          category_id?: string | null
          review_status?: 'pending' | 'uncategorized' | 'reviewed'
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ticket_items: {
        Row: {
          id: string
          ticket_id: string
          product_id: string | null
          name: string
          quantity: number
          unit_price: number | null
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          product_id?: string | null
          name: string
          quantity?: number
          unit_price?: number | null
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          product_id?: string | null
          name?: string
          quantity?: number
          unit_price?: number | null
          total_price?: number
          created_at?: string
        }
      }
      shopping_lists: {
        Row: {
          id: string
          owner_id: string
          supermarket_id: string | null
          name: string
          description: string | null
          is_active: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          supermarket_id?: string | null
          name?: string
          description?: string | null
          is_active?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          supermarket_id?: string | null
          name?: string
          description?: string | null
          is_active?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      shopping_list_items: {
        Row: {
          id: string
          list_id: string
          product_id: string | null
          name: string
          quantity: number
          weight: number | null
          actual_price: number | null
          estimated_price: number | null
          notes: string | null
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          product_id?: string | null
          name: string
          quantity?: number
          weight?: number | null
          actual_price?: number | null
          estimated_price?: number | null
          notes?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          product_id?: string | null
          name?: string
          quantity?: number
          weight?: number | null
          actual_price?: number | null
          estimated_price?: number | null
          notes?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      list_shares: {
        Row: {
          id: string
          list_id: string
          user_id: string
          can_edit: boolean
          can_share: boolean
          accepted: boolean
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          user_id: string
          can_edit?: boolean
          can_share?: boolean
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          user_id?: string
          can_edit?: boolean
          can_share?: boolean
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
