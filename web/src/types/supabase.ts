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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      box_degustazione: {
        Row: {
          attivo: boolean
          descrizione: string | null
          id: number
          nome: string
          prezzo_consulente: number
          prezzo_pubblico: number
          pv_valore: number
        }
        Insert: {
          attivo?: boolean
          descrizione?: string | null
          id?: number
          nome: string
          prezzo_consulente: number
          prezzo_pubblico: number
          pv_valore?: number
        }
        Update: {
          attivo?: boolean
          descrizione?: string | null
          id?: number
          nome?: string
          prezzo_consulente?: number
          prezzo_pubblico?: number
          pv_valore?: number
        }
        Relationships: []
      }
      box_degustazione_righe: {
        Row: {
          box_id: number
          id: number
          prodotto_id: number
          quantita: number
        }
        Insert: {
          box_id: number
          id?: number
          prodotto_id: number
          quantita?: number
        }
        Update: {
          box_id?: number
          id?: number
          prodotto_id?: number
          quantita?: number
        }
        Relationships: [
          {
            foreignKeyName: "box_degustazione_righe_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "box_degustazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "box_degustazione_righe_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
      candidature: {
        Row: {
          cognome: string
          created_at: string
          email: string
          id: number
          motivazione: string | null
          nome: string
          note_admin: string | null
          sponsor_referral_code: string | null
          stato: Database["public"]["Enums"]["stato_candidatura"]
          telefono: string | null
        }
        Insert: {
          cognome: string
          created_at?: string
          email: string
          id?: number
          motivazione?: string | null
          nome: string
          note_admin?: string | null
          sponsor_referral_code?: string | null
          stato?: Database["public"]["Enums"]["stato_candidatura"]
          telefono?: string | null
        }
        Update: {
          cognome?: string
          created_at?: string
          email?: string
          id?: number
          motivazione?: string | null
          nome?: string
          note_admin?: string | null
          sponsor_referral_code?: string | null
          stato?: Database["public"]["Enums"]["stato_candidatura"]
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidature_sponsor_referral_code_fkey"
            columns: ["sponsor_referral_code"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["link_referral"]
          },
        ]
      }
      cantina_personale: {
        Row: {
          data_aggiunta: string
          data_consumo: string | null
          id: number
          in_wishlist: boolean
          nota_degustazione: string | null
          occasione: string | null
          prodotto_id: number
          punteggio_personale: number | null
          quantita: number
          stato: Database["public"]["Enums"]["stato_cantina_personale"]
          utente_id: number
          utente_tipo: string
        }
        Insert: {
          data_aggiunta?: string
          data_consumo?: string | null
          id?: number
          in_wishlist?: boolean
          nota_degustazione?: string | null
          occasione?: string | null
          prodotto_id: number
          punteggio_personale?: number | null
          quantita?: number
          stato?: Database["public"]["Enums"]["stato_cantina_personale"]
          utente_id: number
          utente_tipo: string
        }
        Update: {
          data_aggiunta?: string
          data_consumo?: string | null
          id?: number
          in_wishlist?: boolean
          nota_degustazione?: string | null
          occasione?: string | null
          prodotto_id?: number
          punteggio_personale?: number | null
          quantita?: number
          stato?: Database["public"]["Enums"]["stato_cantina_personale"]
          utente_id?: number
          utente_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cantina_personale_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
      cantine_fornitrici: {
        Row: {
          attiva: boolean
          created_at: string
          email: string | null
          id: number
          indirizzo: string | null
          nome: string
          note: string | null
          referente: string | null
          regione_id: number
          telefono: string | null
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          email?: string | null
          id?: number
          indirizzo?: string | null
          nome: string
          note?: string | null
          referente?: string | null
          regione_id: number
          telefono?: string | null
        }
        Update: {
          attiva?: boolean
          created_at?: string
          email?: string | null
          id?: number
          indirizzo?: string | null
          nome?: string
          note?: string | null
          referente?: string | null
          regione_id?: number
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cantine_fornitrici_regione_id_fkey"
            columns: ["regione_id"]
            isOneToOne: false
            referencedRelation: "regioni"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          cognome: string
          created_at: string
          data_primo_acquisto: string | null
          email: string | null
          gdpr_consenso: boolean
          gdpr_data_consenso: string | null
          id: number
          incaricato_id: number | null
          nome: string
          note: string | null
          segmento: string | null
          telefono: string | null
        }
        Insert: {
          cognome: string
          created_at?: string
          data_primo_acquisto?: string | null
          email?: string | null
          gdpr_consenso?: boolean
          gdpr_data_consenso?: string | null
          id?: number
          incaricato_id?: number | null
          nome: string
          note?: string | null
          segmento?: string | null
          telefono?: string | null
        }
        Update: {
          cognome?: string
          created_at?: string
          data_primo_acquisto?: string | null
          email?: string | null
          gdpr_consenso?: boolean
          gdpr_data_consenso?: string | null
          id?: number
          incaricato_id?: number | null
          nome?: string
          note?: string | null
          segmento?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clienti_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
        ]
      }
      eventi: {
        Row: {
          created_at: string
          data: string
          id: number
          incaricato_id: number
          luogo: string | null
          note: string | null
          partecipanti_effettivi: number | null
          partecipanti_previsti: number | null
          tipo: Database["public"]["Enums"]["tipo_evento"]
        }
        Insert: {
          created_at?: string
          data: string
          id?: number
          incaricato_id: number
          luogo?: string | null
          note?: string | null
          partecipanti_effettivi?: number | null
          partecipanti_previsti?: number | null
          tipo?: Database["public"]["Enums"]["tipo_evento"]
        }
        Update: {
          created_at?: string
          data?: string
          id?: number
          incaricato_id?: number
          luogo?: string | null
          note?: string | null
          partecipanti_effettivi?: number | null
          partecipanti_previsti?: number | null
          tipo?: Database["public"]["Enums"]["tipo_evento"]
        }
        Relationships: [
          {
            foreignKeyName: "eventi_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
        ]
      }
      eventi_partecipanti: {
        Row: {
          evento_id: number
          id: number
          ordine_post_evento_id: number | null
          riferimento_id: number
          stato: Database["public"]["Enums"]["stato_partecipante"]
          tipo_partecipante: string
        }
        Insert: {
          evento_id: number
          id?: number
          ordine_post_evento_id?: number | null
          riferimento_id: number
          stato?: Database["public"]["Enums"]["stato_partecipante"]
          tipo_partecipante: string
        }
        Update: {
          evento_id?: number
          id?: number
          ordine_post_evento_id?: number | null
          riferimento_id?: number
          stato?: Database["public"]["Enums"]["stato_partecipante"]
          tipo_partecipante?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventi_partecipanti_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_partecipanti_ordine_post_evento_id_fkey"
            columns: ["ordine_post_evento_id"]
            isOneToOne: false
            referencedRelation: "ordini"
            referencedColumns: ["id"]
          },
        ]
      }
      incaricati: {
        Row: {
          approvato_da: number | null
          approvato_il: string | null
          attivo: boolean
          auth_user_id: string | null
          bio: string | null
          candidatura_id: number | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          data_iscrizione: string
          data_ultimo_status_change: string | null
          email: string
          formazione_completata: boolean
          foto_url: string | null
          gv_mese_corrente: number
          id: number
          link_referral: string | null
          messaggio_referral: string | null
          nome: string
          pv_mese_corrente: number
          ruolo: Database["public"]["Enums"]["ruolo_utente"]
          specialita: string | null
          sponsor_id: number | null
          stato_account: Database["public"]["Enums"]["stato_account_incaricato"]
          status: Database["public"]["Enums"]["status_incaricato"]
          status_max: Database["public"]["Enums"]["status_incaricato"]
          stripe_account_id: string | null
          telefono: string | null
        }
        Insert: {
          approvato_da?: number | null
          approvato_il?: string | null
          attivo?: boolean
          auth_user_id?: string | null
          bio?: string | null
          candidatura_id?: number | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          data_iscrizione?: string
          data_ultimo_status_change?: string | null
          email: string
          formazione_completata?: boolean
          foto_url?: string | null
          gv_mese_corrente?: number
          id?: number
          link_referral?: string | null
          messaggio_referral?: string | null
          nome: string
          pv_mese_corrente?: number
          ruolo?: Database["public"]["Enums"]["ruolo_utente"]
          specialita?: string | null
          sponsor_id?: number | null
          stato_account?: Database["public"]["Enums"]["stato_account_incaricato"]
          status?: Database["public"]["Enums"]["status_incaricato"]
          status_max?: Database["public"]["Enums"]["status_incaricato"]
          stripe_account_id?: string | null
          telefono?: string | null
        }
        Update: {
          approvato_da?: number | null
          approvato_il?: string | null
          attivo?: boolean
          auth_user_id?: string | null
          bio?: string | null
          candidatura_id?: number | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          data_iscrizione?: string
          data_ultimo_status_change?: string | null
          email?: string
          formazione_completata?: boolean
          foto_url?: string | null
          gv_mese_corrente?: number
          id?: number
          link_referral?: string | null
          messaggio_referral?: string | null
          nome?: string
          pv_mese_corrente?: number
          ruolo?: Database["public"]["Enums"]["ruolo_utente"]
          specialita?: string | null
          sponsor_id?: number | null
          stato_account?: Database["public"]["Enums"]["stato_account_incaricato"]
          status?: Database["public"]["Enums"]["status_incaricato"]
          status_max?: Database["public"]["Enums"]["status_incaricato"]
          stripe_account_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consulenti_approvato_da_fkey"
            columns: ["approvato_da"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulenti_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incaricati_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "candidature"
            referencedColumns: ["id"]
          },
        ]
      }
      incaricato_vini_preferiti: {
        Row: {
          incaricato_id: number
          ordine: number
          prodotto_id: number
        }
        Insert: {
          incaricato_id: number
          ordine?: number
          prodotto_id: number
        }
        Update: {
          incaricato_id?: number
          ordine?: number
          prodotto_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "consulente_vini_preferiti_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulente_vini_preferiti_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
      interazioni_crm: {
        Row: {
          data: string
          esito: string | null
          id: number
          incaricato_id: number
          note: string | null
          soggetto_id: number
          tipo_interazione: string
          tipo_soggetto: string
        }
        Insert: {
          data?: string
          esito?: string | null
          id?: number
          incaricato_id: number
          note?: string | null
          soggetto_id: number
          tipo_interazione: string
          tipo_soggetto: string
        }
        Update: {
          data?: string
          esito?: string | null
          id?: number
          incaricato_id?: number
          note?: string | null
          soggetto_id?: number
          tipo_interazione?: string
          tipo_soggetto?: string
        }
        Relationships: [
          {
            foreignKeyName: "interazioni_crm_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
        ]
      }
      lead: {
        Row: {
          cognome: string | null
          convertito_cliente_id: number | null
          convertito_incaricato_id: number | null
          created_at: string
          data_contatto: string
          email: string | null
          fonte: string | null
          id: number
          incaricato_id: number | null
          nome: string | null
          note: string | null
          stato_funnel: Database["public"]["Enums"]["stato_funnel_lead"]
          telefono: string | null
        }
        Insert: {
          cognome?: string | null
          convertito_cliente_id?: number | null
          convertito_incaricato_id?: number | null
          created_at?: string
          data_contatto?: string
          email?: string | null
          fonte?: string | null
          id?: number
          incaricato_id?: number | null
          nome?: string | null
          note?: string | null
          stato_funnel?: Database["public"]["Enums"]["stato_funnel_lead"]
          telefono?: string | null
        }
        Update: {
          cognome?: string | null
          convertito_cliente_id?: number | null
          convertito_incaricato_id?: number | null
          created_at?: string
          data_contatto?: string
          email?: string | null
          fonte?: string | null
          id?: number
          incaricato_id?: number | null
          nome?: string | null
          note?: string | null
          stato_funnel?: Database["public"]["Enums"]["stato_funnel_lead"]
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_convertito_cliente_id_fkey"
            columns: ["convertito_cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_convertito_consulente_id_fkey"
            columns: ["convertito_incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
        ]
      }
      magazzino_consulente: {
        Row: {
          data_ultima_uscita: string | null
          data_ultimo_carico: string | null
          id: number
          incaricato_id: number
          prodotto_id: number
          quantita_disponibile: number
          quantita_riservata: number
          scorta_minima: number
        }
        Insert: {
          data_ultima_uscita?: string | null
          data_ultimo_carico?: string | null
          id?: number
          incaricato_id: number
          prodotto_id: number
          quantita_disponibile?: number
          quantita_riservata?: number
          scorta_minima?: number
        }
        Update: {
          data_ultima_uscita?: string | null
          data_ultimo_carico?: string | null
          id?: number
          incaricato_id?: number
          prodotto_id?: number
          quantita_disponibile?: number
          quantita_riservata?: number
          scorta_minima?: number
        }
        Relationships: [
          {
            foreignKeyName: "magazzino_consulente_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazzino_consulente_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_magazzino: {
        Row: {
          data: string
          id: number
          magazzino_id: number
          note: string | null
          origine: Database["public"]["Enums"]["origine_magazzino"] | null
          quantita: number
          riferimento_id: number | null
          riferimento_tipo: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento_magazzino"]
        }
        Insert: {
          data?: string
          id?: number
          magazzino_id: number
          note?: string | null
          origine?: Database["public"]["Enums"]["origine_magazzino"] | null
          quantita: number
          riferimento_id?: number | null
          riferimento_tipo?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento_magazzino"]
        }
        Update: {
          data?: string
          id?: number
          magazzino_id?: number
          note?: string | null
          origine?: Database["public"]["Enums"]["origine_magazzino"] | null
          quantita?: number
          riferimento_id?: number | null
          riferimento_tipo?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimento_magazzino"]
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_magazzino_magazzino_id_fkey"
            columns: ["magazzino_id"]
            isOneToOne: false
            referencedRelation: "magazzino_consulente"
            referencedColumns: ["id"]
          },
        ]
      }
      ordini: {
        Row: {
          cliente_id: number | null
          created_at: string
          data: string
          id: number
          incaricato_id: number
          indirizzo_spedizione: string | null
          note: string | null
          pv_generati: number
          stato: Database["public"]["Enums"]["stato_ordine"]
          stripe_payment_id: string | null
          tipo: Database["public"]["Enums"]["tipo_ordine"]
          totale: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string
          data?: string
          id?: number
          incaricato_id: number
          indirizzo_spedizione?: string | null
          note?: string | null
          pv_generati?: number
          stato?: Database["public"]["Enums"]["stato_ordine"]
          stripe_payment_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ordine"]
          totale?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: number | null
          created_at?: string
          data?: string
          id?: number
          incaricato_id?: number
          indirizzo_spedizione?: string | null
          note?: string | null
          pv_generati?: number
          stato?: Database["public"]["Enums"]["stato_ordine"]
          stripe_payment_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ordine"]
          totale?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordini_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
        ]
      }
      ordini_righe: {
        Row: {
          id: number
          ordine_id: number
          prezzo_unitario: number
          prodotto_id: number
          pv_riga: number
          quantita: number
        }
        Insert: {
          id?: number
          ordine_id: number
          prezzo_unitario: number
          prodotto_id: number
          pv_riga?: number
          quantita: number
        }
        Update: {
          id?: number
          ordine_id?: number
          prezzo_unitario?: number
          prodotto_id?: number
          pv_riga?: number
          quantita?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordini_righe_ordine_id_fkey"
            columns: ["ordine_id"]
            isOneToOne: false
            referencedRelation: "ordini"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordini_righe_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti: {
        Row: {
          abbinamenti: string | null
          alcol: number
          annata: number | null
          cantina_fornitrice_id: number | null
          costo_fornitore: number | null
          created_at: string
          denominazione: Database["public"]["Enums"]["denominazione_vino"]
          disponibile: boolean
          id: number
          nome: string
          prezzo_consulente: number
          prezzo_pubblico: number
          pv_valore: number
          regione_id: number
          scheda_narrativa: string | null
          temp_servizio_max: number
          temp_servizio_min: number
          tipo: Database["public"]["Enums"]["tipo_vino"]
        }
        Insert: {
          abbinamenti?: string | null
          alcol: number
          annata?: number | null
          cantina_fornitrice_id?: number | null
          costo_fornitore?: number | null
          created_at?: string
          denominazione: Database["public"]["Enums"]["denominazione_vino"]
          disponibile?: boolean
          id?: number
          nome: string
          prezzo_consulente: number
          prezzo_pubblico: number
          pv_valore?: number
          regione_id: number
          scheda_narrativa?: string | null
          temp_servizio_max: number
          temp_servizio_min: number
          tipo: Database["public"]["Enums"]["tipo_vino"]
        }
        Update: {
          abbinamenti?: string | null
          alcol?: number
          annata?: number | null
          cantina_fornitrice_id?: number | null
          costo_fornitore?: number | null
          created_at?: string
          denominazione?: Database["public"]["Enums"]["denominazione_vino"]
          disponibile?: boolean
          id?: number
          nome?: string
          prezzo_consulente?: number
          prezzo_pubblico?: number
          pv_valore?: number
          regione_id?: number
          scheda_narrativa?: string | null
          temp_servizio_max?: number
          temp_servizio_min?: number
          tipo?: Database["public"]["Enums"]["tipo_vino"]
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_cantina_fornitrice_id_fkey"
            columns: ["cantina_fornitrice_id"]
            isOneToOne: false
            referencedRelation: "cantine_fornitrici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prodotti_regione_id_fkey"
            columns: ["regione_id"]
            isOneToOne: false
            referencedRelation: "regioni"
            referencedColumns: ["id"]
          },
        ]
      }
      provvigioni_mensili: {
        Row: {
          anno: number
          bonus_car: number
          cab_bonus: number
          data_calcolo: string
          data_pagamento: string | null
          era_attivo: boolean
          global_pool: number
          gv_mese: number
          id: number
          incaricato_id: number
          mese: number
          provvigione_personale: number
          pv_mese: number
          reddito_residuale: number
          residuale_dettaglio: Json | null
          stato: Database["public"]["Enums"]["stato_pagamento_prov"]
          status_al_calcolo: Database["public"]["Enums"]["status_incaricato"]
          totale: number
        }
        Insert: {
          anno: number
          bonus_car?: number
          cab_bonus?: number
          data_calcolo?: string
          data_pagamento?: string | null
          era_attivo?: boolean
          global_pool?: number
          gv_mese?: number
          id?: number
          incaricato_id: number
          mese: number
          provvigione_personale?: number
          pv_mese?: number
          reddito_residuale?: number
          residuale_dettaglio?: Json | null
          stato?: Database["public"]["Enums"]["stato_pagamento_prov"]
          status_al_calcolo: Database["public"]["Enums"]["status_incaricato"]
          totale?: number
        }
        Update: {
          anno?: number
          bonus_car?: number
          cab_bonus?: number
          data_calcolo?: string
          data_pagamento?: string | null
          era_attivo?: boolean
          global_pool?: number
          gv_mese?: number
          id?: number
          incaricato_id?: number
          mese?: number
          provvigione_personale?: number
          pv_mese?: number
          reddito_residuale?: number
          residuale_dettaglio?: Json | null
          stato?: Database["public"]["Enums"]["stato_pagamento_prov"]
          status_al_calcolo?: Database["public"]["Enums"]["status_incaricato"]
          totale?: number
        }
        Relationships: [
          {
            foreignKeyName: "provvigioni_mensili_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifiche: {
        Row: {
          cab_importo: number
          gv_min: number
          ha_bonus_car: boolean
          ha_global_pool: boolean
          provvigione_pers: number
          pv_min: number
          residuale_l1: number
          residuale_l2: number
          residuale_l3: number
          residuale_l4: number
          residuale_l5: number
          residuale_l6: number
          residuale_l7: number
          residuale_l8: number
          status: Database["public"]["Enums"]["status_incaricato"]
        }
        Insert: {
          cab_importo?: number
          gv_min?: number
          ha_bonus_car?: boolean
          ha_global_pool?: boolean
          provvigione_pers?: number
          pv_min?: number
          residuale_l1?: number
          residuale_l2?: number
          residuale_l3?: number
          residuale_l4?: number
          residuale_l5?: number
          residuale_l6?: number
          residuale_l7?: number
          residuale_l8?: number
          status: Database["public"]["Enums"]["status_incaricato"]
        }
        Update: {
          cab_importo?: number
          gv_min?: number
          ha_bonus_car?: boolean
          ha_global_pool?: boolean
          provvigione_pers?: number
          pv_min?: number
          residuale_l1?: number
          residuale_l2?: number
          residuale_l3?: number
          residuale_l4?: number
          residuale_l5?: number
          residuale_l6?: number
          residuale_l7?: number
          residuale_l8?: number
          status?: Database["public"]["Enums"]["status_incaricato"]
        }
        Relationships: []
      }
      regioni: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      storni_pv: {
        Row: {
          anno: number
          created_at: string
          id: number
          incaricato_id: number
          mese: number
          motivo: Database["public"]["Enums"]["motivo_storno"]
          note: string | null
          ordine_id: number
          pv_stornati: number
        }
        Insert: {
          anno: number
          created_at?: string
          id?: number
          incaricato_id: number
          mese: number
          motivo: Database["public"]["Enums"]["motivo_storno"]
          note?: string | null
          ordine_id: number
          pv_stornati: number
        }
        Update: {
          anno?: number
          created_at?: string
          id?: number
          incaricato_id?: number
          mese?: number
          motivo?: Database["public"]["Enums"]["motivo_storno"]
          note?: string | null
          ordine_id?: number
          pv_stornati?: number
        }
        Relationships: [
          {
            foreignKeyName: "storni_pv_consulente_id_fkey"
            columns: ["incaricato_id"]
            isOneToOne: false
            referencedRelation: "incaricati"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storni_pv_ordine_id_fkey"
            columns: ["ordine_id"]
            isOneToOne: false
            referencedRelation: "ordini"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_all_incaricati_full: {
        Args: never
        Returns: {
          approvato_da: number | null
          approvato_il: string | null
          attivo: boolean
          auth_user_id: string | null
          bio: string | null
          candidatura_id: number | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          data_iscrizione: string
          data_ultimo_status_change: string | null
          email: string
          formazione_completata: boolean
          foto_url: string | null
          gv_mese_corrente: number
          id: number
          link_referral: string | null
          messaggio_referral: string | null
          nome: string
          pv_mese_corrente: number
          ruolo: Database["public"]["Enums"]["ruolo_utente"]
          specialita: string | null
          sponsor_id: number | null
          stato_account: Database["public"]["Enums"]["stato_account_incaricato"]
          status: Database["public"]["Enums"]["status_incaricato"]
          status_max: Database["public"]["Enums"]["status_incaricato"]
          stripe_account_id: string | null
          telefono: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "incaricati"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_incaricato_full: {
        Args: { p_incaricato_id: number }
        Returns: {
          approvato_da: number | null
          approvato_il: string | null
          attivo: boolean
          auth_user_id: string | null
          bio: string | null
          candidatura_id: number | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          data_iscrizione: string
          data_ultimo_status_change: string | null
          email: string
          formazione_completata: boolean
          foto_url: string | null
          gv_mese_corrente: number
          id: number
          link_referral: string | null
          messaggio_referral: string | null
          nome: string
          pv_mese_corrente: number
          ruolo: Database["public"]["Enums"]["ruolo_utente"]
          specialita: string | null
          sponsor_id: number | null
          stato_account: Database["public"]["Enums"]["stato_account_incaricato"]
          status: Database["public"]["Enums"]["status_incaricato"]
          status_max: Database["public"]["Enums"]["status_incaricato"]
          stripe_account_id: string | null
          telefono: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "incaricati"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      aggiorna_profilo_incaricato: {
        Args: {
          p_bio: string
          p_foto_url?: string
          p_messaggio_referral: string
          p_specialita: string
        }
        Returns: undefined
      }
      aggiungi_cliente_incaricato: {
        Args: {
          p_cognome: string
          p_email: string
          p_nome: string
          p_telefono: string
        }
        Returns: number
      }
      candida_incaricato: {
        Args: {
          p_cognome: string
          p_email: string
          p_motivazione: string
          p_nome: string
          p_referral_code: string
          p_telefono: string
        }
        Returns: number
      }
      crea_ordine_incaricato: {
        Args: { p_cliente_id: number; p_righe: Json; p_tipo: string }
        Returns: number
      }
      current_incaricato_id: { Args: never; Returns: number }
      current_is_admin: { Args: never; Returns: boolean }
      get_admin_incaricati: {
        Args: { p_anno: number; p_mese: number }
        Returns: {
          attivo: boolean
          cognome: string
          data_iscrizione: string
          gv_mese: number
          id: number
          nome: string
          pv_mese: number
          ruolo: string
          sponsor_cognome: string
          sponsor_nome: string
          status: string
        }[]
      }
      get_admin_kpi: {
        Args: { p_anno: number; p_mese: number }
        Returns: {
          fatturato_mese: number
          incaricati_attivi: number
          nuovi_iscritti: number
          ordini_mese: number
        }[]
      }
      get_admin_top_incaricati: {
        Args: { p_anno: number; p_limit?: number; p_mese: number }
        Returns: {
          cognome: string
          id: number
          nome: string
          pv_mese: number
          status: string
        }[]
      }
      get_admin_trend: {
        Args: { p_mesi?: number }
        Returns: {
          anno: number
          fatturato: number
          mese: number
          n_ordini: number
        }[]
      }
      get_clienti_incaricato: {
        Args: { p_incaricato_id: number }
        Returns: {
          cognome: string
          data_primo_acquisto: string
          email: string
          id: number
          n_ordini: number
          nome: string
          segmento: string
          telefono: string
          totale_speso: number
          ultimo_ordine: string
        }[]
      }
      get_dashboard_incaricato: {
        Args: { p_anno: number; p_incaricato_id: number; p_mese: number }
        Returns: {
          cognome: string
          fatturato_mese: number
          guadagno_personale: number
          guadagno_totale: number
          gv_l1: number
          gv_l2: number
          gv_l3: number
          gv_l4: number
          gv_l5: number
          gv_l6: number
          gv_l7: number
          gv_l8: number
          gv_mese: number
          gv_min: number
          gv_prossimo: number
          nome: string
          provvigione_pers: number
          pv_mese: number
          pv_min: number
          reddito_residuale: number
          status: string
          status_max: string
        }[]
      }
      get_incaricato_by_referral: {
        Args: { p_code: string }
        Returns: {
          bio: string
          cognome: string
          foto_url: string
          id: number
          messaggio_referral: string
          nome: string
          specialita: string
          status: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          approvato_da: number | null
          approvato_il: string | null
          attivo: boolean
          auth_user_id: string | null
          bio: string | null
          candidatura_id: number | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          data_iscrizione: string
          data_ultimo_status_change: string | null
          email: string
          formazione_completata: boolean
          foto_url: string | null
          gv_mese_corrente: number
          id: number
          link_referral: string | null
          messaggio_referral: string | null
          nome: string
          pv_mese_corrente: number
          ruolo: Database["public"]["Enums"]["ruolo_utente"]
          specialita: string | null
          sponsor_id: number | null
          stato_account: Database["public"]["Enums"]["stato_account_incaricato"]
          status: Database["public"]["Enums"]["status_incaricato"]
          status_max: Database["public"]["Enums"]["status_incaricato"]
          stripe_account_id: string | null
          telefono: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "incaricati"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_team_incaricato: {
        Args: { p_anno: number; p_incaricato_id: number; p_mese: number }
        Returns: {
          cognome: string
          id: number
          livello: number
          nome: string
          pv_mese: number
          pv_min: number
          sponsor_id: number
          status: string
        }[]
      }
      set_referral_code: { Args: { p_code: string }; Returns: undefined }
      set_vini_preferiti: {
        Args: { p_prodotto_ids: number[] }
        Returns: undefined
      }
    }
    Enums: {
      denominazione_vino: "DOP" | "DOCG" | "DOC" | "IGT"
      motivo_storno: "reso_14gg" | "reso_goodwill" | "annullamento"
      origine_magazzino:
        | "ACQUISTO_PERSONALE"
        | "CAMPIONE_GRATUITO"
        | "OMAGGIO_PROMO"
        | "STARTER_KIT"
      ruolo_utente: "incaricato" | "admin"
      stato_account_incaricato:
        | "attivo"
        | "sospeso"
        | "dormiente"
        | "cancellato"
      stato_candidatura: "in_attesa" | "approvata" | "rifiutata"
      stato_cantina_personale: "IN_CANTINA" | "CONSUMATA" | "REGALATA"
      stato_funnel_lead:
        | "nuovo"
        | "contattato"
        | "invitato_serata"
        | "partecipato_serata"
        | "cliente"
        | "incaricato"
        | "perso"
      stato_ordine:
        | "nuovo"
        | "pagato"
        | "in_preparazione"
        | "spedito"
        | "consegnato"
        | "annullato"
        | "reso"
      stato_pagamento_prov: "calcolato" | "approvato" | "pagato" | "sospeso"
      stato_partecipante: "invitato" | "confermato" | "presente" | "assente"
      status_incaricato:
        | "STARTER"
        | "APPRENTICE"
        | "ADVISOR"
        | "SUPERVISOR"
        | "TEAM_COORDINATOR"
        | "MANAGER"
        | "DIRECTOR"
        | "AMBASSADOR"
        | "GOLDEN"
      tipo_evento:
        | "serata_degustazione"
        | "wine_party"
        | "webinar"
        | "formazione"
      tipo_movimento_magazzino:
        | "CARICO"
        | "VENDITA"
        | "DEGUSTAZIONE"
        | "OMAGGIO"
        | "RESO"
        | "ROTTURA"
        | "AUTOCONSUMO"
      tipo_ordine: "vendita" | "autoconsumo" | "b2b"
      tipo_vino: "rosso" | "bianco" | "rosato" | "spumante"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      denominazione_vino: ["DOP", "DOCG", "DOC", "IGT"],
      motivo_storno: ["reso_14gg", "reso_goodwill", "annullamento"],
      origine_magazzino: [
        "ACQUISTO_PERSONALE",
        "CAMPIONE_GRATUITO",
        "OMAGGIO_PROMO",
        "STARTER_KIT",
      ],
      ruolo_utente: ["incaricato", "admin"],
      stato_account_incaricato: [
        "attivo",
        "sospeso",
        "dormiente",
        "cancellato",
      ],
      stato_candidatura: ["in_attesa", "approvata", "rifiutata"],
      stato_cantina_personale: ["IN_CANTINA", "CONSUMATA", "REGALATA"],
      stato_funnel_lead: [
        "nuovo",
        "contattato",
        "invitato_serata",
        "partecipato_serata",
        "cliente",
        "incaricato",
        "perso",
      ],
      stato_ordine: [
        "nuovo",
        "pagato",
        "in_preparazione",
        "spedito",
        "consegnato",
        "annullato",
        "reso",
      ],
      stato_pagamento_prov: ["calcolato", "approvato", "pagato", "sospeso"],
      stato_partecipante: ["invitato", "confermato", "presente", "assente"],
      status_incaricato: [
        "STARTER",
        "APPRENTICE",
        "ADVISOR",
        "SUPERVISOR",
        "TEAM_COORDINATOR",
        "MANAGER",
        "DIRECTOR",
        "AMBASSADOR",
        "GOLDEN",
      ],
      tipo_evento: [
        "serata_degustazione",
        "wine_party",
        "webinar",
        "formazione",
      ],
      tipo_movimento_magazzino: [
        "CARICO",
        "VENDITA",
        "DEGUSTAZIONE",
        "OMAGGIO",
        "RESO",
        "ROTTURA",
        "AUTOCONSUMO",
      ],
      tipo_ordine: ["vendita", "autoconsumo", "b2b"],
      tipo_vino: ["rosso", "bianco", "rosato", "spumante"],
    },
  },
} as const
