/** Cart prices are CNY yuan; cart mutations never convert or replace existing prices. */
export interface CartLine {
  uid: string
  productId: string
  spec: string
  orderedBy: string
  price: number
  quantity: number
}

export type CartMutation<T extends CartLine> =
  | { type: 'ADD_CART'; item: T }
  | { type: 'CHANGE_QTY'; uid: string; delta: number }

/** Preserve the demo's same-spec +1 merge and remove lines reduced to zero. */
export function applyCartMutation<T extends CartLine>(cart: readonly T[], mutation: CartMutation<T>): T[] {
  if (mutation.type === 'ADD_CART') {
    const same = cart.find((item) => item.productId === mutation.item.productId && item.spec === mutation.item.spec && item.orderedBy === mutation.item.orderedBy)
    return same
      ? cart.map((item) => item.uid === same.uid ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cart, mutation.item]
  }
  return cart
    .map((item) => item.uid === mutation.uid ? { ...item, quantity: item.quantity + mutation.delta } : item)
    .filter((item) => item.quantity > 0)
}
