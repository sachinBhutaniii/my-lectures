export type FastingUpto = "NOON" | "DUSK" | "MOON_RISE" | "NEXT_SUNRISE";

export const FASTING_UPTO_LABELS: Record<FastingUpto, string> = {
  NOON: "Noon",
  DUSK: "Dusk",
  MOON_RISE: "Moon rise",
  NEXT_SUNRISE: "Next sunrise",
};

export interface VaishnavaEvent {
  id: number;
  eventDate: string;       // YYYY-MM-DD
  eventName: string;
  description?: string;
  tithi?: string;
  fastingUpto?: FastingUpto;
  createdAt?: string;
}

export interface VaishnavaEventRequest {
  eventDate: string;
  eventName: string;
  description?: string;
  tithi?: string;
  fastingUpto?: FastingUpto;
}
