/**
 * Types for TP-Link dinner subsidy data
 * 
 * Data is fetched via AJAX endpoints:
 * - GET  /dinner/default/get_user_data   → current user info
 * - POST /dinner/default/find_by_page    → meal subsidy records
 */

export interface DinnerUserData {
  index: number;
  employeeNo: string;
  name: string;
  department: string;
  dailyRecords: (number | null)[];
  monthTotal: number;
}

export interface ParsedDinnerData {
  currentUser: DinnerUserData | null;
  allUsers: DinnerUserData[];
  totalUsers: number;
  currentUserRank: number | null;
  daysInMonth: number;
  year: string;
  month: string;
  statistics: {
    maxTotal: number;
    minTotal: number;
    avgTotal: number;
    medianTotal: number;
    grandTotal: number;
  };
}
