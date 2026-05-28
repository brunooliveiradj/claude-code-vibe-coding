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
  objective: CampaignGoal | "";
  advertiserName: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  budget: number | "";

  groupName: string;
  groupDurationSame: boolean;
  groupStartDate: string;
  groupEndDate: string;
  groupBudget: number | "";
  cpcBidAutomatic: boolean;
  cpcBid: number;
  cpmBidAutomatic: boolean;
  cpmBid: number;

  strategy: MediaStrategy | "";
  geoMode: "region" | "radius";
  targetRegions: string[];
  radiusAddress: string;
  radiusKm: number;

  genders: string[];
  devices: string[];
  environments: string[];

  keywords: string[];
  broadAudiences: string[];
  segmentedAudiences: string[];
  customAudienceRequested: boolean;
  customAudienceText: string;

  siteBlocklist: string[];
  siteWhitelist: string[];

  frequencyLimitEnabled: boolean;
  frequencyLimitImpressions: number | "";
  frequencyLimitPeriod: string;

  lookalike: boolean;

  creativesMode: "existing" | "new";
  selectedCreatives: string[];

  pixelMode: "select" | "create";
  selectedPixelId: string;
  newPixelName: string;
  newPixelType: "conversion" | "retargeting";
}

export interface WizardMessage {
  id: string;
  type: "ai-text" | "user-text" | "step-active" | "step-done";
  text?: string;
  step?: number;
  summary?: string;
}
