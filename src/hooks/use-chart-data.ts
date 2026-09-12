"use client";

import { useState, useEffect } from "react";

interface ChartData {
  revenueTrend: { month: string; revenue: number; opd: number; ipd: number }[];
  patientGrowth: { month: string; new: number; total: number }[];
  departmentPerformance: { department: string; patients: number; revenue: number; satisfaction: number }[];
}

const defaultData: ChartData = {
  revenueTrend: [],
  patientGrowth: [],
  departmentPerformance: [],
};

export function useChartData() {
  const [data, setData] = useState<ChartData>(defaultData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charts")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { ...data, loading };
}
