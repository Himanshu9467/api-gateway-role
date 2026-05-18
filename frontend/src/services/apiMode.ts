import { isAxiosError } from "axios";
import { isDemoModeEnabled } from "../config/runtime";

export const shouldUseMockApi = (error?: unknown) => {
  if (isDemoModeEnabled) return true;
  if (!error) return false;
  return isAxiosError(error) && (!error.response || error.code === "ERR_NETWORK");
};
