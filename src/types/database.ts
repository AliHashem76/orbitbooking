export type AppointmentStatus = "upcoming" | "completed" | "canceled";

export type Admin = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: string;
  trade_name: string;
  business_type: string;
  country: string;
  currency: string;
  timezone: string;
  username: string;
  password_hash: string;
  phone: string | null;
  slug: string;
  subscription_date: string;
  renewal_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicBusiness = Omit<Business, "password_hash" | "username">;

export type Service = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyHours = { start: string; end: string };

export type BreakPeriod = {
  start: string;
  end: string;
  label?: string;
};

export type BusinessSettings = {
  id: string;
  business_id: string;
  working_days: number[];
  daily_hours: DailyHours;
  breaks: BreakPeriod[];
  buffer_minutes: number;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  business_id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: Admin;
        Insert: Omit<Admin, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Admin>;
      };
      businesses: {
        Row: Business;
        Insert: Omit<
          Business,
          "id" | "created_at" | "updated_at" | "subscription_date" | "renewal_date"
        > & {
          id?: string;
          subscription_date?: string;
          renewal_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Business>;
      };
      services: {
        Row: Service;
        Insert: Omit<Service, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Service>;
      };
      business_settings: {
        Row: BusinessSettings;
        Insert: Omit<BusinessSettings, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<BusinessSettings>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Appointment>;
      };
    };
    Views: {
      public_businesses: {
        Row: PublicBusiness;
      };
    };
    Functions: {
      renew_business_subscription: {
        Args: { p_business_id: string };
        Returns: string;
      };
      create_public_appointment: {
        Args: {
          p_business_slug: string;
          p_service_id: string;
          p_client_name: string;
          p_client_phone: string;
          p_starts_at: string;
        };
        Returns: string;
      };
    };
    Enums: {
      appointment_status: AppointmentStatus;
    };
  };
};
