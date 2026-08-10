// ========================================================
// TAZQ BACKEND ENGINE (INDEX.JS FOR RENDER / NODE.JS)
// ========================================================
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// TAZQ In-Memory State
let vendorSettings = {
  vendor_id: 1,
  store_name: "TAZQ Fresh Hub",
  is_km_delivery_charge_enabled: true, // Toggle per-km delivery
  base_delivery_fee: 30.00,            // Base charge for first 3 km
  base_delivery_km: 3.0,
  per_km_rate: 10.00,                 // ₹10 per km beyond base
  free_delivery_min_order_value: 400.00 // Minimum order to waive fee
};

let globalSettings = {
  auto_exemption_active: true // Super-Admin Master Exemption Toggle
};

let deliverySlots = [
  { id: 1, slot_name: "Express (15 Mins)", slot_type: "express", days_offset: 0 },
  { id: 2, slot_name: "Delivery in 1 Day", slot_type: "multi_day", days_offset: 1 },
  { id: 3, slot_name: "Delivery in 2 Days", slot_type: "multi_day", days_offset: 2 },
  { id: 4, slot_name: "Delivery in 3 Days", slot_type: "multi_day", days_offset: 3 },
  { id: 5, slot_name: "Custom Delivery (5 Days)", slot_type: "multi_day", days_offset: 5 }
];

// Calculation Logic Engine
function calculateOrderBilling(itemTotal, distanceKm) {
  let originalDeliveryFee = 0.00;

  if (vendorSettings.is_km_delivery_charge_enabled) {
    if (distanceKm <= vendorSettings.base_delivery_km) {
      originalDeliveryFee = vendorSettings.base_delivery_fee;
    } else {
      const extraKm = distanceKm - vendorSettings.base_delivery_km;
      originalDeliveryFee = vendorSettings.base_delivery_fee + (extraKm * vendorSettings.per_km_rate);
    }
  }

  let exemptedAmount = 0.00;
  let isExempted = false;

  if (globalSettings.auto_exemption_active && itemTotal >= vendorSettings.free_delivery_min_order_value) {
    exemptedAmount = originalDeliveryFee;
    isExempted = true;
  }

  const finalDeliveryFee = originalDeliveryFee - exemptedAmount;
  const grandTotal = itemTotal + finalDeliveryFee;

  return {
    brand: "TAZQ",
    itemTotal,
    distanceKm,
    originalDeliveryFee,
    exemptedAmount,
    finalDeliveryFee,
    grandTotal,
    isExempted,
    isKmChargeActive: vendorSettings.is_km_delivery_charge_enabled
  };
}

// --- API ENDPOINTS ---

// 1. Calculate Checkout Order (Distance Fee + Exemption)
app.post('/api/checkout/calculate', (req, res) => {
  const { item_total, distance_km } = req.body;
  const bill = calculateOrderBilling(parseFloat(item_total), parseFloat(distance_km));
  res.json({ success: true, bill });
});

// 2. Fetch Delivery Slots (1-Day, 2-Day, 3-Day, Custom)
app.get('/api/delivery-slots', (req, res) => {
  res.json({ success: true, brand: "TAZQ", data: deliverySlots });
});

// 3. Super Admin: Add Custom Delivery Slots
app.post('/api/admin/delivery-slots', (req, res) => {
  const { slot_name, slot_type, days_offset } = req.body;
  const newSlot = {
    id: deliverySlots.length + 1,
    slot_name,
    slot_type,
    days_offset: parseInt(days_offset) || 0
  };
  deliverySlots.push(newSlot);
  res.status(201).json({ success: true, message: "Slot Added", data: newSlot });
});

// 4. Vendor/Admin: Toggle Per-KM Billing & Rates
app.post('/api/vendor/delivery-settings', (req, res) => {
  const { is_km_enabled, base_fee, per_km_rate, free_min_value } = req.body;
  
  if (is_km_enabled !== undefined) vendorSettings.is_km_delivery_charge_enabled = is_km_enabled;
  if (base_fee) vendorSettings.base_delivery_fee = parseFloat(base_fee);
  if (per_km_rate) vendorSettings.per_km_rate = parseFloat(per_km_rate);
  if (free_min_value) vendorSettings.free_delivery_min_order_value = parseFloat(free_min_value);

  res.json({ success: true, message: "TAZQ Delivery Settings Updated", settings: vendorSettings });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TAZQ Engine Live on Port ${PORT}`);
});
