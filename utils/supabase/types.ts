export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            machines: {
                Row: {
                    created_at: string | null
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    name: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            planning: {
                Row: {
                    check_in: string | null
                    check_out: string | null
                    created_at: string | null
                    id: string
                    last_edited_at: string | null
                    locked: boolean | null
                    machine: string | null
                    notion_id: string | null
                    operator: string | null
                    order_id: string | null
                    planned_date: string | null
                    planned_end: string | null
                    register: string | null
                }
                Insert: {
                    check_in?: string | null
                    check_out?: string | null
                    created_at?: string | null
                    id?: string
                    last_edited_at?: string | null
                    locked?: boolean | null
                    machine?: string | null
                    notion_id?: string | null
                    operator?: string | null
                    order_id?: string | null
                    planned_date?: string | null
                    planned_end?: string | null
                    register?: string | null
                }
                Update: {
                    check_in?: string | null
                    check_out?: string | null
                    created_at?: string | null
                    id?: string
                    last_edited_at?: string | null
                    locked?: boolean | null
                    machine?: string | null
                    notion_id?: string | null
                    operator?: string | null
                    order_id?: string | null
                    planned_date?: string | null
                    planned_end?: string | null
                    register?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "planning_order_id_fkey"
                        columns: ["order_id"]
                        isOneToOne: false
                        referencedRelation: "production_orders"
                        referencedColumns: ["id"]
                    },
                ]
            }
            planning_scenarios: {
                Row: {
                    id: string
                    name: string
                    strategy: string
                    config: Json
                    tasks: Json
                    skipped: Json
                    metrics: Json
                    created_by: string | null
                    created_at: string
                    applied_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    strategy: string
                    config: Json
                    tasks: Json
                    skipped?: Json
                    metrics: Json
                    created_by?: string | null
                    created_at?: string
                    applied_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    strategy?: string
                    config?: Json
                    tasks?: Json
                    skipped?: Json
                    metrics?: Json
                    created_by?: string | null
                    created_at?: string
                    applied_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "planning_scenarios_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            production_orders: {
                Row: {
                    created_at: string | null
                    genral_status: string | null
                    id: string
                    image: string | null
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
                    image?: string | null
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
                    image?: string | null
                    last_edited_at?: string | null
                    material?: string | null
                    material_confirmation?: string | null
                    notion_id?: string | null
                    part_code?: string
                    part_name?: string | null
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
                    },
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
            sales_areas: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            sales_clients: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            sales_contacts: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            sales_positions: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            sales_quote_items: {
                Row: {
                    created_at: string
                    description: string
                    id: string
                    quantity: number | null
                    quote_id: string | null
                    sort_order: number | null
                    total_price: number | null
                    unit: string | null
                    unit_price: number | null
                }
                Insert: {
                    created_at?: string
                    description: string
                    id?: string
                    quantity?: number | null
                    quote_id?: string | null
                    sort_order?: number | null
                    total_price?: number | null
                    unit?: string | null
                    unit_price?: number | null
                }
                Update: {
                    created_at?: string
                    description?: string
                    id?: string
                    quantity?: number | null
                    quote_id?: string | null
                    sort_order?: number | null
                    total_price?: number | null
                    unit?: string | null
                    unit_price?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "sales_quote_items_quote_id_fkey"
                        columns: ["quote_id"]
                        isOneToOne: false
                        referencedRelation: "sales_quotes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sales_quotes: {
                Row: {
                    area_id: string | null
                    client_id: string | null
                    contact_id: string | null
                    created_at: string
                    currency: string | null
                    deleted_at: string | null
                    deleted_reason: string | null
                    delivery_date: string | null
                    id: string
                    issue_date: string | null
                    part_no: string | null
                    payment_terms_days: number | null
                    position_id: string | null
                    quote_as: string | null
                    quote_number: number | null
                    requisition_no: string | null
                    status: string | null
                    subtotal: number | null
                    tax_amount: number | null
                    tax_rate: number | null
                    total: number | null
                    updated_at: string
                    validity_days: number | null
                }
                Insert: {
                    area_id?: string | null
                    client_id?: string | null
                    contact_id?: string | null
                    created_at?: string
                    currency?: string | null
                    deleted_at?: string | null
                    deleted_reason?: string | null
                    delivery_date?: string | null
                    id?: string
                    issue_date?: string | null
                    part_no?: string | null
                    payment_terms_days?: number | null
                    position_id?: string | null
                    quote_as?: string | null
                    quote_number?: number | null
                    requisition_no?: string | null
                    status?: string | null
                    subtotal?: number | null
                    tax_amount?: number | null
                    tax_rate?: number | null
                    total?: number | null
                    updated_at?: string
                    validity_days?: number | null
                }
                Update: {
                    area_id?: string | null
                    client_id?: string | null
                    contact_id?: string | null
                    created_at?: string
                    currency?: string | null
                    deleted_at?: string | null
                    deleted_reason?: string | null
                    delivery_date?: string | null
                    id?: string
                    issue_date?: string | null
                    part_no?: string | null
                    payment_terms_days?: number | null
                    position_id?: string | null
                    quote_as?: string | null
                    quote_number?: number | null
                    requisition_no?: string | null
                    status?: string | null
                    subtotal?: number | null
                    tax_amount?: number | null
                    tax_rate?: number | null
                    total?: number | null
                    updated_at?: string
                    validity_days?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "sales_quotes_area_id_fkey"
                        columns: ["area_id"]
                        isOneToOne: false
                        referencedRelation: "sales_areas"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sales_quotes_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "sales_clients"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sales_quotes_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "sales_contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sales_quotes_position_id_fkey"
                        columns: ["position_id"]
                        isOneToOne: false
                        referencedRelation: "sales_positions"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sales_units: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                }
                Relationships: []
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

type PublicSchema = Database["public"]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
