"use client";

type Customer = {
  name: string;
  phone: string;
  district: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
};

export default function CustomerExportButton({
  customers,
}: {
  customers: Customer[];
}) {
  const exportCustomers = () => {
    if (customers.length === 0) {
      alert("No customers available to export.");
      return;
    }

    const headers = [
      "Customer Name",
      "Phone",
      "District",
      "Address",
      "Total Orders",
      "Total Order Value",
      "Last Order",
    ];

    const escapeCSV = (value: unknown) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.district,
      customer.address,
      customer.totalOrders,
      customer.totalSpent,
      customer.lastOrder,
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `gadget-store-customers-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={exportCustomers}
      disabled={customers.length === 0}
      style={{
        background: customers.length > 0 ? "#16a34a" : "#94a3b8",
        color: "#ffffff",
        border: "none",
        borderRadius: "9px",
        padding: "12px 18px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: customers.length > 0 ? "pointer" : "not-allowed",
      }}
    >
      ↓ Export Customers
    </button>
  );
}