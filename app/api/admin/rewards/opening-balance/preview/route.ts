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
    const decodedToken = await adminAuth.verifyIdToken(token, true);

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

    for (const doc of transactionsSnapshot.docs) {
      const data = doc.data();
      const customerId = data.customerId;
      const points = data.points;

      if (
        typeof customerId !== "string" ||
        !/^[a-f0-9]{64}$/i.test(customerId)
      ) {
        throw new Error(`Invalid customer ID in reward ledger: ${doc.id}`);
      }

      if (
        typeof points !== "number" ||
        !Number.isSafeInteger(points)
      ) {
        throw new Error(`Invalid points value in reward ledger: ${doc.id}`);
      }

      const accumulatedPoints =
        (ledgerBalances.get(customerId) || 0) + points;

      if (!Number.isSafeInteger(accumulatedPoints)) {
        throw new Error(`Reward ledger overflow for customer: ${customerId}`);
      }

      ledgerBalances.set(customerId, accumulatedPoints);
    }

    const customerIds = new Set(customersSnapshot.docs.map((doc) => doc.id));

    for (const customerId of ledgerBalances.keys()) {
      if (!customerIds.has(customerId)) {
        throw new Error(`Reward ledger references a missing customer: ${customerId}`);
      }
    }

    const preview = customersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const customerId = doc.id;
      const rawRewardPoints = data.rewardPoints;
      const currentPoints =
        rawRewardPoints === undefined ? 0 : rawRewardPoints;

      if (
        typeof currentPoints !== "number" ||
        !Number.isSafeInteger(currentPoints) ||
        currentPoints < 0
      ) {
        throw new Error(`Invalid reward balance for customer: ${customerId}`);
      }
      const ledgerPoints = ledgerBalances.get(customerId) || 0;
      const openingPoints = currentPoints - ledgerPoints;

      if (!Number.isSafeInteger(openingPoints)) {
        throw new Error(`Opening balance overflow for customer: ${customerId}`);
      }

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

    const totalOpeningPoints = eligible.reduce((sum, item) => {
      const total = sum + item.openingPoints;

      if (!Number.isSafeInteger(total)) {
        throw new Error("Total opening reward points exceed the safe integer limit.");
      }

      return total;
    }, 0);
return NextResponse.json({
      success: true,
      readOnly: true,
      summary: {
        totalCustomers: customersSnapshot.size,
        customersWithPoints: preview.filter(
          (item) => item.currentPoints > 0
        ).length,
        openingBalancesNeeded: eligible.length,
        totalOpeningPoints,
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
