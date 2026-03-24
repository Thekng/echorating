import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export {
  APP_DATE_LOCALE,
  formatDateShort,
  formatDateRange,
  formatDateFull,
  formatDateMedium,
  formatDateMonthDay,
} from "./utils/date-formatter";
export type { MetricIcon } from "./utils/metric-helpers";
export { getMetricIcon, getMetricColor } from "./utils/metric-helpers";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
