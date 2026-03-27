export const STRIPE_PLANS = {
  comunidade: {
    name: "Comunidade",
    price_id: "price_1TBxbuJkqgigBrKjPIcaDUHo",
    product_id: "prod_UAICj5dGzPRA0j",
    price: "R$ 79",
    period: "/mês",
  },
  crescimento: {
    name: "Crescimento",
    price_id: "price_1TBxcUJkqgigBrKjg0It5Sko",
    product_id: "prod_UAICkTjHwlKsgI",
    price: "R$ 129",
    period: "/mês",
  },
  pastoral: {
    name: "Pastoral",
    price_id: "price_1TBxhiJkqgigBrKj55dyOxvA",
    product_id: "prod_UAIIHa32ACvV60",
    price: "R$ 199",
    period: "/mês",
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}
