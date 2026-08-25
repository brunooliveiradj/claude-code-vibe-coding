export enum CampaignGoal {
  AWARENESS = "Awareness",
  ENGAGEMENT = "Engajamento",
  VENDAS = "Vendas",
  MISTO = "Misto"
}

export enum MediaStrategy {
  DISPLAY = "Display",
  VIDEO = "Video"
}

export interface CampaignState {
  // Campaign
  advertiserId: string;
  advertiserName: string;
  campaignName: string;
  objective: CampaignGoal | "";
  startDate: string;
  endDate: string;
  budget: number | "";
  paymentModel: "PREPAID" | "POSTPAID";

  // Package (group)
  groupName: string;
  groupDurationSame: boolean;
  groupStartDate: string;
  groupEndDate: string;
  groupBudget: number | "";
  cpcBidAutomatic: boolean;
  cpcBid: number;
  cpmBidAutomatic: boolean;
  cpmBid: number;

  // Line (strategy/targeting)
  lineName: string;
  strategy: MediaStrategy | "";
  geoMode: "region" | "radius";
  targetStateIds: string[];   // UUIDs of states
  targetCityIds: string[];
  radiusAddress: string;
  radiusKm: number;

  genders: string[];          // "Masculino" | "Feminino" | "Desconhecido"
  ageRanges: string[];        // ["18", "25", "35", "45", "55", "65+"]
  devices: string[];
  environments: string[];

  keywords: string[];
  broadAudienceIds: string[];     // UUIDs of google/affinity audiences
  segmentedAudienceIds: string[]; // UUIDs of 3rd-party audiences
  customAudienceRequested: boolean;
  customAudienceText: string;

  siteBlocklist: string[];
  siteWhitelist: string[];

  frequencyLimitEnabled: boolean;
  frequencyLimitImpressions: number | "";
  frequencyLimitPeriod: string;

  lookalike: boolean;

  // Creatives
  creativesMode: "existing" | "new";
  selectedCreatives: string[]; // UUIDs

  // Pixel
  pixelMode: "select" | "create";
  selectedPixelIds: string[];  // UUIDs (array)
  newPixelName: string;
  newPixelType: "conversion" | "retargeting";

  isDraft: boolean;
}

export interface WizardMessage {
  id: string;
  type: "ai-text" | "user-text" | "step-active" | "step-done";
  text?: string;
  step?: number;
  summary?: string;
}
