export interface MaterialItem {
  id: string;
  projectId: string;
  projectName: string;
  itemCode: string;
  name: string;
  category: "Concrete & Masonry" | "Steel & Rebar" | "Lumber & Carpentry" | "Electrical" | "Plumbing" | "Finishes";
  unit: "tons" | "bags" | "pcs" | "sq_ft" | "linear_ft" | "gallons";
  unitPrice: number;
  quantityInStock: number;
  reorderLevel: number;
  supplier: string;
  lastPurchasedDate: string;
}
