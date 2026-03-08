export interface ShlokaEntry {
  index: number;
  ref?: string;
  shlokaText: string;
  romanText?: string;
  wordMeaning: string;
  translation: string;
  purport: string;
}

export interface ShlokaData {
  shlokas: ShlokaEntry[];
  locale: string;
}
