/**
 * @swagger
 * tags:
 *   - name: API
 *     description: Main API router
 *   - name: Blockchain
 *     description: Blockchain management endpoints
 *   - name: Wallets
 *     description: Wallet management endpoints
 *   - name: Peers
 *     description: Peer network management endpoints
 *   - name: Nodes
 *     description: Node management endpoints
 *   - name: Mining
 *     description: Mining management endpoints
 *   - name: Transactions
 *     description: Transaction management endpoints
 *   - name: Mempool
 *     description: Mempool management endpoints
 */
declare const router: import("express-serve-static-core").Router;
export default router;
