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
            employees: {
                Row: {
                    created_at: string | null
                    department: string | null
                    employee_number: string | null
                    full_name: string
                    id: string
                    is_active: boolean | null
                    is_operator: boolean | null
                    position: string | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    department?: string | null
                    employee_number?: string | null
                    full_name: string
                    id?: string
                    is_active?: boolean | null
                    is_operator?: boolean | null
                    position?: string | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    department?: string | null
                    employee_number?: string | null
                    full_name?: string
                    id?: string
                    is_active?: boolean | null
                    is_operator?: boolean | null
                    position?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            inventory_items: {
                Row: {
                    category_name: string | null
                    category_prefix: string | null
                    created_at: string
                    description: string | null
                    id: string
                    key: string
                    last_updated_at: string
                    location: string | null
                    metadata: Json | null
                    min_stock: number
                    name: string
                    stock_quantity: number
                }
                Insert: {
                    category_name?: string | null
                    category_prefix?: string | null
                    created_at?: string
                    description?: string | null
                    id?: string
                    key: string
                    last_updated_at?: string
                    location?: string | null
                    metadata?: Json | null
                    min_stock?: number
                    name: string
                    stock_quantity?: number
                }
                Update: {
                    category_name?: string | null
                    category_prefix?: string | null
                    created_at?: string
                    description?: string | null
                    id?: string
                    key?: string
                    last_updated_at?: string
                    location?: string | null
                    metadata?: Json | null
                    min_stock?: number
                    name?: string
                    stock_quantity?: number
                }
                Relationships: []
            }
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
                    applied_at: string | null
                    config: Json
                    created_at: string
                    created_by: string | null
                    id: string
                    metrics: Json
                    name: string
                    skipped: Json
                    strategy: string
                    tasks: Json
                }
                Insert: {
                    applied_at?: string | null
                    config: Json
                    created_at?: string
                    created_by?: string | null
                    id?: string
                    metrics?: Json
                    name: string
                    skipped?: Json
                    strategy: string
                    tasks?: Json
                }
                Update: {
                    applied_at?: string | null
                    config?: Json
                    created_at?: string
                    created_by?: string | null
                    id?: string
                    metrics?: Json
                    name?: string
                    skipped?: Json
                    strategy?: string
                    tasks?: Json
                }
                Relationships: []
            }
            production_orders: {
                Row: {
                    created_at: string | null
                    description: string | null
                    design_no: string | null
                    drawing_url: string | null
                    evaluation: Json | null
                    genral_status: string | null
                    id: string
                    image: string | null
                    is_sub_item: boolean | null
                    last_edited_at: string | null
                    material: string | null
                    material_confirmation: string | null
                    material_id: string | null
                    model_url: string | null
                    notion_id: string | null
                    part_code: string
                    part_name: string | null
                    project_id: string | null
                    quantity: number | null
                    status_id: string | null
                    treatment: string | null
                    treatment_id: string | null
                    unit: string | null
                    urgencia: boolean | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    design_no?: string | null
                    drawing_url?: string | null
                    evaluation?: Json | null
                    genral_status?: string | null
                    id?: string
                    image?: string | null
                    is_sub_item?: boolean | null
                    last_edited_at?: string | null
                    material?: string | null
                    material_confirmation?: string | null
                    material_id?: string | null
                    model_url?: string | null
                    notion_id?: string | null
                    part_code: string
                    part_name?: string | null
                    project_id?: string | null
                    quantity?: number | null
                    status_id?: string | null
                    treatment?: string | null
                    treatment_id?: string | null
                    unit?: string | null
                    urgencia?: boolean | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    design_no?: string | null
                    drawing_url?: string | null
                    evaluation?: Json | null
                    genral_status?: string | null
                    id?: string
                    image?: string | null
                    is_sub_item?: boolean | null
                    last_edited_at?: string | null
                    material?: string | null
                    material_confirmation?: string | null
                    material_id?: string | null
                    model_url?: string | null
                    notion_id?: string | null
                    part_code?: string
                    part_name?: string | null
                    project_id?: string | null
                    quantity?: number | null
                    status_id?: string | null
                    treatment?: string | null
                    treatment_id?: string | null
                    unit?: string | null
                    urgencia?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "production_orders_material_id_fkey"
                        columns: ["material_id"]
                        isOneToOne: false
                        referencedRelation: "sales_materials"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "production_orders_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "production_orders_status_id_fkey"
                        columns: ["status_id"]
                        isOneToOne: false
                        referencedRelation: "production_statuses"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "production_orders_treatment_id_fkey"
                        columns: ["treatment_id"]
                        isOneToOne: false
                        referencedRelation: "production_treatments"
                        referencedColumns: ["id"]
                    },
                ]
            }
            production_statuses: {
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
            production_treatments: {
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
            projects: {
                Row: {
                    code: string
                    company: string | null
                    company_id: string | null
                    created_at: string | null
                    delivery_date: string | null
                    id: string
                    last_edited_at: string | null
                    name: string | null
                    notion_id: string | null
                    requestor: string | null
                    requestor_id: string | null
                    start_date: string | null
                    status: string | null
                }
                Insert: {
                    code: string
                    company?: string | null
                    company_id?: string | null
                    created_at?: string | null
                    delivery_date?: string | null
                    id?: string
                    last_edited_at?: string | null
                    name?: string | null
                    notion_id?: string | null
                    requestor?: string | null
                    requestor_id?: string | null
                    start_date?: string | null
                    status?: string | null
                }
                Update: {
                    code?: string
                    company?: string | null
                    company_id?: string | null
                    created_at?: string | null
                    delivery_date?: string | null
                    id?: string
                    last_edited_at?: string | null
                    name?: string | null
                    notion_id?: string | null
                    requestor?: string | null
                    requestor_id?: string | null
                    start_date?: string | null
                    status?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "projects_company_id_fkey"
                        columns: ["company_id"]
                        isOneToOne: false
                        referencedRelation: "sales_clients"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "projects_requestor_id_fkey"
                        columns: ["requestor_id"]
                        isOneToOne: false
                        referencedRelation: "sales_contacts"
                        referencedColumns: ["id"]
                    },
                ]
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
                    business_name: string | null
                    created_at: string
                    id: string
                    is_active: boolean | null
                    name: string
                    prefix: string | null
                }
                Insert: {
                    business_name?: string | null
                    created_at?: string
                    id?: string
                    is_active?: boolean | null
                    name: string
                    prefix?: string | null
                }
                Update: {
                    business_name?: string | null
                    created_at?: string
                    id?: string
                    is_active?: boolean | null
                    name: string
                    prefix?: string | null
                }
                Relationships: []
            }
            sales_contacts: {
                Row: {
                    client_id: string | null
                    created_at: string
                    id: string
                    is_active: boolean | null
                    name: string
                }
                Insert: {
                    client_id?: string | null
                    created_at?: string
                    id?: string
                    is_active?: boolean | null
                    name: string
                }
                Update: {
                    client_id?: string | null
                    created_at?: string
                    id?: string
                    is_active?: boolean | null
                    name?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "sales_contacts_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "sales_clients"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sales_materials: {
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
                    design_no: string | null
                    drawing_url: string | null
                    id: string
                    is_sub_item: boolean | null
                    material: string | null
                    material_id: string | null
                    part_name: string | null
                    quantity: number | null
                    quote_id: string | null
                    sort_order: number | null
                    total_price: number | null
                    treatment: string | null
                    treatment_id: string | null
                    unit: string | null
                    unit_price: number | null
                }
                Insert: {
                    created_at?: string
                    description: string
                    design_no?: string | null
                    drawing_url?: string | null
                    id?: string
                    is_sub_item?: boolean | null
                    material?: string | null
                    material_id?: string | null
                    part_name?: string | null
                    quantity?: number | null
                    quote_id?: string | null
                    sort_order?: number | null
                    total_price?: number | null
                    treatment?: string | null
                    treatment_id?: string | null
                    unit?: string | null
                    unit_price?: number | null
                }
                Update: {
                    created_at?: string
                    description: string
                    design_no?: string | null
                    drawing_url?: string | null
                    id?: string
                    is_sub_item?: boolean | null
                    material?: string | null
                    material_id?: string | null
                    part_name?: string | null
                    quantity?: number | null
                    quote_id?: string | null
                    sort_order?: number | null
                    total_price?: number | null
                    treatment?: string | null
                    treatment_id?: string | null
                    unit?: string | null
                    unit_price?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "sales_quote_items_material_id_fkey"
                        columns: ["material_id"]
                        isOneToOne: false
                        referencedRelation: "sales_materials"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sales_quote_items_quote_id_fkey"
                        columns: ["quote_id"]
                        isOneToOne: false
                        referencedRelation: "sales_quotes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sales_quote_items_treatment_id_fkey"
                        columns: ["treatment_id"]
                        isOneToOne: false
                        referencedRelation: "production_treatments"
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
                    is_converted: boolean | null
                    issue_date: string | null
                    part_no: string | null
                    payment_terms_days: number | null
                    position_id: string | null
                    project_id: string | null
                    quote_as: string | null
                    quote_number: number
                    quote_type: string | null
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
                    is_converted?: boolean | null
                    issue_date?: string | null
                    part_no?: string | null
                    payment_terms_days?: number | null
                    position_id?: string | null
                    project_id?: string | null
                    quote_as?: string | null
                    quote_number?: number
                    quote_type?: string | null
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
                    is_converted?: boolean | null
                    issue_date?: string | null
                    part_no?: string | null
                    payment_terms_days?: number | null
                    position_id?: string | null
                    project_id?: string | null
                    quote_as?: string | null
                    quote_number?: number
                    quote_type?: string | null
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
                    {
                        foreignKeyName: "sales_quotes_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
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
            system_updates: {
                Row: {
                    author_avatar: string | null
                    author_name: string | null
                    category: string | null
                    created_at: string | null
                    github_url: string | null
                    id: string
                    sha: string
                    summary: string | null
                    title: string
                }
                Insert: {
                    author_avatar?: string | null
                    author_name?: string | null
                    category?: string | null
                    created_at?: string | null
                    github_url?: string | null
                    id?: string
                    sha: string
                    summary?: string | null
                    title: string
                }
                Update: {
                    author_avatar?: string | null
                    author_name?: string | null
                    category?: string | null
                    created_at?: string | null
                    github_url?: string | null
                    id?: string
                    sha?: string
                    summary?: string | null
                    title?: string
                }
                Relationships: []
            }
            user_profiles: {
                Row: {
                    created_at: string | null
                    full_name: string | null
                    id: string
                    is_approved: boolean | null
                    operator_name: string | null
                    preferences: Json | null
                    roles: string[] | null
                    updated_at: string | null
                    username: string | null
                }
                Insert: {
                    created_at?: string | null
                    full_name?: string | null
                    id: string
                    is_approved?: boolean | null
                    operator_name?: string | null
                    preferences?: Json | null
                    roles?: string[] | null
                    updated_at?: string | null
                    username?: string | null
                }
                Update: {
                    created_at?: string | null
                    full_name?: string | null
                    id?: string
                    is_approved?: boolean | null
                    operator_name?: string | null
                    preferences?: Json | null
                    roles?: string[] | null
                    updated_at?: string | null
                    username?: string | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            is_admin: { Args: never; Returns: boolean }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
    public: {
        Enums: {},
    },
} as const
