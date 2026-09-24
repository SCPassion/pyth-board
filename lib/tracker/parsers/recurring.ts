import type { Instruction, OrderLink, Program, Trade } from "../types";
export function recurringParser(
  trade: Trade,
  parent: Instruction,
  program: Program,
  orders: OrderLink[],
): Trade {
  const orderKey = program.orderRole
    ? (parent.accounts[program.orderRole] ?? null)
    : null;
  const owner = program.ownerRole
    ? (parent.accounts[program.ownerRole] ?? null)
    : null;
  const link = orderKey
    ? orders.find(
        (o) => o.orderKey === orderKey && o.programId === program.programId,
      )
    : undefined;
  return {
    ...trade,
    product: "RECURRING",
    orderKey,
    owner: owner ?? link?.owner ?? null,
    ownerConfidence: owner ? "HIGH" : link ? "MEDIUM" : "UNRESOLVED",
  };
}
