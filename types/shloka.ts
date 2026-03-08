export interface ShlokaEntry {
  index: number;
  shlokaText: string;
  wordMeaning: string;
  translation: string;
  purport: string;
}

export interface ShlokaData {
  shlokas: ShlokaEntry[];
  locale: string;
}
