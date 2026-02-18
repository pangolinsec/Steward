export const STEWARD_URL = process.env.STEWARD_URL || "http://localhost:3001/api";
export const DEFAULT_CAMPAIGN_ID = process.env.STEWARD_CAMPAIGN_ID
  ? Number(process.env.STEWARD_CAMPAIGN_ID)
  : undefined;
export const CHARACTER_LIMIT = 25000;
export const TOOLBOX_ENABLED = (process.env.STEWARD_TOOLBOX ?? "off").toLowerCase() === "on";
