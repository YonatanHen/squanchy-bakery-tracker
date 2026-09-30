import type { ComponentType } from "react";
import { AlertsIcon, BranchesIcon, ReadingsIcon, ThresholdsIcon, UploadIcon } from "../icons/icons";

export interface NavItem {
  path: string;
  label: string;
  Icon: ComponentType;
}

// Shared by the phone bottom nav and the desktop sidebar
export const NAV_ITEMS: NavItem[] = [
  { path: "/readings", label: "Readings", Icon: ReadingsIcon },
  { path: "/alerts", label: "Alerts", Icon: AlertsIcon },
  { path: "/upload", label: "Upload", Icon: UploadIcon },
  { path: "/branches", label: "Branches", Icon: BranchesIcon },
  { path: "/thresholds", label: "Thresholds", Icon: ThresholdsIcon },
];
