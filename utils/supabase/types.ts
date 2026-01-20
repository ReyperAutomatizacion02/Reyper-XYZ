export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            machines: {
                Row: {
                    color: string | null
                    created_at: string | null
                    id: string
                    name: string
                    status: string | null
                }
                Insert: {
                    color?: string | null
                    created_at?: string | null
                    id?: string
                    name: string
                    status?: string | null
                }
                Update: {
                    color?: string | null
                    created_at?: string | null
                    id?: string
                    name?: string
                    status?: string | null
                }
                Relationships: []
            }
            production_orders: {
                Row: {
                    created_at: string | null
                    genral_status: string | null
                    id: string
                    last_edited_at: string | null
                    material: string | null
                    material_confirmation: string | null
                    notion_id: string | null
                    part_code: string
                    part_name: string | null
                    project_id: string | null
                    quantity: number | null
                }
                Insert: {
                    created_at?: string | null
                    genral_status?: string | null
                    id?: string
                    last_edited_at?: string | null
                    material?: string | null
                    material_confirmation?: string | null
                    notion_id?: string | null
                    part_code: string
                    part_name?: string | null
                    project_id?: string | null
                    quantity?: number | null
                }
                Update: {
                    created_at?: string | null
                    genral_status?: string | null
                    id?: string
                    last_edited_at?: string | null
                    material?: string | null
                    material_confirmation?: string | null
                    notion_id?: string | null
                    part_name?: string | null
                    part_code?: string
                    project_id?: string | null
                    quantity?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "production_orders_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            projects: {
                Row: {
                    code: string
                    company: string | null
                    created_at: string | null
                    delivery_date: string | null
                    id: string
                    last_edited_at: string | null
                    name: string | null
                    notion_id: string | null
                    requestor: string | null
                    start_date: string | null
                    status: string | null
                }
                Insert: {
                    code: string
                    company?: string | null
                    created_at?: string | null
                    delivery_date?: string | null
                    id?: string
                    last_edited_at?: string | null
                    name?: string | null
                    notion_id?: string | null
                    requestor?: string | null
                    start_date?: string | null
                    status?: string | null
                }
                Update: {
                    code?: string
                    company?: string | null
                    created_at?: string | null
                    delivery_date?: string | null
                    id?: string
                    last_edited_at?: string | null
                    name?: string | null
                    notion_id?: string | null
                    requestor?: string | null
                    start_date?: string | null
                    status?: string | null
                }
                Relationships: []
            }
            scheduled_tasks: {
                Row: {
                    created_at: string | null
                    end_date: string | null
                    id: string
                    machine_id: string | null
                    order_id: string | null
                    start_date: string | null
                    status: string | null
                }
                Insert: {
                    created_at?: string | null
                    end_date?: string | null
                    id?: string
                    machine_id?: string | null
                    order_id?: string | null
                    start_date?: string | null
                    status?: string | null
                }
                Update: {
                    created_at?: string | null
                    end_date?: string | null
                    id?: string
                    machine_id?: string | null
                    order_id?: string | null
                    start_date?: string | null
                    status?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "scheduled_tasks_machine_id_fkey"
                        columns: ["machine_id"]
                        isOneToOne: false
                        referencedRelation: "machines"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "scheduled_tasks_order_id_fkey"
                        columns: ["order_id"]
                        isOneToOne: false
                        referencedRelation: "production_orders"
                        referencedColumns: ["id"]
                    }
                ]
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
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
