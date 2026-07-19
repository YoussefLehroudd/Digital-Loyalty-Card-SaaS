"use client";

import * as React from "react";

export type SliderProps = {
  id?: string;
  min: number;
  max: number;
  step: number;
  value: number[];
  onValueChange: (value: number[]) => void;
  className?: string;
};

export function Slider({
  id,
  min,
  max,
  step,
  value,
  onValueChange,
  className,
}: SliderProps) {
  // IMPORTANT: keep it fully controlled by parent.
  const current = value?.[0] ?? min;

  return (
    <div className={className}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => {
          onValueChange([Number(e.target.value)]);
        }}
        className="w-full appearance-none bg-transparent"
      />
    </div>
  );
}
