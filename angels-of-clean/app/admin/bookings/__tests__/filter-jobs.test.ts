import { describe, it, expect } from "vitest";
import type { Job, JobStatus, StaffMember } from "@/lib/admin-types";
import {
  STATUS_FILTER_ORDER,
  filterJobs,
  hasActiveDropdownFilter,
  isStatusFilter,
} from "../filter-jobs";
import { STATUS_TRANSITIONS } from "../../status-config";

const MARCUS: StaffMember = { id: "e-1", name: "Marcus T.", initials: "MT" };
const DANA: StaffMember = { id: "e-2", name: "Dana R.", initials: "DR" };
const MAP = { [MARCUS.id]: MARCUS, [DANA.id]: DANA };

function job(n: number, status: JobStatus, employeeIds: string[], extra: Partial<Job> = {}): Job {
  return {
    id: `j-${n}`,
    bookingNumber: 1000 + n,
    client: `Client ${n}`,
    service: "Standard Clean",
    address: `${n} Elm Drive`,
    start: "2026-11-02T13:00:00.000Z",
    end: "2026-11-02T17:00:00.000Z",
    employeeIds,
    status,
    ...extra,
  };
}

const JOBS = [
  job(1, "pending", []),
  job(2, "confirmed", ["e-1"]),
  job(3, "active", ["e-2"]),
  job(4, "done", ["e-1", "e-2"]),
  job(5, "cancelled", ["e-1"]),
  job(6, "pending", ["e-2"]),
];

const ALL = { status: "all", employee: "all", search: "" } as const;
const ids = (jobs: Job[]) => jobs.map((j) => j.id);

describe("filterJobs", () => {
  it("returns every booking when nothing is selected", () => {
    expect(filterJobs(JOBS, ALL, MAP)).toEqual(JOBS);
  });

  it.each(STATUS_FILTER_ORDER)("status %s keeps only that status", (status) => {
    const result = filterJobs(JOBS, { ...ALL, status }, MAP);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((j) => j.status === status)).toBe(true);
    expect(result).toHaveLength(JOBS.filter((j) => j.status === status).length);
  });

  it("employee keeps bookings that employee is on, including shared ones", () => {
    expect(ids(filterJobs(JOBS, { ...ALL, employee: "e-1" }, MAP))).toEqual(["j-2", "j-4", "j-5"]);
    expect(ids(filterJobs(JOBS, { ...ALL, employee: "e-2" }, MAP))).toEqual(["j-3", "j-4", "j-6"]);
  });

  it("'unassigned' keeps only bookings with nobody on them", () => {
    expect(ids(filterJobs(JOBS, { ...ALL, employee: "unassigned" }, MAP))).toEqual(["j-1"]);
  });

  it("an employee with no bookings gives an empty list", () => {
    expect(filterJobs(JOBS, { ...ALL, employee: "e-9" }, MAP)).toEqual([]);
  });

  it("status and employee combine (both must match)", () => {
    expect(ids(filterJobs(JOBS, { ...ALL, status: "pending", employee: "e-2" }, MAP))).toEqual(["j-6"]);
    expect(ids(filterJobs(JOBS, { ...ALL, status: "done", employee: "e-1" }, MAP))).toEqual(["j-4"]);
    expect(filterJobs(JOBS, { ...ALL, status: "active", employee: "e-1" }, MAP)).toEqual([]);
    expect(ids(filterJobs(JOBS, { ...ALL, status: "pending", employee: "unassigned" }, MAP))).toEqual(["j-1"]);
  });

  it("search still works and combines with both dropdowns", () => {
    expect(ids(filterJobs(JOBS, { ...ALL, search: "client 4" }, MAP))).toEqual(["j-4"]);
    expect(ids(filterJobs(JOBS, { ...ALL, search: "marcus" }, MAP))).toEqual(["j-2", "j-4", "j-5"]);
    expect(ids(filterJobs(JOBS, { status: "done", employee: "e-2", search: "marcus" }, MAP))).toEqual(["j-4"]);
    expect(filterJobs(JOBS, { status: "pending", employee: "e-2", search: "client 1" }, MAP)).toEqual([]);
  });

  it("does not change the order or mutate the input", () => {
    const copy = [...JOBS];
    const result = filterJobs(JOBS, { ...ALL, status: "pending" }, MAP);
    expect(ids(result)).toEqual(["j-1", "j-6"]);
    expect(JOBS).toEqual(copy);
  });
});

describe("status filter options", () => {
  it("offers exactly the statuses a booking can have, and nothing else", () => {
    expect([...STATUS_FILTER_ORDER].sort()).toEqual(Object.keys(STATUS_TRANSITIONS).sort());
  });

  it("isStatusFilter accepts 'all' and real statuses only", () => {
    for (const s of ["all", ...STATUS_FILTER_ORDER]) expect(isStatusFilter(s)).toBe(true);
    for (const s of ["", "ALL", "finished", "unassigned", "e-1"]) expect(isStatusFilter(s)).toBe(false);
  });
});

describe("hasActiveDropdownFilter", () => {
  it("is false only when both dropdowns are on 'all'", () => {
    expect(hasActiveDropdownFilter({ status: "all", employee: "all" })).toBe(false);
    expect(hasActiveDropdownFilter({ status: "done", employee: "all" })).toBe(true);
    expect(hasActiveDropdownFilter({ status: "all", employee: "unassigned" })).toBe(true);
  });
});
