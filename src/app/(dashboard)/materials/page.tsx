"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { MaterialDialog } from "@/features/materials/material-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { formatDate } from "@/utils/formatters";
import { Plus, AlertTriangle, CheckCircle } from "lucide-react";

export default function MaterialsPage() {
  const { materials } = useData();
  const { formatCurrency } = useSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Materials & Site Inventory"
        description="Monitor building material stock levels, reorder alerts, and supplier cost logs"
      >
        <Button onClick={() => setDialogOpen(true)} className="text-xs shadow-md shadow-amber-500/20">
          <Plus className="h-4 w-4 mr-1" />
          <span>Add Material Log</span>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3">Item Code</th>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Stock Level</th>
                  <th className="p-3">Unit Price</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Stock Status</th>
                  <th className="p-3">Last Purchased</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-zinc-400">
                      No materials logged yet.
                    </td>
                  </tr>
                )}
                {materials.map((item) => {
                  const isLowStock = item.quantityInStock <= item.reorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="p-3 font-mono font-medium text-amber-600 dark:text-amber-400">{item.itemCode}</td>
                      <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</td>
                      <td className="p-3 text-zinc-500">{item.category}</td>
                      <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {item.quantityInStock} {item.unit}
                      </td>
                      <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(item.unitPrice)} / {item.unit}</td>
                      <td className="p-3 text-zinc-500">{item.supplier}</td>
                      <td className="p-3">
                        {isLowStock ? (
                          <Badge variant="destructive" className="text-[10px] py-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Low Stock (Min {item.reorderLevel})
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px] py-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            In Stock
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-zinc-500 whitespace-nowrap">{formatDate(item.lastPurchasedDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <MaterialDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
