import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.uid !== ADMIN_UID) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const [customersSnapshot, transactionsSnapshot] = await Promise.all([
      adminDb.collection("customers").get(),
      adminDb.collection("rewardTransactions").get(),
    ]);

    const ledgerBalances = new Map<string, number>();

    transactionsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const customerId = String(data.customerId || "");
      const points = Number(data.points || 0);

      if (!customerId || !Number.isFinite(points)) return;

      ledgerBalances.set(
        customerId,
        (ledgerBalances.get(customerId) || 0) + points
      );
    });

    const preview = customersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const customerId = doc.id;
      const currentPoints = Math.max(0, Number(data.rewardPoints || 0));
      const ledgerPoints = ledgerBalances.get(customerId) || 0;
      const openingPoints = currentPoints - ledgerPoints;

      let action = "reconciled";

      if (openingPoints > 0) {
        action = "create-opening-balance";
      } else if (openingPoints < 0) {
        action = "ledger-exceeds-balance";
      }

      return {
        customerId,
        currentPoints,
        ledgerPoints,
        openingPoints,
        action,
      };
    });

    const eligible = preview.filter(
      (item) => item.action === "create-opening-balance"
    );

    const discrepancies = preview.filter(
      (item) => item.action === "ledger-exceeds-balance"
    );

    return NextResponse.json({
      success: true,
      readOnly: true,
      summary: {
        totalCustomers: customersSnapshot.size,
        customersWithPoints: preview.filter(
          (item) => item.currentPoints > 0
        ).length,
        openingBalancesNeeded: eligible.length,
        totalOpeningPoints: eligible.reduce(
          (sum, item) => sum + item.openingPoints,
          0
        ),
        discrepancies: discrepancies.length,
      },
      openingBalances: eligible,
      discrepancies,
    });
  } catch (error) {
    console.error("Reward opening balance preview failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to generate opening balance preview." },
      { status: 500 }
    );
  }
}
