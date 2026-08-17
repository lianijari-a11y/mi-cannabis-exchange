"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Renders a scannable Code128 label for an InventoryLot.sku — this is the
// internal barcode a USB/Bluetooth HID scanner reads at the register
// (RegisterPanel), printed onto the physical product. Not a manufacturer
// UPC; see the InventoryLot model comment in schema.prisma.
export function BarcodeLabel({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      width: 1.5,
      height: 40,
      fontSize: 12,
      margin: 4,
    });
  }, [value]);

  return <svg ref={ref} />;
}
