export const ALMANAC_URL = process.env.ALMANAC_URL || "http://localhost:3001/api";
export const DEFAULT_CAMPAIGN_ID = process.env.ALMANAC_CAMPAIGN_ID
  ? Number(process.env.ALMANAC_CAMPAIGN_ID)
  : undefined;
export const CHARACTER_LIMIT = 25000;
export const TOOLBOX_ENABLED = (process.env.ALMANAC_TOOLBOX ?? "on").toLowerCase() !== "off";
