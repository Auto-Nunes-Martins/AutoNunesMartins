export function createCgroupReader(options?: Record<string, unknown>): {
  read(options?: { detail?: boolean }): {
    available: boolean;
    currentBytes?: number;
    effectiveLimitBytes?: number | null;
    effectiveHeadroomBytes?: number | null;
    limitBytes?: number | null;
    headroomBytes?: number | null;
  };
};
